import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAuthenticated } from '@/lib/auth';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC, type ConnectionStatus } from '@/hooks/useWebRTC';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { StatusBar } from '@/components/StatusBar';
import { LevelMeter } from '@/components/LevelMeter';
import { HealthPanel } from '@/components/HealthPanel';
import { EventLog, createLogEntry, type LogEntry } from '@/components/EventLog';
import { Headphones, Volume2 } from 'lucide-react';

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3001`;

const Receiver = () => {
  const navigate = useNavigate();
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
  const audioAnalysis = useAudioAnalyser(webrtc.remoteStream);

  useEffect(() => {
    if (!isAuthenticated()) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    signaling.connect();
    addLog('Connecting to signaling server…');
    return () => signaling.disconnect();
  }, []);

  useEffect(() => {
    if (signaling.connected) addLog('Signaling connected');
  }, [signaling.connected]);

  const prevStatus = useRef<ConnectionStatus>('idle');
  useEffect(() => {
    if (webrtc.status !== prevStatus.current) {
      addLog(`Status: ${webrtc.status}`);
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
    addLog(`Joining room ${rid.slice(0, 8)}…`);
  };

  const handleClickToListen = () => {
    if (webrtc.remoteStream) {
      const audio = new Audio();
      audio.srcObject = webrtc.remoteStream;
      audio.play().then(() => {
        setAudioStarted(true);
        addLog('Audio playback started');
      }).catch((e) => {
        addLog('Playback failed: ' + e.message, 'error');
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
    <div className="min-h-screen bg-background flex flex-col">
      <StatusBar status={webrtc.status} roomId={roomInput || null} />

      <div className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-4">
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Headphones className="h-5 w-5 text-primary" />
          Receiver
        </h1>

        {/* Room join */}
        {!joined && (
          <div className="panel">
            <div className="panel-header">Join Room</div>
            <div className="flex gap-2">
              <input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Enter Room ID"
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
          </div>
        )}

        {/* Click to Listen */}
        {joined && webrtc.remoteStream && !audioStarted && (
          <button
            onClick={handleClickToListen}
            className="w-full py-12 rounded-lg bg-primary/10 border-2 border-primary/30 text-primary hover:bg-primary/20 transition-colors flex flex-col items-center gap-3"
          >
            <Volume2 className="h-12 w-12" />
            <span className="text-lg font-semibold">Click to Listen</span>
            <span className="text-xs text-muted-foreground">Browser requires user gesture for audio playback</span>
          </button>
        )}

        {/* Waiting state */}
        {joined && !webrtc.remoteStream && (
          <div className="panel text-center py-8">
            <div className="text-muted-foreground text-sm">Waiting for broadcaster…</div>
            <div className="text-xs text-muted-foreground/60 mt-1 font-mono">
              ICE: {webrtc.iceConnectionState} | Signaling: {webrtc.signalingState}
            </div>
          </div>
        )}

        {/* Level meter */}
        {audioStarted && (
          <LevelMeter
            level={audioAnalysis.level}
            peak={audioAnalysis.peak}
            clipping={audioAnalysis.clipping}
            label="Output Level"
          />
        )}

        {/* Health + Log */}
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

        {!signaling.connected && (
          <div className="panel text-center text-sm text-muted-foreground">
            <p className="mb-1">Signaling server not connected</p>
            <p className="text-xs font-mono">Start the server: <code className="text-accent">cd server && npm start</code></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Receiver;
