import { useCallback, useRef, useState } from 'react';
import type { IntegrationConfig } from '@/lib/integrations';
import { getIntegration, DEFAULT_STREAM_QUALITY } from '@/lib/integrations';

// lamejs is loaded as a global UMD script or dynamic import.
// We'll use dynamic import so it works with Vite bundling.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lamejs: any = null;

async function loadLame() {
  if (!lamejs) {
    lamejs = await import('lamejs');
  }
  return lamejs;
}

export interface UseIntegrationStreamReturn {
  streaming: boolean;
  error: string | null;
  startStream: (stream: MediaStream, config: IntegrationConfig, roomId?: string | null) => Promise<void>;
  stopStream: () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || (
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}`
    : `ws://${window.location.hostname}:3001`
);

export function useIntegrationStream(): UseIntegrationStreamReturn {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunkCountRef = useRef(0);
  const flowCheckTimerRef = useRef<number | null>(null);

  const stopStream = useCallback(() => {
    if (flowCheckTimerRef.current !== null) {
      window.clearTimeout(flowCheckTimerRef.current);
      flowCheckTimerRef.current = null;
    }
    chunkCountRef.current = 0;

    // Clean up audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'stream-ended');
      }
      wsRef.current = null;
    }

    setStreaming(false);
  }, []);

  const startStream = useCallback(async (stream: MediaStream, config: IntegrationConfig, roomId?: string | null) => {
    setError(null);

    const integration = getIntegration(config.integrationId);
    if (!integration) {
      setError('Unknown integration');
      return;
    }

    try {
      // Load lamejs
      const lame = await loadLame();

      // Connect WebSocket to relay
      const wsUrl = `${WS_URL}/integration-stream`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('WebSocket connection failed'));
        const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
        ws.onopen = () => { clearTimeout(timeout); resolve(); };
      });

      const quality = config.streamQuality || DEFAULT_STREAM_QUALITY;

      // Send integration config as first message (include roomId for metadata updates + stream quality for headers)
      ws.send(JSON.stringify({
        type: integration.type,
        credentials: config.credentials,
        roomId: roomId || undefined,
        streamQuality: quality,
      }));

      // Wait for server ack
      const ack = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const handler = (ev: MessageEvent) => {
          try {
            const msg = JSON.parse(ev.data as string);
            if (msg.type === 'connected' || msg.type === 'error') {
              ws.removeEventListener('message', handler);
              resolve(msg.type === 'connected' ? { ok: true } : { ok: false, error: msg.error });
            }
          } catch { /* ignore non-JSON */ }
        };
        ws.addEventListener('message', handler);
        // Timeout after 15s
        setTimeout(() => resolve({ ok: false, error: 'Connection timeout' }), 15000);
      });

      if (!ack.ok) {
        ws.close();
        wsRef.current = null;
        setError(ack.error || 'Failed to connect to streaming server');
        return;
      }

      // Set up MP3 encoding pipeline
      const numChannels = quality.channels;
      const bitrate = quality.bitrate;
      const ctx = new AudioContext({ sampleRate: 44100 });
      ctxRef.current = ctx;
      await ctx.resume();
      if (ctx.state !== 'running') {
        throw new Error('Audio engine is suspended — interact with the page and try again');
      }

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessor: match channel count to encoding mode
      const bufferSize = 4096;
      const processor = ctx.createScriptProcessor(bufferSize, numChannels, numChannels);
      processorRef.current = processor;

      // lamejs MP3 encoder
      const mp3Encoder = new lame.Mp3Encoder(numChannels, 44100, bitrate);
      chunkCountRef.current = 0;

      // Send a short silent warmup frame so source dashboards detect an active stream quickly.
      if (numChannels === 2) {
        const silence = new Int16Array(1152);
        const warmup = mp3Encoder.encodeBuffer(silence, silence);
        if (warmup.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(warmup);
        }
      } else {
        const warmup = mp3Encoder.encodeBuffer(new Int16Array(1152));
        if (warmup.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(warmup);
        }
      }

      /** Convert Float32 [-1,1] to Int16 */
      const floatToInt16 = (input: Float32Array): Int16Array => {
        const samples = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return samples;
      };

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        let mp3buf: Uint8Array;
        if (numChannels === 2) {
          const left = floatToInt16(e.inputBuffer.getChannelData(0));
          const right = e.inputBuffer.numberOfChannels >= 2
            ? floatToInt16(e.inputBuffer.getChannelData(1))
            : left;
          mp3buf = mp3Encoder.encodeBuffer(left, right);
        } else {
          const samples = floatToInt16(e.inputBuffer.getChannelData(0));
          mp3buf = mp3Encoder.encodeBuffer(samples);
        }

        if (mp3buf.length > 0) {
          wsRef.current.send(mp3buf);
          chunkCountRef.current += 1;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination); // ScriptProcessor needs to be connected to work

      // Fail fast if no encoded frames are produced after startup.
      flowCheckTimerRef.current = window.setTimeout(() => {
        if (chunkCountRef.current === 0) {
          setError('Connected to relay, but no audio frames are being produced');
          stopStream();
        }
      }, 5000);

      // Handle WebSocket close/error
      ws.onclose = () => {
        stopStream();
      };
      ws.onerror = () => {
        setError('WebSocket error — stream disconnected');
        stopStream();
      };

      setStreaming(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start integration stream';
      setError(msg);
      stopStream();
    }
  }, [stopStream]);

  return { streaming, error, startStream, stopStream };
}
