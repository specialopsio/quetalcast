import { useEffect, useRef, useState, useCallback } from 'react';

export interface AudioAnalysis {
  level: number;   // 0-1 RMS level
  peak: number;    // 0-1 peak hold
  clipping: boolean;
}

export function useAudioAnalyser(stream: MediaStream | null): AudioAnalysis {
  const [analysis, setAnalysis] = useState<AudioAnalysis>({ level: 0, peak: 0, clipping: false });
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const peakRef = useRef(0);
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

    // Peak hold with decay
    if (max > peakRef.current) {
      peakRef.current = max;
      peakDecayRef.current = 0;
    } else {
      peakDecayRef.current++;
      if (peakDecayRef.current > 30) {
        peakRef.current = Math.max(0, peakRef.current - 0.01);
      }
    }

    setAnalysis({ level: Math.min(1, rms * 3), peak: peakRef.current, clipping });
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!stream || stream.getTracks().length === 0) {
      setAnalysis({ level: 0, peak: 0, clipping: false });
      return;
    }

    const ctx = new AudioContext();
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
