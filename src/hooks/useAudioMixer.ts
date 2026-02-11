import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAudioMixerReturn {
  mixedStream: MediaStream | null;
  connectMic: (stream: MediaStream) => void;
  disconnectMic: () => void;
  connectElement: (audio: HTMLAudioElement) => void;
  setMicVolume: (v: number) => void;
  setMicMuted: (muted: boolean) => void;
  setListening: (on: boolean) => void;
  setCueMode: (on: boolean) => void;
}

/**
 * Audio routing graph:
 *
 *   micSource → micGain → broadcastBus
 *   soundboardBus → sbToBroadcastGain → broadcastBus
 *   soundboardBus → sbLocalGain → ctx.destination
 *   broadcastBus → dest (→ mixedStream → WebRTC)
 *   broadcastBus → listenGain → ctx.destination
 *
 * Gain state table:
 *   Default  (listen OFF, cue OFF): micGain=vol, broadcastBus=1, sbToBroadcast=1, sbLocal=1, listen=0
 *   Listen ON (cue OFF):            micGain=vol, broadcastBus=1, sbToBroadcast=1, sbLocal=0, listen=1
 *   Cue ON:                         micGain=vol, broadcastBus=0, sbToBroadcast=0, sbLocal=1, listen=0
 *                                   (nothing reaches receiver; soundboard plays locally only)
 */
export function useAudioMixer(): UseAudioMixerReturn {
  const ctxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const connectedElements = useRef<WeakSet<HTMLAudioElement>>(new WeakSet());
  const [mixedStream, setMixedStream] = useState<MediaStream | null>(null);

  // Gain node refs
  const micGainRef = useRef<GainNode | null>(null);
  const broadcastBusRef = useRef<GainNode | null>(null);
  const soundboardBusRef = useRef<GainNode | null>(null);
  const sbToBroadcastGainRef = useRef<GainNode | null>(null);
  const sbLocalGainRef = useRef<GainNode | null>(null);
  const listenGainRef = useRef<GainNode | null>(null);

  // Track current mic volume for mute/unmute restore
  const micVolumeRef = useRef(1);

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
    const micGain = ctx.createGain(); // mic volume / mute
    const sbToBroadcastGain = ctx.createGain(); // 0 in cue mode
    const sbLocalGain = ctx.createGain(); // soundboard → local speakers
    const listenGain = ctx.createGain(); // broadcast → local speakers

    // Default gains
    micGain.gain.value = 1;
    broadcastBus.gain.value = 1;
    soundboardBus.gain.value = 1;
    sbToBroadcastGain.gain.value = 1;
    sbLocalGain.gain.value = 1;
    listenGain.gain.value = 0; // listen off by default

    // Wire the graph
    // micGain → broadcastBus (connected when mic is added)
    // soundboardBus → sbToBroadcastGain → broadcastBus
    soundboardBus.connect(sbToBroadcastGain);
    sbToBroadcastGain.connect(broadcastBus);
    // soundboardBus → sbLocalGain → ctx.destination
    soundboardBus.connect(sbLocalGain);
    sbLocalGain.connect(ctx.destination);
    // broadcastBus → dest (WebRTC output)
    broadcastBus.connect(dest);
    // broadcastBus → listenGain → ctx.destination
    broadcastBus.connect(listenGain);
    listenGain.connect(ctx.destination);

    // Store refs
    ctxRef.current = ctx;
    destRef.current = dest;
    broadcastBusRef.current = broadcastBus;
    soundboardBusRef.current = soundboardBus;
    micGainRef.current = micGain;
    sbToBroadcastGainRef.current = sbToBroadcastGain;
    sbLocalGainRef.current = sbLocalGain;
    listenGainRef.current = listenGain;

    setMixedStream(dest.stream);

    return { ctx, dest, broadcastBus, soundboardBus, micGain };
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
      micGain.connect(broadcastBusRef.current!);
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

  const connectElement = useCallback(
    (audio: HTMLAudioElement) => {
      // Guard against double-connecting the same element
      if (connectedElements.current.has(audio)) return;

      const { ctx, soundboardBus } = ensureContext();
      const source = ctx.createMediaElementSource(audio);

      // Route to soundboard bus (which fans out to broadcast + local via gain nodes)
      source.connect(soundboardBus);

      connectedElements.current.add(audio);
    },
    [ensureContext],
  );

  // --- Control methods ---

  const setMicVolume = useCallback((v: number) => {
    micVolumeRef.current = v;
    if (micGainRef.current) {
      micGainRef.current.gain.value = v;
    }
  }, []);

  const setMicMuted = useCallback((muted: boolean) => {
    if (micGainRef.current) {
      micGainRef.current.gain.value = muted ? 0 : micVolumeRef.current;
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
    // Mute the entire broadcast output in cue mode so receiver hears nothing
    if (broadcastBusRef.current) {
      broadcastBusRef.current.gain.value = on ? 0 : 1;
    }
    if (sbToBroadcastGainRef.current) {
      sbToBroadcastGainRef.current.gain.value = on ? 0 : 1;
    }
    // In cue mode: sbLocal=1 (hear soundboard locally)
    // When cue off: defer to the listen state set by setListening
    if (on) {
      if (sbLocalGainRef.current) {
        sbLocalGainRef.current.gain.value = 1;
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      micSourceRef.current?.disconnect();
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
    setMicVolume,
    setMicMuted,
    setListening,
    setCueMode,
  };
}
