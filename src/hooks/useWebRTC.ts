import { useCallback, useEffect, useRef, useState } from 'react';
import { type UseSignalingReturn, type SignalingMessage } from './useSignaling';
import { parseStats, resetStats, type WebRTCStats } from '@/lib/webrtc-stats';

export type ConnectionStatus = 'idle' | 'connecting' | 'on-air' | 'receiving' | 'disconnected' | 'error';
export type AudioQuality = 'high' | 'low' | 'auto';
type EffectiveQuality = 'high' | 'low';

export interface UseWebRTCReturn {
  status: ConnectionStatus;
  connectionState: string;
  iceConnectionState: string;
  signalingState: string;
  stats: WebRTCStats | null;
  remoteStream: MediaStream | null;
  peerConnected: boolean;
  startBroadcast: (stream: MediaStream) => void;
  joinAsReceiver: (roomId: string) => void;
  stop: () => void;
  createRoom: () => void;
  roomId: string | null;
  setAudioQuality: (quality: AudioQuality) => void;
  /** The actual quality level in use (meaningful when mode is 'auto') */
  effectiveQuality: EffectiveQuality;
}

// Default fallback — STUN only (no TURN relay)
const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/** Fetch ICE server configuration (STUN + TURN) from the server */
async function fetchIceConfig(): Promise<RTCConfiguration> {
  try {
    const res = await fetch('/api/ice-config');
    if (res.ok) {
      const data = await res.json();
      if (data.iceServers && data.iceServers.length > 0) {
        return { iceServers: data.iceServers };
      }
    }
  } catch {
    console.warn('Could not fetch ICE config, using STUN-only fallback');
  }
  return DEFAULT_RTC_CONFIG;
}

// ---------------------------------------------------------------------------
// Opus SDP parameters for pristine vs bandwidth-saving audio
// ---------------------------------------------------------------------------

/** Pristine: 510 kbps stereo Opus, CBR, no DTX, no FEC */
const HQ_OPUS_PARAMS: Record<string, number> = {
  maxaveragebitrate: 510000,
  stereo: 1,
  'sprop-stereo': 1,
  maxplaybackrate: 48000,
  usedtx: 0,
  useinbandfec: 0,
  cbr: 1,
};

/** Low bandwidth: 32 kbps mono Opus, VBR, DTX + FEC for resilience */
const LQ_OPUS_PARAMS: Record<string, number> = {
  maxaveragebitrate: 32000,
  stereo: 0,
  'sprop-stereo': 0,
  maxplaybackrate: 24000,
  usedtx: 1,
  useinbandfec: 1,
  cbr: 0,
};

/** Rewrite the Opus fmtp line in an SDP string to inject our codec params */
function mungeOpusSdp(sdp: string, quality: EffectiveQuality): string {
  const params = quality === 'high' ? HQ_OPUS_PARAMS : LQ_OPUS_PARAMS;
  const lines = sdp.split('\r\n');

  // Find the Opus payload type number
  let opusPT: string | null = null;
  for (const line of lines) {
    const match = line.match(/^a=rtpmap:(\d+) opus\/48000/);
    if (match) {
      opusPT = match[1];
      break;
    }
  }
  if (!opusPT) return sdp;

  const fmtpPrefix = `a=fmtp:${opusPT}`;
  let found = false;

  const result = lines.map((line) => {
    if (line.startsWith(fmtpPrefix)) {
      found = true;
      const existing = line.slice(fmtpPrefix.length + 1);
      const map = new Map<string, string>();
      existing.split(';').forEach((p) => {
        const [k, ...v] = p.trim().split('=');
        if (k) map.set(k, v.join('='));
      });
      for (const [k, v] of Object.entries(params)) {
        map.set(k, String(v));
      }
      return `${fmtpPrefix} ${Array.from(map).map(([k, v]) => `${k}=${v}`).join(';')}`;
    }
    return line;
  });

  if (!found) {
    const rtpmapIdx = result.findIndex((l) => l.startsWith(`a=rtpmap:${opusPT} opus/`));
    if (rtpmapIdx !== -1) {
      const paramStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(';');
      result.splice(rtpmapIdx + 1, 0, `${fmtpPrefix} ${paramStr}`);
    }
  }

  return result.join('\r\n');
}

/** Apply maxBitrate on all audio senders of a peer connection */
async function applyBitrateToSenders(pc: RTCPeerConnection, quality: EffectiveQuality) {
  const maxBitrate = quality === 'high' ? 510000 : 32000;
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind === 'audio') {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = maxBitrate;
        await sender.setParameters(params);
      } catch (e) {
        console.warn('Could not set sender bitrate:', e);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Auto-adaptive quality thresholds
// ---------------------------------------------------------------------------
const AUTO_DOWNGRADE_RTT = 200;     // ms — downgrade if RTT exceeds this
const AUTO_DOWNGRADE_LOSS = 5;      // packets — downgrade if loss exceeds this
const AUTO_DOWNGRADE_JITTER = 50;   // ms — downgrade if jitter exceeds this

const AUTO_UPGRADE_RTT = 100;       // ms — can upgrade if RTT below this
const AUTO_UPGRADE_LOSS = 1;        // packets — can upgrade if loss below this
const AUTO_UPGRADE_JITTER = 20;     // ms — can upgrade if jitter below this

const AUTO_UPGRADE_STABLE_COUNT = 5; // consecutive good readings before upgrading

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWebRTC(
  signaling: UseSignalingReturn,
  role: 'broadcaster' | 'receiver'
): UseWebRTCReturn {
  // --- Shared state ---
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [connectionState, setConnectionState] = useState('new');
  const [iceConnectionState, setIceConnectionState] = useState('new');
  const [signalingStateVal, setSignalingState] = useState('stable');
  const [stats, setStats] = useState<WebRTCStats | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  // ICE config (fetched from server, includes TURN credentials when configured)
  const rtcConfigRef = useRef<RTCConfiguration>(DEFAULT_RTC_CONFIG);
  const iceConfigFetchedRef = useRef(false);

  useEffect(() => {
    fetchIceConfig().then((cfg) => {
      rtcConfigRef.current = cfg;
      iceConfigFetchedRef.current = true;
    });
  }, []);

  // Audio quality
  const audioQualityModeRef = useRef<AudioQuality>('auto');     // user's chosen mode
  const effectiveQualityRef = useRef<EffectiveQuality>('high'); // what's actually in use
  const [effectiveQuality, setEffectiveQuality] = useState<EffectiveQuality>('high');
  const stableCountRef = useRef(0); // consecutive good readings for upgrade hysteresis

  // Receiver: single PC
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // Broadcaster: multiple PCs keyed by receiverId
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const broadcastStreamRef = useRef<MediaStream | null>(null);

  const statsIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const reportIntervalRef = useRef<ReturnType<typeof setInterval>>();

  /** Apply a quality level to all existing broadcaster PCs */
  const applyEffectiveQuality = useCallback((q: EffectiveQuality) => {
    if (effectiveQualityRef.current === q) return;
    effectiveQualityRef.current = q;
    setEffectiveQuality(q);
    for (const pc of pcsRef.current.values()) {
      applyBitrateToSenders(pc, q);
    }
  }, []);

  /** Auto-adaptive: evaluate stats and adjust quality if in auto mode */
  const evaluateAutoQuality = useCallback((s: WebRTCStats) => {
    if (audioQualityModeRef.current !== 'auto') return;

    const current = effectiveQualityRef.current;
    const bad = s.rtt > AUTO_DOWNGRADE_RTT ||
                s.packetsLost > AUTO_DOWNGRADE_LOSS ||
                s.jitter > AUTO_DOWNGRADE_JITTER;

    if (bad && current === 'high') {
      // Downgrade immediately
      stableCountRef.current = 0;
      applyEffectiveQuality('low');
      return;
    }

    const good = s.rtt < AUTO_UPGRADE_RTT &&
                 s.packetsLost <= AUTO_UPGRADE_LOSS &&
                 s.jitter < AUTO_UPGRADE_JITTER;

    if (good && current === 'low') {
      // Require several consecutive good readings before upgrading
      stableCountRef.current++;
      if (stableCountRef.current >= AUTO_UPGRADE_STABLE_COUNT) {
        stableCountRef.current = 0;
        applyEffectiveQuality('high');
      }
    } else if (!good) {
      stableCountRef.current = 0;
    }
  }, [applyEffectiveQuality]);

  const cleanup = useCallback(() => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    if (reportIntervalRef.current) clearInterval(reportIntervalRef.current);

    // Receiver PC
    pcRef.current?.close();
    pcRef.current = null;

    // Broadcaster PCs
    for (const pc of pcsRef.current.values()) {
      pc.close();
    }
    pcsRef.current.clear();
    broadcastStreamRef.current = null;

    resetStats();
    setStats(null);
    setRemoteStream(null);
    setPeerConnected(false);
    setConnectionState('new');
    setIceConnectionState('new');
    setSignalingState('stable');
    stableCountRef.current = 0;
  }, []);

  // --- Broadcaster: create a PC for a specific receiver ---
  const createPCForReceiver = useCallback(
    (receiverId: string, stream: MediaStream) => {
      const pc = new RTCPeerConnection(rtcConfigRef.current);
      pcsRef.current.set(receiverId, pc);

      // Add all tracks from the broadcast stream
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        const anyConnected = Array.from(pcsRef.current.values()).some(
          (p) => p.connectionState === 'connected',
        );
        setPeerConnected(anyConnected);
        if (anyConnected) setStatus('on-air');
      };

      pc.oniceconnectionstatechange = () => {
        setIceConnectionState(pc.iceConnectionState);
      };

      pc.onsignalingstatechange = () => {
        setSignalingState(pc.signalingState);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          signaling.send({
            type: 'candidate',
            candidate: event.candidate.toJSON(),
            receiverId,
          });
        }
      };

      // Create offer with Opus quality params baked in
      (async () => {
        try {
          const offer = await pc.createOffer();
          const quality = effectiveQualityRef.current;
          const mungedSdp = mungeOpusSdp(offer.sdp!, quality);
          const mungedOffer = { ...offer, sdp: mungedSdp };
          await pc.setLocalDescription(mungedOffer);
          signaling.send({ type: 'offer', sdp: mungedOffer, receiverId });

          applyBitrateToSenders(pc, quality);
        } catch (e) {
          console.error('Failed to create offer for receiver:', receiverId, e);
        }
      })();

      return pc;
    },
    [signaling],
  );

  // --- Receiver: create a single PC ---
  const createReceiverPC = useCallback(() => {
    const pc = new RTCPeerConnection(rtcConfigRef.current);
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        setPeerConnected(true);
        setStatus('receiving');
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('disconnected');
      }
    };

    pc.oniceconnectionstatechange = () => {
      setIceConnectionState(pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      setSignalingState(pc.signalingState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.send({ type: 'candidate', candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0] || new MediaStream([event.track]));
    };

    // Stats polling for receiver
    statsIntervalRef.current = setInterval(async () => {
      if (pc.connectionState === 'connected') {
        const s = await parseStats(pc, 'receiver');
        setStats(s);
      }
    }, 1000);

    reportIntervalRef.current = setInterval(async () => {
      if (pc.connectionState === 'connected') {
        const s = await parseStats(pc, 'receiver');
        signaling.send({ type: 'stats', data: s });
      }
    }, 5000);

    return pc;
  }, [signaling]);

  // --- Handle signaling messages ---
  useEffect(() => {
    const unsub = signaling.subscribe(async (msg: SignalingMessage) => {
      switch (msg.type) {
        case 'room-created':
          setRoomId(msg.roomId as string);
          break;

        case 'joined':
          setRoomId(msg.roomId as string);
          break;

        case 'peer-joined': {
          if (role === 'broadcaster' && msg.receiverId && broadcastStreamRef.current) {
            createPCForReceiver(msg.receiverId as string, broadcastStreamRef.current);
          }
          setPeerConnected(true);
          break;
        }

        case 'peer-left': {
          if (role === 'broadcaster' && msg.receiverId) {
            const rid = msg.receiverId as string;
            const pc = pcsRef.current.get(rid);
            if (pc) {
              pc.close();
              pcsRef.current.delete(rid);
            }
            setPeerConnected(pcsRef.current.size > 0);
          } else {
            setPeerConnected(false);
            setStatus(role === 'broadcaster' ? 'on-air' : 'idle');
          }
          break;
        }

        case 'offer':
          if (role === 'receiver') {
            const pc = pcRef.current;
            if (pc) {
              try {
                await pc.setRemoteDescription(
                  new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit),
                );
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                signaling.send({ type: 'answer', sdp: answer });
              } catch (e) {
                console.error('Failed to handle offer:', e);
                setStatus('error');
              }
            }
          }
          break;

        case 'answer':
          if (role === 'broadcaster' && msg.receiverId) {
            const rid = msg.receiverId as string;
            const pc = pcsRef.current.get(rid);
            if (pc) {
              try {
                await pc.setRemoteDescription(
                  new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit),
                );
              } catch (e) {
                console.error('Failed to handle answer:', e);
              }
            }
          }
          break;

        case 'candidate':
          if (role === 'broadcaster' && msg.receiverId) {
            const rid = msg.receiverId as string;
            const pc = pcsRef.current.get(rid);
            if (pc) {
              try {
                await pc.addIceCandidate(
                  new RTCIceCandidate(msg.candidate as RTCIceCandidateInit),
                );
              } catch (e) {
                console.error('Failed to add ICE candidate:', e);
              }
            }
          } else if (role === 'receiver') {
            const pc = pcRef.current;
            if (pc) {
              try {
                await pc.addIceCandidate(
                  new RTCIceCandidate(msg.candidate as RTCIceCandidateInit),
                );
              } catch (e) {
                console.error('Failed to add ICE candidate:', e);
              }
            }
          }
          break;

        case 'error':
          setStatus('error');
          break;
      }
    });

    return unsub;
  }, [signaling, role, createPCForReceiver]);

  const createRoom = useCallback(() => {
    signaling.send({ type: 'create-room' });
  }, [signaling]);

  const startBroadcast = useCallback(
    (stream: MediaStream) => {
      if (!roomId) return;
      setStatus('on-air');
      broadcastStreamRef.current = stream;

      // Stats polling for broadcaster — also drives auto quality adaptation
      statsIntervalRef.current = setInterval(async () => {
        for (const pc of pcsRef.current.values()) {
          if (pc.connectionState === 'connected') {
            const s = await parseStats(pc, 'broadcaster');
            setStats(s);
            evaluateAutoQuality(s);
            break;
          }
        }
      }, 1000);

      reportIntervalRef.current = setInterval(async () => {
        for (const pc of pcsRef.current.values()) {
          if (pc.connectionState === 'connected') {
            const s = await parseStats(pc, 'broadcaster');
            signaling.send({ type: 'stats', data: s });
            break;
          }
        }
      }, 5000);

      signaling.send({ type: 'ready', roomId });
    },
    [roomId, signaling, evaluateAutoQuality],
  );

  const joinAsReceiver = useCallback(
    (joinRoomId: string) => {
      setStatus('connecting');
      createReceiverPC();
      signaling.send({ type: 'join-room', roomId: joinRoomId, role: 'receiver' });
    },
    [createReceiverPC, signaling],
  );

  const stop = useCallback(() => {
    signaling.send({ type: 'leave' });
    cleanup();
    setStatus('idle');
  }, [signaling, cleanup]);

  /** Change the audio quality mode. For 'high'/'low' applies immediately;
   *  for 'auto' starts at high and adapts based on stream health. */
  const setAudioQuality = useCallback((quality: AudioQuality) => {
    audioQualityModeRef.current = quality;
    stableCountRef.current = 0;

    if (quality === 'high' || quality === 'low') {
      applyEffectiveQuality(quality);
    } else {
      // Auto: start at high, let evaluateAutoQuality handle the rest
      applyEffectiveQuality('high');
    }
  }, [applyEffectiveQuality]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    connectionState,
    iceConnectionState,
    signalingState: signalingStateVal,
    stats,
    remoteStream,
    peerConnected,
    startBroadcast,
    joinAsReceiver,
    stop,
    createRoom,
    roomId,
    setAudioQuality,
    effectiveQuality,
  };
}
