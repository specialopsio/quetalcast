import { useCallback, useRef, useState } from 'react';
import { DEFAULT_STREAM_QUALITY } from '@/lib/integrations';
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
 * Encodes the broadcast audio to MP3 and sends it over the signaling WebSocket
 * as binary frames. The server routes them to HTTP listeners at /stream/:roomId
 * for VLC, RadioDJ, etc.
 *
 * Uses its own AudioContext (like the integration stream) to avoid conflicts
 * with the mixer's audio graph.
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
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    setActive(false);
    setStreamUrl(null);
  }, []);

  const startRelay = useCallback(async (stream: MediaStream, roomId: string) => {
    setError(null);
    let step = 'init';
    try {
      step = 'loadLame';
      const lame = await loadLame();

      if (!signaling.connected) {
        setError('Signaling not connected');
        return;
      }

      step = 'startRelay';
      signaling.send({ type: 'start-relay' });

      step = 'waitAck';
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

      step = 'setUrl';
      if (ack.url) setStreamUrl(ack.url);

      step = 'audioCtx';
      const quality = DEFAULT_STREAM_QUALITY;
      const numChannels = quality.channels;
      const bitrate = quality.bitrate;

      // Own AudioContext at 44.1kHz — matches the integration stream pattern
      const ctx = new AudioContext({ sampleRate: 44100 });
      ctxRef.current = ctx;
      await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const bufferSize = 4096;
      const processor = ctx.createScriptProcessor(bufferSize, numChannels, numChannels);
      processorRef.current = processor;

      step = 'encoder';
      const mp3Encoder = new lame.Mp3Encoder(numChannels, 44100, bitrate);

      // Send a warmup frame so the stream is detected immediately
      const silence = new Int16Array(1152);
      if (numChannels === 2) {
        const warmup = mp3Encoder.encodeBuffer(silence, silence);
        if (warmup.length > 0) signaling.sendBinary(warmup);
      } else {
        const warmup = mp3Encoder.encodeBuffer(silence);
        if (warmup.length > 0) signaling.sendBinary(warmup);
      }

      const floatToInt16 = (input: Float32Array): Int16Array => {
        const samples = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return samples;
      };

      // Capture sendBinary in a local variable so the closure always works
      const sendBin = signaling.sendBinary;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
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
          sendBin(mp3buf);
        }
      };

      step = 'connect';
      source.connect(processor);
      processor.connect(ctx.destination);

      step = 'done';
      setActive(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Relay failed at ${step}: ${msg}`);
      stopRelay();
    }
  }, [stopRelay, signaling]);

  return { active, error, streamUrl, startRelay, stopRelay };
}
