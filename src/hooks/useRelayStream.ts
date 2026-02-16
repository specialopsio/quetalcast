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

/**
 * AudioWorklet processor code — runs in the audio thread.
 * Collects PCM samples into buffers and posts them to the main thread.
 */
const workletCode = `
class RelayProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 4096;
    this._left = new Float32Array(this._bufferSize);
    this._right = new Float32Array(this._bufferSize);
    this._pos = 0;
    this._active = true;
    this.port.onmessage = (e) => {
      if (e.data === 'stop') this._active = false;
    };
  }

  process(inputs) {
    if (!this._active) return false;
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const left = input[0];
    const right = input.length >= 2 ? input[1] : input[0];
    if (!left) return true;

    for (let i = 0; i < left.length; i++) {
      this._left[this._pos] = left[i];
      this._right[this._pos] = right ? right[i] : left[i];
      this._pos++;

      if (this._pos >= this._bufferSize) {
        this.port.postMessage({
          left: this._left.slice(),
          right: this._right.slice(),
        });
        this._pos = 0;
      }
    }
    return true;
  }
}

registerProcessor('relay-processor', RelayProcessor);
`;

let workletRegistered = new WeakSet<AudioContext>();

async function ensureWorklet(ctx: AudioContext) {
  if (workletRegistered.has(ctx)) return;
  const blob = new Blob([workletCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  workletRegistered.add(ctx);
}

export interface UseRelayStreamReturn {
  active: boolean;
  error: string | null;
  streamUrl: string | null;
  startRelay: (roomId: string, ctx: AudioContext, tapNode: AudioNode) => Promise<void>;
  stopRelay: () => void;
}

/**
 * Encodes the broadcast audio to MP3 and sends it over the signaling WebSocket
 * as binary frames. Uses AudioWorklet to reliably capture PCM from the mixer's
 * audio graph, then encodes to MP3 with lamejs on the main thread.
 */
export function useRelayStream(signaling: UseSignalingReturn): UseRelayStreamReturn {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const stopRelay = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage('stop');
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    setActive(false);
    setStreamUrl(null);
  }, []);

  const startRelay = useCallback(async (roomId: string, ctx: AudioContext, tapNode: AudioNode) => {
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

      step = 'worklet';
      await ensureWorklet(ctx);

      const quality = DEFAULT_STREAM_QUALITY;
      const numChannels = quality.channels;
      const bitrate = quality.bitrate;
      const mp3Encoder = new lame.Mp3Encoder(numChannels, ctx.sampleRate, bitrate);

      // Warmup frame so players detect the stream instantly
      const silence = new Int16Array(1152);
      const warmup = numChannels === 2
        ? mp3Encoder.encodeBuffer(silence, silence)
        : mp3Encoder.encodeBuffer(silence);
      if (warmup.length > 0) signaling.sendBinary(warmup);

      const sendBin = signaling.sendBinary;

      const floatToInt16 = (input: Float32Array): Int16Array => {
        const samples = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return samples;
      };

      step = 'connect';
      const workletNode = new AudioWorkletNode(ctx, 'relay-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: numChannels,
        channelCountMode: 'explicit',
      });
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e: MessageEvent) => {
        const { left, right } = e.data;
        const leftI16 = floatToInt16(left);

        let mp3buf: Uint8Array;
        if (numChannels === 2) {
          const rightI16 = floatToInt16(right);
          mp3buf = mp3Encoder.encodeBuffer(leftI16, rightI16);
        } else {
          mp3buf = mp3Encoder.encodeBuffer(leftI16);
        }

        if (mp3buf.length > 0) {
          sendBin(mp3buf);
        }
      };

      // Tap the clipper → worklet node (sink, no output)
      tapNode.connect(workletNode);

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
