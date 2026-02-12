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
 * Periodically captures audio from a MediaStream using MediaRecorder,
 * sends the encoded audio to the server for fingerprint identification,
 * and calls onMatch for new songs.
 *
 * Uses MediaRecorder (browser-native) instead of ScriptProcessorNode to
 * avoid dropped buffers, sample rate mismatches, and manual PCM conversion.
 * The server receives a webm/opus blob and passes it directly to fpcalc
 * (which decodes it via FFmpeg).
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

  /** Pick a supported audio MIME type for MediaRecorder */
  const getMimeType = useCallback((): string => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return ''; // browser default
  }, []);

  /** Capture audio via MediaRecorder and send for identification */
  const captureAndIdentify = useCallback(async () => {
    if (!stream || !enabledRef.current || capturingRef.current) return;
    capturingRef.current = true;

    try {
      const mimeType = getMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 64000, // low bitrate is fine for fingerprinting
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // Record for captureDuration seconds
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.onerror = () => resolve();
        recorder.start(1000); // request data every second
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          } else {
            resolve();
          }
        }, captureDuration * 1000);
      });

      if (chunks.length === 0) return;

      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });

      // Must have some meaningful audio data
      if (blob.size < 5000) return;

      // Determine file extension from MIME type
      const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';

      // Send to server
      const res = await fetch('/api/identify-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Audio-Format': ext,
        },
        body: blob,
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
  }, [stream, captureDuration, getMimeType]);

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
