import { useCallback, useRef, useState } from 'react';
import { DEFAULT_STREAM_QUALITY } from '@/lib/integrations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lamejs: any = null;

async function loadLame() {
  if (!lamejs) {
    lamejs = await import('lamejs');
  }
  return lamejs;
}

export interface UseRelayStreamReturn {
  active: boolean;
  error: string | null;
  streamUrl: string | null;
  startRelay: (stream: MediaStream, roomId: string, ctx: AudioContext) => Promise<void>;
  stopRelay: () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || (
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}`
    : `ws://${window.location.hostname}:3001`
);

/**
 * Encodes the broadcast audio to MP3 and sends it to the server via WebSocket.
 * The server serves it as an HTTP stream at /stream/:roomId for VLC, RadioDJ, etc.
 * Reuses the broadcaster's AudioContext to avoid browser limits on concurrent contexts.
 */
export function useRelayStream(): UseRelayStreamReturn {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const stopRelay = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'relay-ended');
      }
      wsRef.current = null;
    }
    setActive(false);
    setStreamUrl(null);
  }, []);

  const startRelay = useCallback(async (stream: MediaStream, roomId: string, ctx: AudioContext) => {
    setError(null);
    try {
      const lame = await loadLame();

      const wsUrl = `${WS_URL}/relay-stream`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Relay WebSocket timeout')), 10000);
        ws.onopen = () => { clearTimeout(timeout); resolve(); };
        ws.onerror = () => { clearTimeout(timeout); reject(new Error('Relay WebSocket connection failed')); };
      });

      // Send room ID to initialize
      ws.send(JSON.stringify({ roomId }));

      // Wait for server ack with the stream URL
      const ack = await new Promise<{ ok: boolean; url?: string; error?: string }>((resolve) => {
        const handler = (ev: MessageEvent) => {
          try {
            const msg = JSON.parse(ev.data as string);
            if (msg.type === 'connected') {
              ws.removeEventListener('message', handler);
              resolve({ ok: true, url: msg.url });
            } else if (msg.type === 'error') {
              ws.removeEventListener('message', handler);
              resolve({ ok: false, error: msg.error });
            }
          } catch { /* ignore non-JSON */ }
        };
        ws.addEventListener('message', handler);
        ws.addEventListener('close', () => resolve({ ok: false, error: 'Relay connection closed' }));
        setTimeout(() => resolve({ ok: false, error: 'Relay connection timeout' }), 10000);
      });

      if (!ack.ok) {
        setError(ack.error || 'Relay stream failed');
        ws.close();
        wsRef.current = null;
        return;
      }

      if (ack.url) setStreamUrl(ack.url);

      // Use the broadcaster's existing AudioContext — no new context needed
      const quality = DEFAULT_STREAM_QUALITY;
      const numChannels = quality.channels;
      const bitrate = quality.bitrate;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const bufferSize = 4096;
      const processor = ctx.createScriptProcessor(bufferSize, numChannels, numChannels);
      processorRef.current = processor;

      const mp3Encoder = new lame.Mp3Encoder(numChannels, ctx.sampleRate, bitrate);

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
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      ws.onclose = () => stopRelay();
      ws.onerror = () => {
        setError('Relay stream disconnected');
        stopRelay();
      };

      setActive(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Relay stream failed';
      setError(msg);
      stopRelay();
    }
  }, [stopRelay]);

  return { active, error, streamUrl, startRelay, stopRelay };
}
