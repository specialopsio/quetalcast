import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '@/lib/auth';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC, type ConnectionStatus } from '@/hooks/useWebRTC';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { StatusBar } from '@/components/StatusBar';
import { LevelMeter } from '@/components/LevelMeter';
import { HealthPanel } from '@/components/HealthPanel';
import { EventLog, createLogEntry, type LogEntry } from '@/components/EventLog';
import { Copy, Mic, MicOff, Radio } from 'lucide-react';

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3001`;

const Broadcaster = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isOnAir, setIsOnAir] = useState(false);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const addLog = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    setLogs((prev) => [...prev.slice(-100), createLogEntry(msg, level)]);
  }, []);

  const signaling = useSignaling(WS_URL);
  const webrtc = useWebRTC(signaling, 'broadcaster');
  const audioAnalysis = useAudioAnalyser(localStream);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated()) navigate('/login');
  }, [navigate]);

  // Enumerate devices
  useEffect(() => {
    async function getDevices() {
      try {
        // Need permission first to get labels
        const tempStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        tempStream.getTracks().forEach((t) => t.stop());

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((d) => d.kind === 'audioinput');
        setDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedDevice) {
          setSelectedDevice(audioInputs[0].deviceId);
        }
        addLog(`Found ${audioInputs.length} audio input device(s)`);
      } catch (e) {
        addLog('Failed to enumerate devices: ' + (e as Error).message, 'error');
      }
    }
    getDevices();
  }, [addLog, selectedDevice]);

  // Connect signaling
  useEffect(() => {
    signaling.connect();
    addLog('Connecting to signaling server…');
    return () => signaling.disconnect();
  }, []);

  useEffect(() => {
    if (signaling.connected) addLog('Signaling connected');
  }, [signaling.connected]);

  // Log status changes
  const prevStatus = useRef<ConnectionStatus>('idle');
  useEffect(() => {
    if (webrtc.status !== prevStatus.current) {
      addLog(`Status: ${webrtc.status}`);
      prevStatus.current = webrtc.status;
    }
  }, [webrtc.status, addLog]);

  const broadcastStartedRef = useRef(false);

  const handleGoOnAir = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      addLog('Audio capture started');

      // Create room first if needed
      if (!webrtc.roomId) {
        webrtc.createRoom();
        addLog('Creating room…');
      }

      broadcastStartedRef.current = false;
      setIsOnAir(true);
    } catch (e) {
      addLog('Failed to start broadcast: ' + (e as Error).message, 'error');
    }
  };

  // Start broadcast once room is ready and we have a stream
  useEffect(() => {
    if (isOnAir && localStream && webrtc.roomId && !broadcastStartedRef.current) {
      broadcastStartedRef.current = true;
      webrtc.startBroadcast(localStream);
      addLog('Broadcast started');
    }
    if (!isOnAir) {
      broadcastStartedRef.current = false;
    }
  }, [isOnAir, localStream, webrtc.roomId, webrtc.startBroadcast, addLog]);

  const handleEndBroadcast = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    webrtc.stop();
    setIsOnAir(false);
    addLog('Broadcast ended');
  };

  const copyReceiverLink = () => {
    if (webrtc.roomId) {
      const link = `${window.location.origin}/receive/${webrtc.roomId}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      addLog('Receiver link copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StatusBar status={webrtc.status} roomId={webrtc.roomId} />

      <div className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Broadcaster
          </h1>
          {webrtc.roomId && (
            <button
              onClick={copyReceiverLink}
              className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors bg-secondary px-3 py-1.5 rounded-md"
            >
              <Copy className="h-3 w-3" />
              {copied ? 'Copied!' : 'Copy Receiver Link'}
            </button>
          )}
        </div>

        {/* Device select */}
        <div className="panel">
          <div className="panel-header">Audio Input</div>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            disabled={isOnAir}
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Device ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Level meter */}
        <LevelMeter
          level={audioAnalysis.level}
          peak={audioAnalysis.peak}
          clipping={audioAnalysis.clipping}
          label="Input Level"
        />

        {/* Controls */}
        <div className="flex gap-3">
          <button
            onClick={handleGoOnAir}
            disabled={isOnAir || !signaling.connected}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-md text-sm font-semibold transition-all ${
              isOnAir
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:opacity-90 animate-pulse-on-air'
            }`}
          >
            <Mic className="h-5 w-5" />
            {isOnAir ? 'On Air' : 'Go On Air'}
          </button>
          <button
            onClick={handleEndBroadcast}
            disabled={!isOnAir}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-md text-sm font-semibold transition-all ${
              !isOnAir
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-destructive text-destructive-foreground hover:opacity-90'
            }`}
          >
            <MicOff className="h-5 w-5" />
            End Broadcast
          </button>
        </div>

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

export default Broadcaster;
