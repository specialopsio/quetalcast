import { useCallback, useEffect, useRef, useState } from 'react';

export type LimiterThreshold = 0 | -3 | -6 | -12;

export interface UseAudioMixerReturn {
  mixedStream: MediaStream | null;
  connectMic: (stream: MediaStream) => void;
  disconnectMic: () => void;
  connectElement: (audio: HTMLAudioElement) => GainNode | null;
  connectSystemAudio: (stream: MediaStream) => void;
  disconnectSystemAudio: () => void;
  setSystemAudioVolume: (v: number) => void;
  setMicVolume: (v: number) => void;
  setPadsVolume: (v: number) => void;
  setMicMuted: (muted: boolean) => void;
  setMicPan: (pan: number) => void;
  setSystemAudioPan: (pan: number) => void;
  setPadsPan: (pan: number) => void;
  setListening: (on: boolean) => void;
  setCueMode: (on: boolean) => void;
  setLimiterThreshold: (db: LimiterThreshold) => void;
  getChannelLevels: () => { mic: number; system: number; pads: number };
  getNodes: () => { ctx: AudioContext; micGain: GainNode; broadcastBus: GainNode; micVolumeGain: GainNode } | null;
}

/**
 * Audio routing graph:
 *
 *   micSource → micGain (mute) → [effects] → micVolumeGain (volume) → broadcastBus
 *   sysAudioSource → sysAudioGain → broadcastBus
 *   soundboardBus → sbToBroadcastGain → broadcastBus
 *   soundboardBus → sbLocalGain → ctx.destination
 *   broadcastBus → broadcastOutGain → limiter → clipper → dest (→ mixedStream → WebRTC)
 *   broadcastBus → listenGain → ctx.destination
 *
 * Gain state table:
 *   Default  (listen OFF, cue OFF): micGain=vol, broadcastOutGain=1, sbToBroadcast=1, sbLocal=1, listen=0
 *   Listen ON (cue OFF):            micGain=vol, broadcastOutGain=1, sbToBroadcast=1, sbLocal=0, listen=1
 *   Cue ON:                         micGain=vol, broadcastOutGain=0, sbToBroadcast=0, sbLocal=1, listen=1
 *                                   (nothing reaches receiver; soundboard + mic/effects play locally)
 */
export function useAudioMixer(): UseAudioMixerReturn {
  const ctxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sysAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sysAudioGainRef = useRef<GainNode | null>(null);
  const sysAudioPanRef = useRef<StereoPannerNode | null>(null);
  const sysAudioStreamRef = useRef<MediaStream | null>(null);
  const connectedElements = useRef<WeakSet<HTMLAudioElement>>(new WeakSet());
  const [mixedStream, setMixedStream] = useState<MediaStream | null>(null);

  // Gain node refs
  const micGainRef = useRef<GainNode | null>(null);
  const micVolumeGainRef = useRef<GainNode | null>(null);
  const micPanRef = useRef<StereoPannerNode | null>(null);
  const broadcastBusRef = useRef<GainNode | null>(null);
  const soundboardBusRef = useRef<GainNode | null>(null);
  const padsVolumeGainRef = useRef<GainNode | null>(null);
  const padsPanRef = useRef<StereoPannerNode | null>(null);
  const sbToBroadcastGainRef = useRef<GainNode | null>(null);
  const sbLocalGainRef = useRef<GainNode | null>(null);
  const listenGainRef = useRef<GainNode | null>(null);
  const broadcastOutGainRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const clipperRef = useRef<WaveShaperNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const padsAnalyserRef = useRef<AnalyserNode | null>(null);
  const systemAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnalyserDataRef = useRef<Uint8Array | null>(null);
  const padsAnalyserDataRef = useRef<Uint8Array | null>(null);
  const systemAnalyserDataRef = useRef<Uint8Array | null>(null);

  // Track current mic volume for mute/unmute restore
  const micVolumeRef = useRef(1);

  /** Build a hard-clip transfer curve that caps amplitude at the given dBFS threshold */
  const buildClipCurve = useCallback((thresholdDb: number): Float32Array => {
    const samples = 8192;
    const curve = new Float32Array(samples);
    const ceiling = thresholdDb >= 0 ? 1.0 : Math.pow(10, thresholdDb / 20);
    for (let i = 0; i < samples; i++) {
      const x = (2 * i) / (samples - 1) - 1; // -1 to 1
      curve[i] = Math.max(-ceiling, Math.min(ceiling, x));
    }
    return curve;
  }, []);

  // Lazily initialise the AudioContext + full gain node graph
  const ensureContext = useCallback(() => {
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      if (ctxRef.current.state === 'suspended') {
        ctxRef.current.resume();
      }
      return {
        ctx: ctxRef.current,
        dest: destRef.current!,
        broadcastBus: broadcastBusRef.current!,
        soundboardBus: soundboardBusRef.current!,
        micGain: micGainRef.current!,
      };
    }

    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();

    // Create gain nodes
    const broadcastBus = ctx.createGain(); // unity, merges mic + soundboard
    const soundboardBus = ctx.createGain(); // unity, all soundboard elements connect here
    const micGain = ctx.createGain(); // mute only (0 or 1)
    const micVolumeGain = ctx.createGain(); // mic volume — after effects so it's the final control
    const micPan = ctx.createStereoPanner();
    const sbToBroadcastGain = ctx.createGain(); // 0 in cue mode
    const sbLocalGain = ctx.createGain(); // soundboard → local speakers
    const padsVolumeGain = ctx.createGain();
    const padsPan = ctx.createStereoPanner();
    const listenGain = ctx.createGain(); // broadcast → local speakers
    const broadcastOutGain = ctx.createGain(); // gates audio to WebRTC (0 in cue mode)
    const micAnalyser = ctx.createAnalyser();
    const padsAnalyser = ctx.createAnalyser();
    micAnalyser.fftSize = 256;
    micAnalyser.smoothingTimeConstant = 0.7;
    padsAnalyser.fftSize = 256;
    padsAnalyser.smoothingTimeConstant = 0.7;

    // Force broadcastBus to always process in stereo so a mono mic
    // is properly upmixed to both L and R channels before output.
    broadcastBus.channelCount = 2;
    broadcastBus.channelCountMode = 'explicit';

    // Default gains
    micGain.gain.value = 1;
    micVolumeGain.gain.value = 1;
    micPan.pan.value = 0;
    broadcastBus.gain.value = 1;
    soundboardBus.gain.value = 1;
    padsVolumeGain.gain.value = 1;
    padsPan.pan.value = 0;
    sbToBroadcastGain.gain.value = 1;
    sbLocalGain.gain.value = 1;
    listenGain.gain.value = 0; // listen off by default
    broadcastOutGain.gain.value = 1;

    // Output limiter: compressor (smooth gain reduction) + clipper (hard ceiling)
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = 0;   // default: limit at 0 dBFS
    limiter.knee.value = 0;        // hard knee
    limiter.ratio.value = 20;      // aggressive ratio
    limiter.attack.value = 0;      // fastest possible attack
    limiter.release.value = 0.05;  // 50ms release

    // Hard clipper — guarantees nothing exceeds the threshold
    const clipper = ctx.createWaveShaper();
    clipper.curve = buildClipCurve(0);
    clipper.oversample = '4x'; // reduce aliasing from clipping

    // Wire the graph
    // micVolumeGain → micPan → broadcastBus (mic path always goes through volume + pan)
    micVolumeGain.connect(micPan);
    micPan.connect(broadcastBus);
    micPan.connect(micAnalyser);
    // micGain → micVolumeGain (connected when mic is added)
    // soundboardBus → padsVolumeGain → padsPan → (broadcast + local)
    soundboardBus.connect(padsVolumeGain);
    padsVolumeGain.connect(padsPan);
    // padsPan → sbToBroadcastGain → broadcastBus
    padsPan.connect(sbToBroadcastGain);
    sbToBroadcastGain.connect(broadcastBus);
    padsPan.connect(padsAnalyser);
    // padsPan → sbLocalGain → ctx.destination
    padsPan.connect(sbLocalGain);
    sbLocalGain.connect(ctx.destination);
    // broadcastBus → broadcastOutGain → limiter → clipper → dest (WebRTC output)
    broadcastBus.connect(broadcastOutGain);
    broadcastOutGain.connect(limiter);
    limiter.connect(clipper);
    clipper.connect(dest);
    // broadcastBus → listenGain → ctx.destination
    broadcastBus.connect(listenGain);
    listenGain.connect(ctx.destination);

    // Store refs
    ctxRef.current = ctx;
    destRef.current = dest;
    broadcastBusRef.current = broadcastBus;
    soundboardBusRef.current = soundboardBus;
    micGainRef.current = micGain;
    micVolumeGainRef.current = micVolumeGain;
    micPanRef.current = micPan;
    padsVolumeGainRef.current = padsVolumeGain;
    padsPanRef.current = padsPan;
    sbToBroadcastGainRef.current = sbToBroadcastGain;
    sbLocalGainRef.current = sbLocalGain;
    listenGainRef.current = listenGain;
    broadcastOutGainRef.current = broadcastOutGain;
    limiterRef.current = limiter;
    clipperRef.current = clipper;
    micAnalyserRef.current = micAnalyser;
    padsAnalyserRef.current = padsAnalyser;
    micAnalyserDataRef.current = new Uint8Array(micAnalyser.fftSize);
    padsAnalyserDataRef.current = new Uint8Array(padsAnalyser.fftSize);

    setMixedStream(dest.stream);

    return { ctx, dest, broadcastBus, soundboardBus, micGain, micVolumeGain };
  }, []);

  const connectMic = useCallback(
    (stream: MediaStream) => {
      const { ctx, micGain } = ensureContext();

      // Disconnect previous mic source if any
      if (micSourceRef.current) {
        try {
          micSourceRef.current.disconnect();
        } catch {
          // already disconnected
        }
      }

      const source = ctx.createMediaStreamSource(stream);
      source.connect(micGain);
      micGain.connect(micVolumeGainRef.current!);
      micSourceRef.current = source;
    },
    [ensureContext],
  );

  const disconnectMic = useCallback(() => {
    if (micSourceRef.current) {
      try {
        micSourceRef.current.disconnect();
      } catch {
        // already disconnected
      }
      micSourceRef.current = null;
    }
  }, []);

  const connectSystemAudio = useCallback(
    (stream: MediaStream) => {
      const { ctx } = ensureContext();

      // Disconnect previous system audio if any
      if (sysAudioSourceRef.current) {
        try { sysAudioSourceRef.current.disconnect(); } catch {}
      }

      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const analyser = ctx.createAnalyser();
      gain.gain.value = 1;
      pan.pan.value = 0;
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(gain);
      gain.connect(pan);
      pan.connect(broadcastBusRef.current!);
      pan.connect(analyser);

      sysAudioSourceRef.current = source;
      sysAudioGainRef.current = gain;
      sysAudioPanRef.current = pan;
      systemAnalyserRef.current = analyser;
      systemAnalyserDataRef.current = new Uint8Array(analyser.fftSize);
      sysAudioStreamRef.current = stream;

      // If the system audio track ends (user stops sharing), clean up
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.addEventListener('ended', () => {
          disconnectSystemAudioInternal();
        });
      }
    },
    [ensureContext],
  );

  const disconnectSystemAudioInternal = useCallback(() => {
    if (sysAudioSourceRef.current) {
      try { sysAudioSourceRef.current.disconnect(); } catch {}
      sysAudioSourceRef.current = null;
    }
    if (sysAudioGainRef.current) {
      sysAudioGainRef.current = null;
    }
    if (sysAudioPanRef.current) {
      sysAudioPanRef.current = null;
    }
    if (systemAnalyserRef.current) {
      systemAnalyserRef.current = null;
    }
    if (systemAnalyserDataRef.current) {
      systemAnalyserDataRef.current = null;
    }
    if (sysAudioStreamRef.current) {
      sysAudioStreamRef.current.getTracks().forEach(t => t.stop());
      sysAudioStreamRef.current = null;
    }
  }, []);

  const disconnectSystemAudio = disconnectSystemAudioInternal;

  const setSystemAudioVolume = useCallback((v: number) => {
    if (sysAudioGainRef.current) {
      sysAudioGainRef.current.gain.value = v;
    }
  }, []);

  const setSystemAudioPan = useCallback((pan: number) => {
    if (sysAudioPanRef.current) {
      sysAudioPanRef.current.pan.value = Math.max(-1, Math.min(1, pan));
    }
  }, []);

  const connectElement = useCallback(
    (audio: HTMLAudioElement): GainNode | null => {
      // Guard against double-connecting the same element
      if (connectedElements.current.has(audio)) return null;

      const { ctx, soundboardBus } = ensureContext();
      const source = ctx.createMediaElementSource(audio);

      // Insert a per-element gain node for volume control (supports >1.0 for boost)
      const elementGain = ctx.createGain();
      elementGain.gain.value = 1;
      source.connect(elementGain);
      elementGain.connect(soundboardBus);

      connectedElements.current.add(audio);
      return elementGain;
    },
    [ensureContext],
  );

  // --- Control methods ---

  const setMicVolume = useCallback((v: number) => {
    micVolumeRef.current = v;
    if (micVolumeGainRef.current) {
      micVolumeGainRef.current.gain.value = v;
    }
  }, []);

  const setMicPan = useCallback((pan: number) => {
    if (micPanRef.current) {
      micPanRef.current.pan.value = Math.max(-1, Math.min(1, pan));
    }
  }, []);

  const setPadsVolume = useCallback((v: number) => {
    if (padsVolumeGainRef.current) {
      padsVolumeGainRef.current.gain.value = v;
    }
  }, []);

  const setPadsPan = useCallback((pan: number) => {
    if (padsPanRef.current) {
      padsPanRef.current.pan.value = Math.max(-1, Math.min(1, pan));
    }
  }, []);

  const setMicMuted = useCallback((muted: boolean) => {
    if (micGainRef.current) {
      micGainRef.current.gain.value = muted ? 0 : 1;
    }
  }, []);

  const setListening = useCallback((on: boolean) => {
    if (listenGainRef.current) {
      listenGainRef.current.gain.value = on ? 1 : 0;
    }
    // sbLocalGain rule: on when (cueMode || !listening)
    // Since we don't track cueMode here, Broadcaster.tsx will call
    // both setListening and setCueMode to keep gains in sync.
    // For standalone listen toggle (no cue): sbLocal = inverse of listen
    if (sbLocalGainRef.current) {
      sbLocalGainRef.current.gain.value = on ? 0 : 1;
    }
  }, []);

  const setCueMode = useCallback((on: boolean) => {
    // Mute only the WebRTC output path in cue mode — broadcastBus stays live
    // so mic + effects can still be monitored locally via listenGain.
    if (broadcastOutGainRef.current) {
      broadcastOutGainRef.current.gain.value = on ? 0 : 1;
    }
    if (sbToBroadcastGainRef.current) {
      sbToBroadcastGainRef.current.gain.value = on ? 0 : 1;
    }
    if (on) {
      // Enable local monitoring for mic/effects and soundboard
      if (listenGainRef.current) {
        listenGainRef.current.gain.value = 1;
      }
      if (sbLocalGainRef.current) {
        sbLocalGainRef.current.gain.value = 1;
      }
    }
    // When cue off: defer to the listen state set by setListening
  }, []);

  const setLimiterThreshold = useCallback((db: LimiterThreshold) => {
    if (limiterRef.current) {
      limiterRef.current.threshold.value = db;
    }
    if (clipperRef.current) {
      clipperRef.current.curve = buildClipCurve(db);
    }
  }, [buildClipCurve]);

  const analyserLevel = useCallback((analyser: AnalyserNode | null, data: Uint8Array | null): number => {
    if (!analyser || !data) return 0;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / data.length);
    if (rms <= 0) return 0;
    // Use dB-like scaling so mini LEDs track the main meter feel more closely.
    const db = Math.max(-60, 20 * Math.log10(rms));
    return Math.max(0, Math.min(1, (db + 60) / 60));
  }, []);

  const getChannelLevels = useCallback(() => {
    return {
      mic: analyserLevel(micAnalyserRef.current, micAnalyserDataRef.current),
      system: analyserLevel(systemAnalyserRef.current, systemAnalyserDataRef.current),
      pads: analyserLevel(padsAnalyserRef.current, padsAnalyserDataRef.current),
    };
  }, [analyserLevel]);

  /** Expose internal nodes so the effects chain can wire itself in */
  const getNodes = useCallback(() => {
    if (!ctxRef.current || !micGainRef.current || !micVolumeGainRef.current || !broadcastBusRef.current) return null;
    return {
      ctx: ctxRef.current,
      micGain: micGainRef.current,
      broadcastBus: broadcastBusRef.current,
      micVolumeGain: micVolumeGainRef.current,
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      micSourceRef.current?.disconnect();
      sysAudioSourceRef.current?.disconnect();
      sysAudioStreamRef.current?.getTracks().forEach(t => t.stop());
      ctxRef.current?.close();
      ctxRef.current = null;
      destRef.current = null;
    };
  }, []);

  return {
    mixedStream,
    connectMic,
    disconnectMic,
    connectElement,
    connectSystemAudio,
    disconnectSystemAudio,
    setSystemAudioVolume,
    setMicVolume,
    setPadsVolume,
    setMicMuted,
    setMicPan,
    setSystemAudioPan,
    setPadsPan,
    setListening,
    setCueMode,
    setLimiterThreshold,
    getChannelLevels,
    getNodes,
  };
}
