import { useRef, useCallback, useState, useEffect } from 'react';

export interface IdentifyMatch {
  artist: string;
  title: string;
  score: number;
  musicbrainzId?: string | null;
}

interface UseAutoIdentifyOptions {
  /** MediaStream to capture from (mixer output) */
  stream: MediaStream | null;
  /** Whether auto-identify is enabled */
  enabled: boolean;
  /** Interval between captures in ms (default: 15000) */
  interval?: number;
  /** Duration of each capture in seconds (default: 12) */
  captureDuration?: number;
  /** Titles already in the track list — used to avoid duplicate notifications */
  existingTitles: string[];
  /** Called when a new song is identified */
  onMatch: (match: IdentifyMatch) => void;
}

/**
 * Periodically captures audio from a MediaStream, sends it to the server
 * for fingerprint identification, and calls onMatch for new songs.
 */
export function useAutoIdentify({
  stream,
  enabled,
  interval = 15000,
  captureDuration = 12,
  existingTitles,
  onMatch,
}: UseAutoIdentifyOptions) {
  const [listening, setListening] = useState(false);
  const [lastMatch, setLastMatch] = useState<IdentifyMatch | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const captureBufferRef = useRef<Float32Array[]>([]);
  const capturingRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const enabledRef = useRef(enabled);
  const existingTitlesRef = useRef(existingTitles);
  const onMatchRef = useRef(onMatch);

  // Keep refs current
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { existingTitlesRef.current = existingTitles; }, [existingTitles]);
  useEffect(() => { onMatchRef.current = onMatch; }, [onMatch]);

  // Sync seen set with existing titles
  useEffect(() => {
    const normalized = new Set(existingTitles.map(t => t.toLowerCase()));
    seenRef.current = normalized;
  }, [existingTitles]);

  /** Capture a short PCM snippet and send it for identification */
  const captureAndIdentify = useCallback(async () => {
    if (!stream || !enabledRef.current || capturingRef.current) return;
    capturingRef.current = true;

    try {
      // Create a temporary AudioContext for capture
      const ctx = new AudioContext({ sampleRate: 22050 });
      const source = ctx.createMediaStreamSource(stream);

      // ScriptProcessor to capture raw PCM (4096 buffer, mono)
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      const maxSamples = captureDuration * 22050;
      let sampleCount = 0;

      await new Promise<void>((resolve) => {
        processor.onaudioprocess = (e) => {
          if (sampleCount >= maxSamples) return;
          const data = e.inputBuffer.getChannelData(0);
          const copy = new Float32Array(data.length);
          copy.set(data);
          chunks.push(copy);
          sampleCount += data.length;
          if (sampleCount >= maxSamples) {
            resolve();
          }
        };
        source.connect(processor);
        processor.connect(ctx.destination);

        // Safety timeout
        setTimeout(resolve, (captureDuration + 2) * 1000);
      });

      // Disconnect and close
      try { source.disconnect(); } catch {}
      try { processor.disconnect(); } catch {}
      await ctx.close();

      if (sampleCount < 22050 * 3) {
        // Less than 3 seconds captured — not enough
        return;
      }

      // Convert Float32 to signed 16-bit LE PCM
      const totalSamples = Math.min(sampleCount, maxSamples);
      const pcmBuffer = new ArrayBuffer(totalSamples * 2);
      const pcmView = new DataView(pcmBuffer);
      let offset = 0;
      for (const chunk of chunks) {
        for (let i = 0; i < chunk.length && offset < totalSamples; i++, offset++) {
          const s = Math.max(-1, Math.min(1, chunk[i]));
          pcmView.setInt16(offset * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
      }

      // Send to server
      const res = await fetch('/api/identify-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(pcmBuffer, 0, totalSamples * 2),
      });

      if (!res.ok) return;

      const { match } = await res.json();
      if (!match?.artist || !match?.title) return;

      // Check if we've already seen this song
      const key = `${match.artist} — ${match.title}`.toLowerCase();
      if (seenRef.current.has(key)) return;

      // Check against existing track list titles
      const titleLower = match.title.toLowerCase();
      const artistLower = match.artist.toLowerCase();
      const alreadyInList = existingTitlesRef.current.some(t => {
        const tl = t.toLowerCase();
        return tl.includes(titleLower) && tl.includes(artistLower);
      });
      if (alreadyInList) {
        seenRef.current.add(key);
        return;
      }

      // New match!
      seenRef.current.add(key);
      setLastMatch(match);
      onMatchRef.current(match);
    } catch {
      // Silently ignore errors — this is a background feature
    } finally {
      capturingRef.current = false;
    }
  }, [stream, captureDuration]);

  // Start/stop the interval
  useEffect(() => {
    if (enabled && stream) {
      setListening(true);
      // Run once after a short delay, then on interval
      const initialTimeout = setTimeout(() => {
        captureAndIdentify();
      }, 5000);
      intervalRef.current = setInterval(captureAndIdentify, interval);

      return () => {
        clearTimeout(initialTimeout);
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setListening(false);
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setListening(false);
    }
  }, [enabled, stream, interval, captureAndIdentify]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  /** Reset the seen set (e.g. when starting a new broadcast) */
  const reset = useCallback(() => {
    seenRef.current.clear();
    setLastMatch(null);
  }, []);

  return { listening, lastMatch, reset };
}
