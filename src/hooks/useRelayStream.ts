import { useCallback, useRef, useState } from 'react';
import type { SignalingMessage, UseSignalingReturn } from './useSignaling';

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
  startRelay: (stream: MediaStream, roomId: string) => Promise<void>;
  stopRelay: () => void;
}

/**
 * Encodes the broadcast audio as MP3 (via lamejs) and sends chunks over
 * the signaling WebSocket as binary frames. The server serves the stream
 * at /stream/:roomId with Icecast-compatible headers for RadioDJ,
 * internet-radio.com, VLC, etc.
 */
export function useRelayStream(signaling: UseSignalingReturn): UseRelayStreamReturn {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
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
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    setActive(false);
    setStreamUrl(null);
  }, []);

  const startRelay = useCallback(async (stream: MediaStream, roomId: string) => {
    setError(null);
    try {
      if (!signaling.connected) {
        setError('Signaling not connected');
        return;
      }

      const lame = await loadLame();

      signaling.send({ type: 'start-relay' });

      const ack = await new Promise<{ ok: boolean; url?: string; error?: string }>((resolve) => {
        const unsub = signaling.subscribe((msg: SignalingMessage) => {
          if (msg.type === 'relay-started') {
            unsub();
            resolve({ ok: true, url: msg.url as string | undefined });
          } else if (msg.type === 'error' && typeof msg.message === 'string' && msg.message.includes('relay')) {
            unsub();
            resolve({ ok: false, error: msg.message as string });
          }
        });
        setTimeout(() => {
          unsub();
          resolve({ ok: false, error: 'Relay start timeout' });
        }, 10000);
      });

      if (!ack.ok) {
        setError(ack.error || 'Relay stream failed');
        return;
      }

      if (ack.url) setStreamUrl(ack.url);

      const numChannels = 2;
      const sampleRate = 44100;
      const bitrate = 128;

      const ctx = new AudioContext({ sampleRate });
      ctxRef.current = ctx;
      await ctx.resume();
      if (ctx.state !== 'running') {
        throw new Error('Audio engine is suspended — interact with the page and try again');
      }

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const bufferSize = 4096;
      const processor = ctx.createScriptProcessor(bufferSize, numChannels, numChannels);
      processorRef.current = processor;

      const mp3Encoder = new lame.Mp3Encoder(numChannels, sampleRate, bitrate);
      const sendBin = signaling.sendBinary;

      // Send a silent warmup frame so listeners detect the stream quickly
      const silence = new Int16Array(1152);
      const warmup = mp3Encoder.encodeBuffer(silence, silence);
      if (warmup.length > 0) {
        sendBin(new Uint8Array(warmup));
      }

      const floatToInt16 = (input: Float32Array): Int16Array => {
        const samples = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return samples;
      };

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const left = floatToInt16(e.inputBuffer.getChannelData(0));
        const right = e.inputBuffer.numberOfChannels >= 2
          ? floatToInt16(e.inputBuffer.getChannelData(1))
          : left;
        const mp3buf = mp3Encoder.encodeBuffer(left, right);
        if (mp3buf.length > 0) {
          sendBin(new Uint8Array(mp3buf));
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setActive(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Relay failed: ${msg}`);
      stopRelay();
    }
  }, [stopRelay, signaling]);

  return { active, error, streamUrl, startRelay, stopRelay };
}
