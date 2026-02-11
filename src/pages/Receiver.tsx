import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';

import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC, type ConnectionStatus } from '@/hooks/useWebRTC';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { StatusBar } from '@/components/StatusBar';
import { LevelMeter } from '@/components/LevelMeter';
import { HealthPanel } from '@/components/HealthPanel';
import { EventLog, createLogEntry, type LogEntry } from '@/components/EventLog';
import { Headphones, Radio, Volume2 } from 'lucide-react';
import { Footer } from '@/components/Footer';

const WS_URL = import.meta.env.VITE_WS_URL || (
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}`
    : `ws://${window.location.hostname}:3001`
);

const Receiver = () => {
  const { roomId: paramRoomId } = useParams();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [roomInput, setRoomInput] = useState(paramRoomId || '');
  const [joined, setJoined] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const addLog = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    setLogs((prev) => [...prev.slice(-100), createLogEntry(msg, level)]);
  }, []);

  const signaling = useSignaling(WS_URL);
  const webrtc = useWebRTC(signaling, 'receiver');
  const audioAnalysis = useAudioAnalyser(audioStarted ? webrtc.remoteStream : null);


  const statusLabels: Record<ConnectionStatus, string> = {
    idle: 'Ready',
    connecting: 'Connecting to broadcast…',
    'on-air': 'On air',
    receiving: 'Listening',
    disconnected: 'Broadcast ended',
    error: 'Could not connect',
  };

  useEffect(() => {
    signaling.connect();
    addLog('Connecting…');
    return () => signaling.disconnect();
  }, []);

  useEffect(() => {
    if (signaling.connected) addLog('Connected to server');
  }, [signaling.connected]);

  const prevStatus = useRef<ConnectionStatus>('idle');
  useEffect(() => {
    if (webrtc.status !== prevStatus.current) {
      addLog(statusLabels[webrtc.status] || webrtc.status);
      prevStatus.current = webrtc.status;
    }
  }, [webrtc.status, addLog]);

  // Auto-join if roomId is in URL
  useEffect(() => {
    if (paramRoomId && signaling.connected && !joined) {
      handleJoin();
    }
  }, [paramRoomId, signaling.connected]);

  const handleJoin = () => {
    const rid = roomInput.trim();
    if (!rid) {
      addLog('Enter a room ID', 'warn');
      return;
    }
    webrtc.joinAsReceiver(rid);
    setJoined(true);
    addLog('Tuning in…');
  };

  const handleClickToListen = () => {
    if (webrtc.remoteStream) {
      const audio = new Audio();
      audio.srcObject = webrtc.remoteStream;
      audio.play().then(() => {
        setAudioStarted(true);
        addLog('You\'re listening');
      }).catch(() => {
        addLog('Couldn\'t start playback — try tapping again', 'error');
      });
      audioElRef.current = audio;
    }
  };

  // Set remote stream on audio element when available
  useEffect(() => {
    if (webrtc.remoteStream && audioElRef.current) {
      audioElRef.current.srcObject = webrtc.remoteStream;
    }
  }, [webrtc.remoteStream]);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <StatusBar status={webrtc.status} roomId={roomInput || null} />

      <div className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-4">
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Headphones className="h-5 w-5 text-primary" />
          Receiver
        </h1>

        {/* Off-air / not joined / error / disconnected — show message + room ID input */}
        {(!joined || (joined && !webrtc.remoteStream && (webrtc.status === 'error' || webrtc.status === 'disconnected'))) && (
          <div className="panel text-center py-10 space-y-5">
            <div>
              <Radio className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">This broadcast isn't on air right now</p>
            </div>
            <div className="max-w-sm mx-auto">
              <p className="text-xs text-muted-foreground/60 mb-2">Have a Room ID? Paste it below to tune in.</p>
              <div className="flex gap-2">
                <input
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="Enter room ID"
                  className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleJoin}
                  disabled={!signaling.connected}
                  className="bg-primary text-primary-foreground rounded-md px-6 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Join
                </button>
              </div>
              {joined && (webrtc.status === 'error' || webrtc.status === 'disconnected') && (
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Retry this broadcast
                </button>
              )}
            </div>
          </div>
        )}

        {/* Click to Listen */}
        {joined && webrtc.remoteStream && !audioStarted && (
          <button
            onClick={handleClickToListen}
            className="w-full py-12 rounded-lg bg-primary/10 border-2 border-primary/30 text-primary hover:bg-primary/20 transition-colors flex flex-col items-center gap-3"
          >
            <Volume2 className="h-12 w-12" />
            <span className="text-lg font-semibold">Tap to Listen</span>
            <span className="text-xs text-muted-foreground">The broadcast is ready — tap to start audio</span>
          </button>
        )}

        {/* Waiting state — only when joined and actively connecting */}
        {joined && !webrtc.remoteStream && webrtc.status !== 'error' && webrtc.status !== 'disconnected' && (
          <div className="panel text-center py-8">
            <div className="text-muted-foreground text-sm">Connecting to broadcast…</div>
            <div className="text-xs text-muted-foreground/60 mt-1">
              Hang tight, we're setting up the connection
            </div>
          </div>
        )}

        {/* Level meter */}
        {audioStarted && (
          <LevelMeter
            left={audioAnalysis.left}
            right={audioAnalysis.right}
            label="Output Level"
          />
        )}

        {/* Health + Log — only when actively connected */}
        {joined && webrtc.status !== 'error' && webrtc.status !== 'disconnected' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HealthPanel
              stats={webrtc.stats}
              connectionState={webrtc.connectionState}
              iceConnectionState={webrtc.iceConnectionState}
              signalingState={webrtc.signalingState}
              peerConnected={webrtc.peerConnected}
            />
            <EventLog entries={logs} />
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Receiver;
