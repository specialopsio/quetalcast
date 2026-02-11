import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAudioMixerReturn {
  mixedStream: MediaStream | null;
  connectMic: (stream: MediaStream) => void;
  disconnectMic: () => void;
  connectElement: (audio: HTMLAudioElement) => void;
}

export function useAudioMixer(): UseAudioMixerReturn {
  const ctxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const connectedElements = useRef<WeakSet<HTMLAudioElement>>(new WeakSet());
  const [mixedStream, setMixedStream] = useState<MediaStream | null>(null);

  // Lazily initialise the AudioContext + destination
  const ensureContext = useCallback(() => {
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      if (ctxRef.current.state === 'suspended') {
        ctxRef.current.resume();
      }
      return { ctx: ctxRef.current, dest: destRef.current! };
    }

    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    ctxRef.current = ctx;
    destRef.current = dest;
    setMixedStream(dest.stream);

    return { ctx, dest };
  }, []);

  const connectMic = useCallback(
    (stream: MediaStream) => {
      const { ctx, dest } = ensureContext();

      // Disconnect previous mic source if any
      if (micSourceRef.current) {
        try {
          micSourceRef.current.disconnect();
        } catch {
          // already disconnected
        }
      }

      const source = ctx.createMediaStreamSource(stream);
      source.connect(dest);
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

      const { ctx, dest } = ensureContext();
      const source = ctx.createMediaElementSource(audio);

      // Route to broadcast mix
      source.connect(dest);
      // Route to local speakers so broadcaster can hear it
      source.connect(ctx.destination);

      connectedElements.current.add(audio);
    },
    [ensureContext],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      micSourceRef.current?.disconnect();
      ctxRef.current?.close();
      ctxRef.current = null;
      destRef.current = null;
    };
  }, []);

  return { mixedStream, connectMic, disconnectMic, connectElement };
}
