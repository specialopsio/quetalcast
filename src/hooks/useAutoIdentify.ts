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
  /** Interval between capture attempts in ms (default: 30000) */
  interval?: number;
  /** Duration of each capture in seconds (default: 20) */
  captureDuration?: number;
  /** Titles already in the track list — used to avoid duplicate notifications */
  existingTitles: string[];
  /** Called when a new song is identified */
  onMatch: (match: IdentifyMatch) => void;
}

/**
 * Periodically captures audio from a MediaStream, sends it to the server
 * for fingerprint identification, and calls onMatch for new songs.
 *
 * Key design decisions for reliable identification:
 * - Uses the browser's native sample rate (typically 44100 or 48000 Hz) and
 *   sends it to the server so the WAV header is accurate. This avoids the
 *   pitfall of requesting 22050 Hz (which browsers often ignore), resulting
 *   in a sample rate mismatch that corrupts the fingerprint.
 * - Captures 20 seconds of audio (Chromaprint/AcoustID recommends 15-30s).
 * - Uses a persistent AudioContext to avoid setup/teardown overhead.
 * - Downmixes to mono on the client for smaller payloads.
 */
export function useAutoIdentify({
  stream,
  enabled,
  interval = 30000,
  captureDuration = 20,
  existingTitles,
  onMatch,
}: UseAutoIdentifyOptions) {
  const [listening, setListening] = useState(false);
  const [lastMatch, setLastMatch] = useState<IdentifyMatch | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  /** Capture a PCM snippet using MediaRecorder-like approach and send for identification */
  const captureAndIdentify = useCallback(async () => {
    if (!stream || !enabledRef.current || capturingRef.current) return;
    capturingRef.current = true;

    let ctx: OfflineAudioContext | null = null;

    try {
      // Use a live AudioContext to tap the stream, then render offline
      // for a gap-free capture at the native sample rate.
      const liveCtx = new AudioContext();
      const nativeSampleRate = liveCtx.sampleRate;
      const totalSamples = captureDuration * nativeSampleRate;

      // Create a ScriptProcessor on the live context to collect raw samples
      const source = liveCtx.createMediaStreamSource(stream);
      const processor = liveCtx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      let sampleCount = 0;

      await new Promise<void>((resolve) => {
        processor.onaudioprocess = (e) => {
          if (sampleCount >= totalSamples) return;
          const data = e.inputBuffer.getChannelData(0);
          const copy = new Float32Array(data.length);
          copy.set(data);
          chunks.push(copy);
          sampleCount += data.length;
          if (sampleCount >= totalSamples) {
            resolve();
          }
        };
        source.connect(processor);
        processor.connect(liveCtx.destination);

        // Safety timeout — resolve even if we don't get enough samples
        setTimeout(resolve, (captureDuration + 3) * 1000);
      });

      // Disconnect capture nodes
      try { source.disconnect(); } catch {}
      try { processor.disconnect(); } catch {}
      await liveCtx.close();

      if (sampleCount < nativeSampleRate * 5) {
        // Less than 5 seconds captured — not enough for reliable matching
        return;
      }

      // Resample to 22050 Hz mono using OfflineAudioContext for a clean,
      // gap-free, correctly-resampled buffer that fpcalc can process accurately.
      const capturedSamples = Math.min(sampleCount, totalSamples);
      const inputBuffer = new AudioContext().createBuffer(1, capturedSamples, nativeSampleRate);
      const channelData = inputBuffer.getChannelData(0);
      let writeOffset = 0;
      for (const chunk of chunks) {
        const remaining = capturedSamples - writeOffset;
        const toCopy = Math.min(chunk.length, remaining);
        channelData.set(chunk.subarray(0, toCopy), writeOffset);
        writeOffset += toCopy;
        if (writeOffset >= capturedSamples) break;
      }

      const targetRate = 22050;
      const outputLength = Math.ceil(capturedSamples * targetRate / nativeSampleRate);
      ctx = new OfflineAudioContext(1, outputLength, targetRate);
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = inputBuffer;
      bufferSource.connect(ctx.destination);
      bufferSource.start(0);
      const rendered = await ctx.startRendering();

      const resampledData = rendered.getChannelData(0);
      const finalSamples = resampledData.length;

      // Convert Float32 to signed 16-bit LE PCM
      const pcmBuffer = new ArrayBuffer(finalSamples * 2);
      const pcmView = new DataView(pcmBuffer);
      for (let i = 0; i < finalSamples; i++) {
        const s = Math.max(-1, Math.min(1, resampledData[i]));
        pcmView.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }

      // Send to server — include sample rate in header so WAV is built correctly
      const res = await fetch('/api/identify-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Sample-Rate': String(targetRate),
        },
        body: new Uint8Array(pcmBuffer),
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
      // Run first capture after a short delay, then on interval
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
