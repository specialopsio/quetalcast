import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAuthenticated, verifySession } from '@/lib/auth';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC, type ConnectionStatus, type AudioQuality } from '@/hooks/useWebRTC';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { StatusBar } from '@/components/StatusBar';
import { LevelMeter } from '@/components/LevelMeter';
import { HealthPanel } from '@/components/HealthPanel';
import { EventLog, createLogEntry, type LogEntry } from '@/components/EventLog';
import { Copy, Mic, MicOff, Radio, Headphones, Music, Sparkles, Zap, Plug2, Circle, Square, Keyboard, Monitor, MonitorOff, Download, SlidersHorizontal } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
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
import { NowPlayingInput, type NowPlayingMeta, type TrackMeta } from '@/components/NowPlayingInput';
import { TrackList, type Track } from '@/components/TrackList';
import { EffectsBoard } from '@/components/EffectsBoard';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Footer } from '@/components/Footer';
import { ChatPanel } from '@/components/ChatPanel';
import { IntegrationsSheet } from '@/components/IntegrationsSheet';
import { useIntegrationStream } from '@/hooks/useIntegrationStream';
import { getIntegration, type IntegrationConfig } from '@/lib/integrations';
import { getPresets, savePreset, deletePreset, type Preset } from '@/lib/presets';
import { type EffectName, CHAIN_ORDER } from '@/hooks/useMicEffects';
import { useRecorder } from '@/hooks/useRecorder';
import { useKeyboardShortcuts, SHORTCUT_MAP } from '@/hooks/useKeyboardShortcuts';
import { downloadBroadcastZip } from '@/lib/zip-export';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const WS_URL = import.meta.env.VITE_WS_URL || (
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}`
    : `ws://${window.location.hostname}:3001`
);

const Broadcaster = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [boardTab, setBoardTab] = useState('sounds');
  const [listenerCount, setListenerCount] = useState(0);
  const [nowPlaying, setNowPlaying] = useState('');
  const [nowPlayingCover, setNowPlayingCover] = useState<string | undefined>();
  const nowPlayingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trackList, setTrackList] = useState<Track[]>([]);
  const [presets, setPresets] = useState(() => getPresets());
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [qualityMode, setQualityMode] = useState<AudioQuality>('auto');
  const audioRef = useRef<HTMLAudioElement>(null);

  // Integration state
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationConfig | null>(null);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const integrationStream = useIntegrationStream();
  const recorder = useRecorder();
  const soundboardTriggerRef = useRef<((index: number) => void) | null>(null);

  // System audio state
  const [systemAudioActive, setSystemAudioActive] = useState(false);
  const [systemAudioVolume, setSystemAudioVolume] = useState(100);
  const [systemAudioInfoOpen, setSystemAudioInfoOpen] = useState(false);
  const systemAudioStreamRef = useRef<MediaStream | null>(null);

  /** Preview stream for level meter when not on air — so user can dial in before going live */
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  const [startBroadcastDialogOpen, setStartBroadcastDialogOpen] = useState(false);

  const addLog = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    setLogs((prev) => [...prev.slice(-100), createLogEntry(msg, level)]);
  }, []);

  const signaling = useSignaling(WS_URL);
  const webrtc = useWebRTC(signaling, 'broadcaster');
  const mixer = useAudioMixer();
  const micEffects = useMicEffects();
  /** Level meter: use mixer when on air, preview stream when not (so user can dial in before going live) */
  const levelMeterStream = isOnAir ? mixer.mixedStream : previewStream;
  const audioAnalysis = useAudioAnalyser(levelMeterStream);

  // Auth check — verify both local token and server session
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    verifySession().then((valid) => {
      if (!valid) navigate('/login');
    });
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

  // Preview stream for level meter when not on air — user can dial in before going live
  const previewStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    if (isOnAir || !selectedDevice) {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
      setPreviewStream(null);
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId: { exact: selectedDevice },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
        },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        previewStreamRef.current = stream;
        setPreviewStream(stream);
      })
      .catch(() => {
        if (!cancelled) setPreviewStream(null);
      });
    return () => {
      cancelled = true;
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
      setPreviewStream(null);
    };
  }, [isOnAir, selectedDevice]);

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

  // Handle auth errors from signaling — redirect to login
  useEffect(() => {
    const unsub = signaling.subscribe((msg) => {
      if (msg.type === 'error' && msg.code === 'AUTH_REQUIRED') {
        addLog('Session expired — please log in again', 'warn');
        localStorage.removeItem('webrtc-bridge-auth');
        setTimeout(() => navigate('/login'), 500);
      }
    });
    return unsub;
  }, [signaling, navigate, addLog]);

  // Listen for listener count, chat, and track list updates
  useEffect(() => {
    const unsub = signaling.subscribe((msg) => {
      if (msg.type === 'listener-count' && typeof msg.count === 'number') {
        setListenerCount(msg.count as number);
      }
      if (msg.type === 'chat' && typeof msg.text === 'string' && !msg.system) {
        addLog(`${msg.name}: ${msg.text}`, 'chat');
      }
      if (msg.type === 'track-list' && Array.isArray(msg.tracks)) {
        setTrackList(msg.tracks as Track[]);
      }
    });
    return unsub;
  }, [signaling, addLog]);

  // Log status changes
  const prevStatus = useRef<ConnectionStatus>('idle');
  useEffect(() => {
    if (webrtc.status !== prevStatus.current) {
      addLog(statusLabels[webrtc.status] || webrtc.status);
      prevStatus.current = webrtc.status;
    }
  }, [webrtc.status, addLog]);

  // Update URL with room ID when broadcast starts; clear when new broadcast creates new room
  useEffect(() => {
    if (webrtc.roomId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('room', webrtc.roomId!);
        return next;
      }, { replace: true });
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('room');
        if (next.toString() === '') return {};
        return next;
      }, { replace: true });
    }
  }, [webrtc.roomId, setSearchParams]);

  const broadcastStartedRef = useRef(false);
  const recordingAfterBroadcastRef = useRef(false);
  const prevRecordingRef = useRef(false);

  const doGoOnAir = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      mixer.connectMic(stream);

      // Insert effects chain between micGain and broadcastBus
      const nodes = mixer.getNodes();
      if (nodes) {
        await micEffects.insertIntoChain(nodes.ctx, nodes.micGain, nodes.broadcastBus);
      }

      addLog('Mic connected');

      // Always create a new room for each broadcast
      webrtc.createRoom();
      addLog('Setting up room…');
      broadcastStartedRef.current = false;

      if (selectedIntegration) {
        const integrationInfo = getIntegration(selectedIntegration.integrationId);
        addLog(`Connecting to ${integrationInfo?.name || 'integration'}…`);
      }

      setIsOnAir(true);
    } catch (e) {
      addLog('Couldn\'t start broadcast — check mic permissions', 'error');
    }
  }, [mixer, micEffects, webrtc, selectedIntegration, addLog]);

  const handleGoOnAir = useCallback(async () => {
    // Only show dialog when there's actual broadcast content from a previous session,
    // not startup logs (Connecting..., Found audio inputs, etc.)
    const hasTrackList = trackList.length > 0;
    const hasBroadcastEnded = logs.some((e) => e.message.includes('Off air'));
    if (hasTrackList || hasBroadcastEnded) {
      setStartBroadcastDialogOpen(true);
      return;
    }
    await doGoOnAir();
  }, [logs, trackList.length, doGoOnAir]);

  const handleStartBroadcastContinue = useCallback(async () => {
    setLogs([]);
    setTrackList([]);
    setStartBroadcastDialogOpen(false);
    // If recording after broadcast ended, stop recording, wait for completion, then disconnect
    if (recorder.recording || recordingAfterBroadcastRef.current) {
      const blob = await recorder.stopRecordingAndGetBlob();
      recordingAfterBroadcastRef.current = false;
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `broadcast-${timestamp}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      micEffects.removeFromChain();
      localStream?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      mixer.disconnectMic();
      if (systemAudioActive) {
        mixer.disconnectSystemAudio();
        systemAudioStreamRef.current = null;
        setSystemAudioActive(false);
        setSystemAudioVolume(100);
      }
    }
    await doGoOnAir();
  }, [doGoOnAir, recorder, micEffects, mixer, localStream, systemAudioActive]);

  /** Continue previous broadcast — rejoin same room, keep logs & track list */
  const handleContinuePreviousBroadcast = useCallback(async () => {
    const prevRoomId = webrtc.roomId;
    if (!prevRoomId) {
      await doGoOnAir();
      return;
    }
    setStartBroadcastDialogOpen(false);
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      mixer.connectMic(stream);
      const nodes = mixer.getNodes();
      if (nodes) {
        await micEffects.insertIntoChain(nodes.ctx, nodes.micGain, nodes.broadcastBus);
      }
      addLog('Mic connected');
      addLog('Resuming previous broadcast…');
      webrtc.joinRoomAsBroadcaster(prevRoomId);
      broadcastStartedRef.current = false;
      if (selectedIntegration) {
        const integrationInfo = getIntegration(selectedIntegration.integrationId);
        addLog(`Connecting to ${integrationInfo?.name || 'integration'}…`);
      }
      setIsOnAir(true);
    } catch (e) {
      addLog('Couldn\'t resume broadcast — check mic permissions', 'error');
    }
  }, [mixer, micEffects, webrtc, selectedDevice, selectedIntegration, addLog]);

  // Start broadcast once room is ready and we have a mixed stream (native mode)
  useEffect(() => {
    if (isOnAir && !selectedIntegration && mixer.mixedStream && webrtc.roomId && !broadcastStartedRef.current) {
      broadcastStartedRef.current = true;
      webrtc.startBroadcast(mixer.mixedStream);
      addLog('You\'re live!');
    }
    if (!isOnAir) {
      broadcastStartedRef.current = false;
    }
  }, [isOnAir, selectedIntegration, mixer.mixedStream, webrtc.roomId, webrtc.startBroadcast, addLog]);

  // Start integration stream once we have a mixed stream (integration mode)
  const integrationStartedRef = useRef(false);
  useEffect(() => {
    if (isOnAir && selectedIntegration && mixer.mixedStream && !integrationStartedRef.current) {
      integrationStartedRef.current = true;
      integrationStream.startStream(mixer.mixedStream, selectedIntegration, webrtc.roomId).then(() => {
        const integrationInfo = getIntegration(selectedIntegration.integrationId);
        addLog(`Live on ${integrationInfo?.name || 'integration'}!`);
      }).catch(() => {
        addLog('Failed to connect to streaming server', 'error');
        setIsOnAir(false);
      });
    }
    if (!isOnAir) {
      integrationStartedRef.current = false;
    }
  }, [isOnAir, selectedIntegration, mixer.mixedStream, integrationStream, addLog]);

  // Log integration stream errors
  useEffect(() => {
    if (integrationStream.error) {
      addLog(integrationStream.error, 'error');
    }
  }, [integrationStream.error, addLog]);

  // When recording stops after broadcast ended, disconnect mixer/mic
  useEffect(() => {
    const wasRecording = prevRecordingRef.current;
    prevRecordingRef.current = recorder.recording;
    if (wasRecording && !recorder.recording && recordingAfterBroadcastRef.current) {
      recordingAfterBroadcastRef.current = false;
      micEffects.removeFromChain();
      localStream?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      mixer.disconnectMic();
      if (systemAudioActive) {
        mixer.disconnectSystemAudio();
        systemAudioStreamRef.current = null;
        setSystemAudioActive(false);
        setSystemAudioVolume(100);
      }
    }
  }, [recorder.recording, micEffects, mixer, localStream, systemAudioActive]);

  const handleEndBroadcast = () => {
    const wasRecording = recorder.recording;

    // If recording, keep mixer/mic connected so recording continues until user stops
    if (!wasRecording) {
      micEffects.removeFromChain();
      localStream?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      mixer.disconnectMic();

      if (systemAudioActive) {
        mixer.disconnectSystemAudio();
        systemAudioStreamRef.current = null;
        setSystemAudioActive(false);
        setSystemAudioVolume(100);
      }
    } else {
      recordingAfterBroadcastRef.current = true;
      addLog('Recording continues — stop when ready or start a new broadcast');
    }

    webrtc.stop();
    if (selectedIntegration) {
      integrationStream.stopStream();
    }

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

  const handleQualityChange = (value: string) => {
    const q = value as AudioQuality;
    setQualityMode(q);
    webrtc.setAudioQuality(q);
    const labels: Record<AudioQuality, string> = {
      high: 'High quality (510 kbps stereo)',
      auto: 'Auto quality — adapts to connection health',
      low: 'Low bandwidth (32 kbps mono)',
    };
    addLog(labels[q]);
  };

  const handleToggleRecording = async () => {
    if (recorder.recording) {
      recorder.stopRecording();
      addLog('Recording stopped — saving MP3');
    } else if (mixer.mixedStream) {
      try {
        await recorder.startRecording(mixer.mixedStream);
        addLog('Recording started (320 kbps MP3)');
      } catch (e) {
        addLog('Failed to start recording', 'error');
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleApplyPreset = (preset: Preset) => {
    for (const effectName of CHAIN_ORDER) {
      const effectState = preset.effects[effectName];
      if (effectState) {
        if (micEffects.effects[effectName].enabled !== effectState.enabled) {
          micEffects.toggleEffect(effectName);
        }
        for (const [param, value] of Object.entries(effectState.params)) {
          micEffects.updateEffect(effectName, param, value);
        }
      }
    }
    addLog(`Preset loaded: ${preset.name}`);
  };

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    savePreset(name, {
      effects: { ...micEffects.effects } as Record<EffectName, { enabled: boolean; params: Record<string, number> }>,
    });
    setPresets(getPresets());
    setSavePresetOpen(false);
    setNewPresetName('');
    addLog(`Preset saved: ${name}`);
  };

  const handleDeletePreset = (name: string) => {
    deletePreset(name);
    setPresets(getPresets());
    addLog(`Preset deleted: ${name}`);
  };

  const handleNowPlayingChange = (meta: NowPlayingMeta) => {
    setNowPlaying(meta.text);
    setNowPlayingCover(meta.cover);
    // Debounce sending metadata
    if (nowPlayingTimerRef.current) clearTimeout(nowPlayingTimerRef.current);
    nowPlayingTimerRef.current = setTimeout(() => {
      const payload: Record<string, string> = { type: 'metadata', text: meta.text };
      if (meta.cover) payload.cover = meta.cover;
      signaling.send(payload);
    }, 500);
  };

  const handleLimiterChange = (value: string) => {
    const db = Number(value) as 0 | -3 | -6 | -12;
    setLimiterDb(db);
    mixer.setLimiterThreshold(db);
    addLog(`Limiter set to ${db} dB`);
  };

  const handleToggleSystemAudio = () => {
    if (systemAudioActive) {
      // Stop system audio capture
      mixer.disconnectSystemAudio();
      systemAudioStreamRef.current = null;
      setSystemAudioActive(false);
      setSystemAudioVolume(100);
      addLog('System audio stopped');
    } else {
      // Show the info modal first
      setSystemAudioInfoOpen(true);
    }
  };

  const handleSystemAudioConfirm = async () => {
    setSystemAudioInfoOpen(false);
    try {
      // Request system audio via getDisplayMedia.
      // Video is required by browsers, but we request the absolute minimum
      // (1x1 @ 1fps) to avoid GPU/CPU overhead from screen capture encoding.
      // systemAudio: 'include' hints Chrome to offer system audio capture.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          suppressLocalAudioPlayback: false,
          // @ts-expect-error — Chrome 105+ systemAudio hint
          systemAudio: 'include',
        },
        video: {
          width: { ideal: 1 },
          height: { ideal: 1 },
          frameRate: { ideal: 1 },
        },
        // @ts-expect-error — Chrome hints: show entire screen option, exclude current tab
        monitorTypeSurfaces: 'include',
        selfBrowserSurface: 'exclude',
      } as DisplayMediaStreamOptions);

      // Stop the video track immediately — we only need audio
      stream.getVideoTracks().forEach(t => t.stop());

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        toast('No system audio was captured. Make sure to toggle "Share audio" in the dialog.', { duration: 5000 });
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Create a new stream with only the audio track
      const audioOnlyStream = new MediaStream(audioTracks);

      mixer.connectSystemAudio(audioOnlyStream);
      systemAudioStreamRef.current = audioOnlyStream;
      setSystemAudioActive(true);
      addLog('System audio connected');

      // Listen for the track ending (user clicks "Stop sharing" in browser chrome)
      audioTracks[0].addEventListener('ended', () => {
        systemAudioStreamRef.current = null;
        setSystemAudioActive(false);
        setSystemAudioVolume(100);
        addLog('System audio stopped');
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'NotAllowedError') {
        // User cancelled the picker — not an error
        return;
      }
      addLog('Failed to capture system audio', 'error');
      toast('Could not capture system audio. Your browser may not support this feature.', { duration: 4000 });
    }
  };

  const handleSystemAudioVolumeChange = (v: number) => {
    setSystemAudioVolume(v);
    mixer.setSystemAudioVolume(v / 100);
  };

  // Keyboard shortcuts
  const { showHelp, setShowHelp } = useKeyboardShortcuts(isOnAir, {
    onToggleMute: handleToggleMute,
    onToggleRecording: handleToggleRecording,
    onToggleListen: handleToggleListen,
    onToggleCue: handleToggleCue,
    onTriggerPad: (index: number) => soundboardTriggerRef.current?.(index),
  });

  // Reset controls when going off air (keep logs and trackList until new broadcast)
  useEffect(() => {
    if (!isOnAir) {
      setMicVolume(100);
      setMicMuted(false);
      setListening(false);
      setCueMode(false);
      setLimiterDb(0);
      setElapsedSeconds(0);
      setListenerCount(0);
      setNowPlaying('');
      setNowPlayingCover(undefined);
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

  const integrationInfo = selectedIntegration ? getIntegration(selectedIntegration.integrationId) : null;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <StatusBar
        status={selectedIntegration && isOnAir ? 'on-air' : webrtc.status}
        roomId={isOnAir ? webrtc.roomId : null}
        integrationName={isOnAir && integrationInfo ? integrationInfo.name : undefined}
      />

      <div className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              Broadcaster
            </h1>
            {isOnAir && (
              <button
                onClick={() => setShowHelp(true)}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                title="Keyboard shortcuts"
              >
                <Keyboard className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* Before on-air: show Integrations button */}
          {!isOnAir && (
            <button
              onClick={() => setIntegrationsOpen(true)}
              className={`flex items-center gap-1.5 text-xs font-mono transition-colors px-3 py-1.5 rounded-md ${
                selectedIntegration
                  ? 'text-primary bg-primary/10 hover:bg-primary/20'
                  : 'text-muted-foreground hover:text-foreground bg-secondary'
              }`}
            >
              <Plug2 className="h-3 w-3" />
              {selectedIntegration ? integrationInfo?.name : 'Integrations'}
            </button>
          )}
          {/* On-air: show Copy Receiver Link (always — room exists in both modes) */}
          {isOnAir && webrtc.roomId && (
            <div className="flex items-center gap-2">
              {selectedIntegration && integrationInfo && (
                <span className="flex items-center gap-1.5 text-xs font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-md">
                  <Radio className="h-3 w-3" />
                  Streaming on {integrationInfo.name}
                </span>
              )}
              <button
                onClick={copyReceiverLink}
                className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors bg-secondary px-3 py-1.5 rounded-md"
              >
                <Copy className="h-3 w-3" />
                {copied ? 'Copied!' : 'Copy Receiver Link'}
              </button>
            </div>
          )}
        </div>

        {/* Level meter — at top so user can dial in as soon as mic is connected */}
        <LevelMeter
          left={audioAnalysis.left}
          right={audioAnalysis.right}
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
            {isOnAir ? `On Air - ${formatTime(elapsedSeconds)}` : 'Go On Air'}
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

        {/* Mixer controls — visible pre-broadcast for dial-in and level check */}
        <div className="panel !p-0">
            <Accordion type="single" collapsible defaultValue="mixer">
              <AccordionItem value="mixer" className="border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Mixer Controls
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
            {/* Audio input — in mixer so level meter is at top */}
            <div className="mb-4">
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

              {/* Mute mic — only when on air */}
              <button
                onClick={handleToggleMute}
                disabled={!isOnAir}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !isOnAir ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  micMuted
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                title={micMuted ? 'Unmute mic' : 'Mute mic'}
              >
                <MicOff className="h-3.5 w-3.5" />
                Mute
              </button>

              {/* Listen — only when on air */}
              <button
                onClick={handleToggleListen}
                disabled={!isOnAir}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !isOnAir ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  listening
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                title={listening ? 'Stop listening' : 'Listen to broadcast'}
              >
                <Headphones className="h-3.5 w-3.5" />
                Listen
              </button>

              {/* Cue — only when on air */}
              <button
                onClick={handleToggleCue}
                disabled={!isOnAir}
                className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                  !isOnAir ? 'opacity-50 cursor-not-allowed' : ''
                } ${
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
                  <SelectTrigger className="w-[92px] h-7 bg-secondary border-border text-xs font-mono">
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

            {/* System audio — only when on air */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
              <button
                onClick={handleToggleSystemAudio}
                disabled={!isOnAir}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !isOnAir ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  systemAudioActive
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                title={systemAudioActive ? 'Stop system audio' : 'Share system audio'}
              >
                {systemAudioActive ? (
                  <MonitorOff className="h-3.5 w-3.5" />
                ) : (
                  <Monitor className="h-3.5 w-3.5" />
                )}
                {systemAudioActive ? 'Stop System' : 'System Audio'}
              </button>

              {systemAudioActive && (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground shrink-0">
                    Vol
                  </span>
                  <Slider
                    value={[systemAudioVolume]}
                    onValueChange={([v]) => handleSystemAudioVolumeChange(v)}
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right shrink-0">
                    {systemAudioVolume}%
                  </span>
                </div>
              )}

              {!systemAudioActive && (
                <span className="text-[10px] text-muted-foreground">
                  Route desktop / app audio into your broadcast
                </span>
              )}
            </div>

            {/* Audio Quality */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="h-3 w-3" />
                  Audio Quality
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {qualityMode === 'high' && '510 kbps stereo — pristine broadcast quality'}
                  {qualityMode === 'auto' && (
                    <>
                      Adapts to connection health — currently{' '}
                      <span className={webrtc.effectiveQuality === 'high' ? 'text-primary' : 'text-yellow-500'}>
                        {webrtc.effectiveQuality === 'high' ? 'high quality' : 'low bandwidth'}
                      </span>
                    </>
                  )}
                  {qualityMode === 'low' && '32 kbps mono — saves bandwidth on slow connections'}
                </span>
              </div>
              <Select value={qualityMode} onValueChange={handleQualityChange}>
                <SelectTrigger className="w-[92px] h-7 bg-secondary border-border text-xs font-mono shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high" className="text-xs font-mono">High</SelectItem>
                  <SelectItem value="auto" className="text-xs font-mono">Auto</SelectItem>
                  <SelectItem value="low" className="text-xs font-mono">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recording */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Circle className={`h-3 w-3 ${recorder.recording ? 'text-red-500 fill-red-500 animate-pulse' : ''}`} />
                  Record
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {recorder.recording
                    ? `Recording — ${formatTime(recorder.elapsed)} · ${formatFileSize(recorder.encodedBytes)}`
                    : 'Save broadcast as 320 kbps MP3'}
                </span>
              </div>
              <button
                onClick={handleToggleRecording}
                disabled={!isOnAir}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !isOnAir ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  recorder.recording
                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {recorder.recording ? (
                  <>
                    <Square className="h-3 w-3 fill-current" />
                    Stop
                  </>
                ) : (
                  <>
                    <Circle className="h-3 w-3 fill-current" />
                    Record
                  </>
                )}
              </button>
            </div>

                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

        {/* Track List — always visible (like mixer), Now Playing search always shown */}
        <TrackList
          tracks={trackList}
          alwaysShow
          roomId={webrtc.roomId ?? undefined}
          topContent={
            <NowPlayingInput
              value={nowPlaying}
              onChange={handleNowPlayingChange}
              onCommit={(meta: TrackMeta) => {
                if (isOnAir) {
                  signaling.send({ type: 'add-track', ...meta });
                  addLog(`Added to track list: ${meta.text || meta.title || 'Unknown'}`, 'info');
                } else {
                  toast.info('Go on air first to add tracks');
                }
              }}
              disabled={!isOnAir}
            />
          }
        />

        {/* Soundboard / Effects */}
        <div className="panel">
          <Tabs value={boardTab} onValueChange={setBoardTab}>
            <div className="flex items-center justify-between mb-3">
              <div className="panel-header flex items-center gap-1.5 !mb-0">
                {boardTab === 'sounds' ? <Music className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {boardTab === 'sounds' ? 'Soundboard' : 'Effects'}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBoardTab('sounds')}
                  className={`p-1.5 rounded transition-colors ${
                    boardTab === 'sounds'
                      ? 'text-primary'
                      : 'text-muted-foreground/40 hover:text-muted-foreground'
                  }`}
                >
                  <Music className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setBoardTab('effects')}
                  className={`p-1.5 rounded transition-colors ${
                    boardTab === 'effects'
                      ? 'text-primary'
                      : 'text-muted-foreground/40 hover:text-muted-foreground'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>
            </div>
            <TabsContent value="sounds">
              <SoundBoard connectElement={mixer.connectElement} triggerRef={soundboardTriggerRef} />
            </TabsContent>
            <TabsContent value="effects">
              <EffectsBoard
                effects={micEffects.effects}
                onToggle={micEffects.toggleEffect}
                onUpdate={micEffects.updateEffect}
                presets={presets}
                onApplyPreset={handleApplyPreset}
                onSavePresetOpen={() => setSavePresetOpen(true)}
                onDeletePreset={handleDeletePreset}
                onPresetsChange={() => setPresets(getPresets())}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Health + Log — show when on air or when we have previous broadcast data */}
        {(isOnAir || logs.length > 0 || trackList.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HealthPanel
              stats={webrtc.stats}
              connectionState={webrtc.connectionState}
              iceConnectionState={webrtc.iceConnectionState}
              signalingState={webrtc.signalingState}
              peerConnected={webrtc.peerConnected}
              listenerCount={listenerCount}
            />
            <EventLog entries={logs} roomId={webrtc.roomId ?? undefined} />
          </div>
        )}

      </div>

      <Footer />

      <IntegrationsSheet
        open={integrationsOpen}
        onOpenChange={setIntegrationsOpen}
        selectedIntegration={selectedIntegration}
        onSelectIntegration={setSelectedIntegration}
      />

      {/* System audio info modal */}
      <Dialog open={systemAudioInfoOpen} onOpenChange={setSystemAudioInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              System Audio
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              To capture audio from your computer, your browser will ask you to share your screen. This is how browsers provide access to system audio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-1">
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 space-y-2.5">
              <p className="text-sm font-medium text-foreground">When the sharing dialog appears:</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>
                  Select <strong className="text-foreground">"Entire Screen"</strong> to capture all system audio (Spotify, Music, etc.)
                </li>
                <li>
                  Toggle <strong className="text-foreground">"Share system audio"</strong> on — this is the important part
                </li>
                <li>
                  Click <strong className="text-foreground">Share</strong>
                </li>
              </ol>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground/80">
              <span className="shrink-0 mt-0.5">🔒</span>
              <p>
                <strong className="text-muted-foreground">Nothing on your screen is being shared or recorded.</strong>{' '}
                We capture at the lowest possible quality (1x1 pixel) and immediately discard the video — only the audio is mixed into your broadcast.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setSystemAudioInfoOpen(false)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSystemAudioConfirm}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Got it, continue
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Start new broadcast — download/copy previous data before starting */}
      <Dialog open={startBroadcastDialogOpen} onOpenChange={setStartBroadcastDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Broadcast</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              You have logs and/or track list from your previous broadcast. Would you like to download them before starting a new one?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <p className="text-xs text-muted-foreground">
              Logs and track listings remain available in the room link for 24 hours post broadcast. Listeners can still view them and chat.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  let mp3Blob: Blob | null = null;
                  if (recorder.recording) {
                    mp3Blob = await recorder.stopRecordingAndGetBlob();
                    recordingAfterBroadcastRef.current = false;
                    micEffects.removeFromChain();
                    localStream?.getTracks().forEach((t) => t.stop());
                    setLocalStream(null);
                    mixer.disconnectMic();
                    if (systemAudioActive) {
                      mixer.disconnectSystemAudio();
                      systemAudioStreamRef.current = null;
                      setSystemAudioActive(false);
                      setSystemAudioVolume(100);
                    }
                  }
                  await downloadBroadcastZip(logs, trackList, webrtc.roomId ?? undefined, mp3Blob);
                  toast('Download started');
                }}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                <Download className="h-4 w-4" />
                {recorder.recording ? 'Stop Recording & Download ZIP' : 'Download Logs & Track List (ZIP)'}
              </button>
              <button
                onClick={() => {
                  if (webrtc.roomId) {
                    const link = `${window.location.origin}/receive/${webrtc.roomId}`;
                    navigator.clipboard.writeText(link);
                    toast('Room link copied');
                  }
                }}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
              >
                <Copy className="h-4 w-4" />
                Copy Room Link (24h access)
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
            <div className="flex gap-2">
              <button
                onClick={handleContinuePreviousBroadcast}
                className="flex-1 px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-opacity"
              >
                Continue Previous Broadcast
              </button>
              <button
                onClick={handleStartBroadcastContinue}
                className="flex-1 px-4 py-2 rounded-md text-sm font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
              >
                Start New Broadcast
              </button>
            </div>
            <button
              onClick={() => setStartBroadcastDialogOpen(false)}
              className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Save current effects as a preset.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Preset name…"
              maxLength={40}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); }}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSavePreset}
                disabled={newPresetName.trim().length === 0}
                className="bg-primary text-primary-foreground rounded-md px-6 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyboard shortcuts dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Active while on air. Disabled when typing in inputs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {SHORTCUT_MAP.map((s) => (
              <div key={s.key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.description}</span>
                <kbd className="bg-secondary border border-border rounded px-2 py-0.5 text-xs font-mono text-foreground">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat FAB — visible when on air */}
      <ChatPanel signaling={signaling} active={isOnAir} />
    </div>
  );
};

export default Broadcaster;
