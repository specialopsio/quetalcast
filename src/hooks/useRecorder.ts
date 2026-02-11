import { useCallback, useRef, useState } from 'react';

export interface UseRecorderReturn {
  recording: boolean;
  /** Elapsed recording time in seconds */
  elapsed: number;
  /** Encoded file size so far in bytes */
  encodedBytes: number;
  startRecording: (stream: MediaStream) => Promise<void>;
  stopRecording: () => void;
}

/**
 * High-quality MP3 recorder that captures from a MediaStream.
 *
 * Architecture (energy-efficient):
 *   MediaStream → AudioWorkletNode (audio thread, batches PCM)
 *                 → MessagePort → Web Worker (encodes MP3 via lamejs)
 *                 → on stop: Blob download
 *
 * No work happens on the main thread during recording — the AudioWorklet
 * runs on the audio rendering thread and the MP3 encoder runs in a
 * dedicated Web Worker.
 */
export function useRecorder(): UseRecorderReturn {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [encodedBytes, setEncodedBytes] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Disconnect audio nodes
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ command: 'stop' });
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!recording) return;

    // Tell the worklet to flush remaining samples and stop.
    // The worklet will send a 'stopped' message, which triggers
    // the worker's 'finish' command (see startRecording handler).
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ command: 'stop' });
    }

    // Stop the elapsed timer immediately
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setRecording(false);
  }, [recording]);

  const startRecording = useCallback(async (stream: MediaStream) => {
    if (recording) return;

    setElapsed(0);
    setEncodedBytes(0);

    // Create a separate AudioContext for recording so we don't interfere
    // with the mixer's context. Clone the stream to avoid shared ownership issues.
    const ctx = new AudioContext({ sampleRate: 44100 });
    ctxRef.current = ctx;

    // Register the recorder worklet
    await ctx.audioWorklet.addModule('/recorder-processor.js');

    // Create source from the broadcast stream
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;

    // Create the worklet node (mono capture for efficiency; stereo is duplicated in the encoder)
    const workletNode = new AudioWorkletNode(ctx, 'recorder-processor', {
      channelCount: 1,
      channelCountMode: 'explicit',
      numberOfInputs: 1,
      numberOfOutputs: 0, // sink node — no output needed
    });
    workletNodeRef.current = workletNode;

    // Set up the MP3 encoder worker
    const worker = new Worker('/mp3-encoder-worker.js');
    workerRef.current = worker;

    // Initialize encoder: stereo 320kbps for high quality
    worker.postMessage({ command: 'init', sampleRate: 44100, bitrate: 320 });

    // Wait for worker ready
    await new Promise<void>((resolve, reject) => {
      const onMsg = (e: MessageEvent) => {
        if (e.data.type === 'ready') {
          worker.removeEventListener('message', onMsg);
          resolve();
        } else if (e.data.type === 'error') {
          worker.removeEventListener('message', onMsg);
          reject(new Error(e.data.error));
        }
      };
      worker.addEventListener('message', onMsg);
    });

    // Route PCM from worklet → worker
    workletNode.port.onmessage = (e) => {
      if (e.data.type === 'pcm') {
        // Transfer the buffer to the worker (zero-copy)
        worker.postMessage(
          { command: 'encode', samples: e.data.samples },
          [e.data.samples.buffer]
        );
      }
      if (e.data.type === 'stopped') {
        // Worklet confirmed stop — tell worker to finish
        worker.postMessage({ command: 'finish' });
      }
    };

    // Handle worker results
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        setEncodedBytes(e.data.encodedBytes);
      }
      if (e.data.type === 'complete') {
        const { blob, duration } = e.data;

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `broadcast-${timestamp}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Terminate worker
        worker.terminate();
        workerRef.current = null;

        // Clean up audio nodes
        cleanup();
      }
      if (e.data.type === 'error') {
        console.error('Recorder worker error:', e.data.error);
        worker.terminate();
        workerRef.current = null;
        cleanup();
      }
    };

    // Connect: source → worklet (the worklet is a sink, no output)
    source.connect(workletNode);

    // Tell the worklet to start capturing
    workletNode.port.postMessage({ command: 'start' });

    // Start elapsed timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    setRecording(true);
  }, [recording, cleanup]);

  return { recording, elapsed, encodedBytes, startRecording, stopRecording };
}
