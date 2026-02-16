import { useCallback, useRef, useState } from 'react';
import type { SignalingMessage, UseSignalingReturn } from './useSignaling';

export interface UseRelayStreamReturn {
  active: boolean;
  error: string | null;
  streamUrl: string | null;
  startRelay: (stream: MediaStream, roomId: string) => Promise<void>;
  stopRelay: () => void;
}

/**
 * Records the broadcast audio using MediaRecorder (WebM/Opus) and sends
 * chunks over the signaling WebSocket as binary frames. The server stores
 * the WebM initialization segment and serves the stream at /stream/:roomId
 * for VLC, RadioDJ, etc.
 *
 * MediaRecorder reliably captures MediaStream output from
 * createMediaStreamDestination — unlike ScriptProcessorNode and
 * AudioWorklet which silently fail in this scenario.
 */
export function useRelayStream(signaling: UseSignalingReturn): UseRelayStreamReturn {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);

  const stopRelay = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
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

      // Ask the server to set up the /stream/:roomId endpoint
      signaling.send({ type: 'start-relay' });

      // Wait for the server's ack with the stream URL
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

      // Use MediaRecorder to capture the mixed audio stream
      // WebM/Opus is the most reliable output format in Chrome
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });
      recorderRef.current = recorder;

      const sendBin = signaling.sendBinary;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          e.data.arrayBuffer().then((buf) => {
            sendBin(new Uint8Array(buf));
          });
        }
      };

      recorder.onerror = () => {
        setError('MediaRecorder error');
        stopRelay();
      };

      // Start recording with 250ms timeslice for low-latency chunks
      recorder.start(250);
      setActive(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Relay failed: ${msg}`);
      stopRelay();
    }
  }, [stopRelay, signaling]);

  return { active, error, streamUrl, startRelay, stopRelay };
}
