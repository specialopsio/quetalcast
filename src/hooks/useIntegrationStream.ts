import { useCallback, useRef, useState } from 'react';
import type { IntegrationConfig } from '@/lib/integrations';
import { getIntegration } from '@/lib/integrations';

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
  startStream: (stream: MediaStream, config: IntegrationConfig) => Promise<void>;
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

  const stopStream = useCallback(() => {
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

  const startStream = useCallback(async (stream: MediaStream, config: IntegrationConfig) => {
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

      // Send integration config as first message
      ws.send(JSON.stringify({
        type: integration.type,
        credentials: config.credentials,
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
      const ctx = new AudioContext({ sampleRate: 44100 });
      ctxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessor for PCM capture (4096 buffer, mono input, mono output)
      const bufferSize = 4096;
      const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      // lamejs MP3 encoder: 1 channel, 44100 Hz, 128 kbps
      const mp3Encoder = new lame.Mp3Encoder(1, 44100, 128);

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Convert Float32 [-1,1] to Int16
        const samples = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const mp3buf = mp3Encoder.encodeBuffer(samples);
        if (mp3buf.length > 0) {
          wsRef.current.send(mp3buf);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination); // ScriptProcessor needs to be connected to work

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
