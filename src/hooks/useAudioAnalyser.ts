import { useEffect, useRef, useState, useCallback } from 'react';

export interface AudioAnalysis {
  level: number;   // dBFS RMS level (e.g. -60 to 0)
  peak: number;    // dBFS peak hold
  clipping: boolean;
}

const MIN_DB = -60; // floor of the meter

/** Convert a linear amplitude (0–1) to dBFS, clamped to MIN_DB */
function toDbfs(linear: number): number {
  if (linear <= 0) return MIN_DB;
  const db = 20 * Math.log10(linear);
  return Math.max(MIN_DB, db);
}

export function useAudioAnalyser(stream: MediaStream | null): AudioAnalysis {
  const [analysis, setAnalysis] = useState<AudioAnalysis>({ level: MIN_DB, peak: MIN_DB, clipping: false });
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const peakDbRef = useRef(MIN_DB);
  const peakDecayRef = useRef(0);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);

    let sum = 0;
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      sum += abs * abs;
      if (abs > max) max = abs;
    }

    const rms = Math.sqrt(sum / data.length);
    const clipping = max >= 0.99;

    const rmsDb = toDbfs(rms);
    const peakDb = toDbfs(max);

    // Peak hold with decay (in dB space — drop 0.5 dB per frame after hold)
    if (peakDb > peakDbRef.current) {
      peakDbRef.current = peakDb;
      peakDecayRef.current = 0;
    } else {
      peakDecayRef.current++;
      if (peakDecayRef.current > 30) {
        peakDbRef.current = Math.max(MIN_DB, peakDbRef.current - 0.5);
      }
    }

    setAnalysis({ level: rmsDb, peak: peakDbRef.current, clipping });
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!stream || stream.getTracks().length === 0) {
      setAnalysis({ level: MIN_DB, peak: MIN_DB, clipping: false });
      return;
    }

    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    contextRef.current = ctx;
    analyserRef.current = analyser;

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      ctx.close();
      contextRef.current = null;
      analyserRef.current = null;
    };
  }, [stream, tick]);

  return analysis;
}
