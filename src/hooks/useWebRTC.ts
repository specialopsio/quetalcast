import { useCallback, useEffect, useRef, useState } from 'react';
import { type UseSignalingReturn, type SignalingMessage } from './useSignaling';
import { parseStats, resetStats, type WebRTCStats } from '@/lib/webrtc-stats';

export type ConnectionStatus = 'idle' | 'connecting' | 'on-air' | 'receiving' | 'disconnected' | 'error';

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
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

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

  // Receiver: single PC
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // Broadcaster: multiple PCs keyed by receiverId
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const broadcastStreamRef = useRef<MediaStream | null>(null);

  const statsIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const reportIntervalRef = useRef<ReturnType<typeof setInterval>>();

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
  }, []);

  // --- Broadcaster: create a PC for a specific receiver ---
  const createPCForReceiver = useCallback(
    (receiverId: string, stream: MediaStream) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
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

      // Create and send offer for this receiver
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          signaling.send({ type: 'offer', sdp: offer, receiverId });
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
    const pc = new RTCPeerConnection(RTC_CONFIG);
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
            // New receiver joined — create a dedicated PC for them
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
          // Only receivers handle offers
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
          // Only broadcasters handle answers (routed by receiverId)
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
            // Route to the correct receiver's PC
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

      // Stats polling for broadcaster — uses first connected PC
      statsIntervalRef.current = setInterval(async () => {
        for (const pc of pcsRef.current.values()) {
          if (pc.connectionState === 'connected') {
            const s = await parseStats(pc, 'broadcaster');
            setStats(s);
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

      // Tell the server we're ready — it will send peer-joined for each existing receiver
      signaling.send({ type: 'ready', roomId });
    },
    [roomId, signaling],
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
  };
}
