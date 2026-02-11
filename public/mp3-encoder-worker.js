/**
 * MP3 Encoder Web Worker
 *
 * Receives Float32 PCM samples from the main thread, encodes them to
 * high-quality MP3 using lamejs, and accumulates the result. When
 * stopped, flushes the encoder and transfers the final MP3 blob back.
 *
 * Running encoding in a worker keeps the main thread and audio thread
 * completely free — maximum energy efficiency.
 *
 * Messages IN:
 *   { command: 'init', sampleRate: number, bitrate: number }
 *   { command: 'encode', samples: Float32Array }
 *   { command: 'finish' }
 *
 * Messages OUT:
 *   { type: 'ready' }
 *   { type: 'progress', encodedBytes: number }
 *   { type: 'complete', blob: Blob, duration: number }
 *   { type: 'error', error: string }
 */

let encoder = null;
let mp3Chunks = [];
let totalSamples = 0;
let sampleRate = 44100;

// Import lamejs — it's a UMD module so we need importScripts
// We'll load it from the same origin
self.onmessage = async function (e) {
  const { command } = e.data;

  switch (command) {
    case 'init': {
      try {
        sampleRate = e.data.sampleRate || 44100;
        const bitrate = e.data.bitrate || 320;

        // lamejs is a UMD module — load from public/ (copied from node_modules)
        if (typeof lamejs === 'undefined') {
          importScripts('/lame.min.js');
        }

        encoder = new lamejs.Mp3Encoder(2, sampleRate, bitrate);
        mp3Chunks = [];
        totalSamples = 0;

        self.postMessage({ type: 'ready' });
      } catch (err) {
        self.postMessage({ type: 'error', error: 'Failed to initialize MP3 encoder: ' + err.message });
      }
      break;
    }

    case 'encode': {
      if (!encoder) return;

      const floatSamples = e.data.samples;
      const len = floatSamples.length;
      totalSamples += len;

      // Convert Float32 [-1, 1] to Int16 for both L and R (duplicate mono to stereo)
      const left = new Int16Array(len);
      const right = new Int16Array(len);
      for (let i = 0; i < len; i++) {
        const s = Math.max(-1, Math.min(1, floatSamples[i]));
        const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
        left[i] = val;
        right[i] = val;
      }

      const mp3buf = encoder.encodeBuffer(left, right);
      if (mp3buf.length > 0) {
        mp3Chunks.push(new Uint8Array(mp3buf));
      }

      // Report progress every ~5 seconds of audio
      if (totalSamples % (sampleRate * 5) < len) {
        let totalBytes = 0;
        for (let i = 0; i < mp3Chunks.length; i++) {
          totalBytes += mp3Chunks[i].length;
        }
        self.postMessage({ type: 'progress', encodedBytes: totalBytes });
      }
      break;
    }

    case 'finish': {
      if (!encoder) {
        self.postMessage({ type: 'error', error: 'Encoder not initialized' });
        return;
      }

      // Flush remaining MP3 data
      const remaining = encoder.flush();
      if (remaining.length > 0) {
        mp3Chunks.push(new Uint8Array(remaining));
      }

      // Build the final blob
      const blob = new Blob(mp3Chunks, { type: 'audio/mpeg' });
      const duration = totalSamples / sampleRate;

      self.postMessage({ type: 'complete', blob, duration });

      // Clean up
      encoder = null;
      mp3Chunks = [];
      totalSamples = 0;
      break;
    }
  }
};
