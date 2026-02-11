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
import { Copy, Mic, MicOff, Radio, Headphones, Clock } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAudioMixer } from '@/hooks/useAudioMixer';
import { useMicEffects } from '@/hooks/useMicEffects';
import { SoundBoard } from '@/components/SoundBoard';
import { EffectsBoard } from '@/components/EffectsBoard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Footer } from '@/components/Footer';

const WS_URL = import.meta.env.VITE_WS_URL || (
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}`
    : `ws://${window.location.hostname}:3001`
);

const Broadcaster = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isOnAir, setIsOnAir] = useState(false);
  const [copied, setCopied] = useState(false);
  const [micVolume, setMicVolume] = useState(100);
  const [micMuted, setMicMuted] = useState(false);
  const [listening, setListening] = useState(false);
  const [cueMode, setCueMode] = useState(false);
  const [limiterDb, setLimiterDb] = useState<0 | -3 | -6 | -12>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const addLog = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    setLogs((prev) => [...prev.slice(-100), createLogEntry(msg, level)]);
  }, []);

  const signaling = useSignaling(WS_URL);
  const webrtc = useWebRTC(signaling, 'broadcaster');
  const mixer = useAudioMixer();
  const micEffects = useMicEffects();
  const audioAnalysis = useAudioAnalyser(mixer.mixedStream);

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
        addLog(`Found ${audioInputs.length} audio input${audioInputs.length !== 1 ? 's' : ''}`);
      } catch (e) {
        addLog('Couldn\'t find audio devices — check permissions', 'error');
      }
    }
    getDevices();
  }, [addLog, selectedDevice]);

  const statusLabels: Record<ConnectionStatus, string> = {
    idle: 'Ready',
    connecting: 'Setting up broadcast…',
    'on-air': 'You\'re on air',
    receiving: 'Receiving',
    disconnected: 'Disconnected',
    error: 'Something went wrong',
  };

  // Connect signaling
  useEffect(() => {
    signaling.connect();
    addLog('Connecting…');
    return () => signaling.disconnect();
  }, []);

  useEffect(() => {
    if (signaling.connected) addLog('Connected to server');
  }, [signaling.connected]);

  // Log status changes
  const prevStatus = useRef<ConnectionStatus>('idle');
  useEffect(() => {
    if (webrtc.status !== prevStatus.current) {
      addLog(statusLabels[webrtc.status] || webrtc.status);
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
      mixer.connectMic(stream);

      // Insert effects chain between micGain and broadcastBus
      const nodes = mixer.getNodes();
      if (nodes) {
        micEffects.insertIntoChain(nodes.ctx, nodes.micGain, nodes.broadcastBus);
      }

      addLog('Mic connected');

      // Create room first if needed
      if (!webrtc.roomId) {
        webrtc.createRoom();
        addLog('Setting up room…');
      }

      broadcastStartedRef.current = false;
      setIsOnAir(true);
    } catch (e) {
      addLog('Couldn\'t start broadcast — check mic permissions', 'error');
    }
  };

  // Start broadcast once room is ready and we have a mixed stream
  useEffect(() => {
    if (isOnAir && mixer.mixedStream && webrtc.roomId && !broadcastStartedRef.current) {
      broadcastStartedRef.current = true;
      webrtc.startBroadcast(mixer.mixedStream);
      addLog('You\'re live!');
    }
    if (!isOnAir) {
      broadcastStartedRef.current = false;
    }
  }, [isOnAir, mixer.mixedStream, webrtc.roomId, webrtc.startBroadcast, addLog]);

  const handleEndBroadcast = () => {
    micEffects.removeFromChain();
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    mixer.disconnectMic();
    webrtc.stop();
    setIsOnAir(false);
    addLog('Off air');
  };

  // --- Mixer control handlers ---

  const handleMicVolumeChange = (v: number) => {
    setMicVolume(v);
    if (!micMuted) {
      mixer.setMicVolume(v / 100);
    }
  };

  const handleToggleMute = () => {
    const newMuted = !micMuted;
    setMicMuted(newMuted);
    mixer.setMicMuted(newMuted);
    addLog(newMuted ? 'Mic muted' : 'Mic unmuted');
  };

  const handleToggleListen = () => {
    const newListening = !listening;
    setListening(newListening);
    mixer.setListening(newListening);
    addLog(newListening ? 'Listen on' : 'Listen off');
  };

  const handleToggleCue = () => {
    const newCue = !cueMode;
    setCueMode(newCue);
    mixer.setCueMode(newCue);
    if (newCue) {
      // Cue on → auto-enable listen
      setListening(true);
      addLog('Cue mode on — previewing locally');
    } else {
      // Cue off → auto-disable listen
      setListening(false);
      mixer.setListening(false);
      addLog('Cue mode off — back on air');
    }
  };

  const handleLimiterChange = (value: string) => {
    const db = Number(value) as 0 | -3 | -6 | -12;
    setLimiterDb(db);
    mixer.setLimiterThreshold(db);
    addLog(`Limiter set to ${db} dB`);
  };

  // Reset controls when going off air
  useEffect(() => {
    if (!isOnAir) {
      setMicVolume(100);
      setMicMuted(false);
      setListening(false);
      setCueMode(false);
      setLimiterDb(0);
      setElapsedSeconds(0);
    }
  }, [isOnAir]);

  // Broadcast timer
  useEffect(() => {
    if (!isOnAir) return;
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isOnAir]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
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
    <div className="min-h-[100dvh] bg-background flex flex-col">
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
          <Select
            value={selectedDevice}
            onValueChange={setSelectedDevice}
            disabled={isOnAir}
          >
            <SelectTrigger className="w-full bg-input border-border font-mono text-sm">
              <SelectValue placeholder="Select audio device…" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d.deviceId} value={d.deviceId} className="font-mono text-sm">
                  {d.label || `Device ${d.deviceId.slice(0, 8)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Level meter */}
        <LevelMeter
          left={audioAnalysis.left}
          right={audioAnalysis.right}
          label="Input Level"
        />

        {/* Broadcast timer */}
        {isOnAir && (
          <div className="flex items-center justify-center gap-2 text-sm font-mono text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular-nums">{formatTime(elapsedSeconds)}</span>
          </div>
        )}

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

        {/* Mixer controls — visible when on air */}
        {isOnAir && (
          <div className="panel">
            <div className="panel-header">Mixer Controls</div>
            <div className="flex items-center gap-4">
              {/* Mic volume */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground shrink-0">
                  Mic
                </span>
                <Slider
                  value={[micVolume]}
                  onValueChange={([v]) => handleMicVolumeChange(v)}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right shrink-0">
                  {micMuted ? '—' : `${micVolume}%`}
                </span>
              </div>

              {/* Mute mic */}
              <button
                onClick={handleToggleMute}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  micMuted
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                title={micMuted ? 'Unmute mic' : 'Mute mic'}
              >
                <MicOff className="h-3.5 w-3.5" />
                Mute
              </button>

              {/* Listen */}
              <button
                onClick={handleToggleListen}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  listening
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                title={listening ? 'Stop listening' : 'Listen to broadcast'}
              >
                <Headphones className="h-3.5 w-3.5" />
                Listen
              </button>

              {/* Cue */}
              <button
                onClick={handleToggleCue}
                className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                  cueMode
                    ? 'bg-accent/20 text-accent'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                title={cueMode ? 'Cue mode on — soundboard is local only' : 'Enable cue mode'}
              >
                CUE
              </button>

              {/* Limiter */}
              <div className="shrink-0 flex items-center gap-1.5">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Limit</span>
                <Select value={String(limiterDb)} onValueChange={handleLimiterChange}>
                  <SelectTrigger className="w-[80px] h-7 bg-secondary border-border text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" className="text-xs font-mono">0 dB</SelectItem>
                    <SelectItem value="-3" className="text-xs font-mono">-3 dB</SelectItem>
                    <SelectItem value="-6" className="text-xs font-mono">-6 dB</SelectItem>
                    <SelectItem value="-12" className="text-xs font-mono">-12 dB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Soundboard / Effects */}
        <div className="panel">
          <Tabs defaultValue="sounds">
            <TabsList className="w-full mb-3">
              <TabsTrigger value="sounds" className="flex-1">Sounds</TabsTrigger>
              <TabsTrigger value="effects" className="flex-1">Effects</TabsTrigger>
            </TabsList>
            <TabsContent value="sounds">
              <SoundBoard connectElement={mixer.connectElement} />
            </TabsContent>
            <TabsContent value="effects">
              <EffectsBoard
                effects={micEffects.effects}
                onToggle={micEffects.toggleEffect}
                onUpdate={micEffects.updateEffect}
              />
            </TabsContent>
          </Tabs>
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
      </div>

      <Footer />
    </div>
  );
};

export default Broadcaster;
