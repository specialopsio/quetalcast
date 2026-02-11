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
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const reportIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [connectionState, setConnectionState] = useState('new');
  const [iceConnectionState, setIceConnectionState] = useState('new');
  const [signalingStateVal, setSignalingState] = useState('stable');
  const [stats, setStats] = useState<WebRTCStats | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    if (reportIntervalRef.current) clearInterval(reportIntervalRef.current);
    pcRef.current?.close();
    pcRef.current = null;
    resetStats();
    setStats(null);
    setRemoteStream(null);
    setPeerConnected(false);
    setConnectionState('new');
    setIceConnectionState('new');
    setSignalingState('stable');
  }, []);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        setPeerConnected(true);
        setStatus(role === 'broadcaster' ? 'on-air' : 'receiving');
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

    if (role === 'receiver') {
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0] || new MediaStream([event.track]));
      };
    }

    // Poll stats every second
    statsIntervalRef.current = setInterval(async () => {
      if (pc.connectionState === 'connected') {
        const s = await parseStats(pc, role);
        setStats(s);
      }
    }, 1000);

    // Report stats to server every 5 seconds
    reportIntervalRef.current = setInterval(async () => {
      if (pc.connectionState === 'connected') {
        const s = await parseStats(pc, role);
        signaling.send({ type: 'stats', data: s });
      }
    }, 5000);

    return pc;
  }, [role, signaling]);

  // Handle signaling messages
  useEffect(() => {
    const unsub = signaling.subscribe(async (msg: SignalingMessage) => {
      const pc = pcRef.current;

      switch (msg.type) {
        case 'room-created':
          setRoomId(msg.roomId as string);
          break;

        case 'joined':
          setRoomId(msg.roomId as string);
          break;

        case 'peer-joined':
          setPeerConnected(true);
          break;

        case 'peer-left':
          setPeerConnected(false);
          setStatus(role === 'broadcaster' ? 'on-air' : 'idle');
          break;

        case 'offer':
          if (role === 'receiver' && pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              signaling.send({ type: 'answer', sdp: answer });
            } catch (e) {
              console.error('Failed to handle offer:', e);
              setStatus('error');
            }
          }
          break;

        case 'answer':
          if (role === 'broadcaster' && pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
            } catch (e) {
              console.error('Failed to handle answer:', e);
              setStatus('error');
            }
          }
          break;

        case 'candidate':
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
            } catch (e) {
              console.error('Failed to add ICE candidate:', e);
            }
          }
          break;

        case 'error':
          setStatus('error');
          break;
      }
    });

    return unsub;
  }, [signaling, role]);

  const createRoom = useCallback(() => {
    signaling.send({ type: 'create-room' });
  }, [signaling]);

  const startBroadcast = useCallback(
    (stream: MediaStream) => {
      if (!roomId) return;
      setStatus('connecting');
      const pc = createPC();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Create offer when peer joins
      const unsub = signaling.subscribe(async (msg) => {
        if (msg.type === 'peer-joined' || msg.type === 'joined') {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            signaling.send({ type: 'offer', sdp: offer });
          } catch (e) {
            console.error('Failed to create offer:', e);
            setStatus('error');
          }
        }
      });

      // If peer is already connected, create offer immediately
      signaling.send({ type: 'ready', roomId });

      return () => unsub();
    },
    [roomId, createPC, signaling]
  );

  const joinAsReceiver = useCallback(
    (joinRoomId: string) => {
      setStatus('connecting');
      createPC();
      signaling.send({ type: 'join-room', roomId: joinRoomId, role: 'receiver' });
    },
    [createPC, signaling]
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
