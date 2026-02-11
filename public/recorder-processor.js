/**
 * Recorder AudioWorklet Processor
 *
 * Captures PCM audio from the mixer output and forwards Float32 samples
 * to the main thread via the message port. Runs on the audio rendering
 * thread so it doesn't block the UI.
 *
 * Batches samples into ~100ms chunks before posting to reduce message
 * overhead and save energy (fewer cross-thread transfers).
 */
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._recording = false;
    this._buffer = [];
    this._bufferLength = 0;
    // Batch size: ~100ms at 44100 Hz = 4410 samples
    // At 48000 Hz = 4800 samples. Use 4096 as a round number.
    this._batchSize = 4096;

    this.port.onmessage = (e) => {
      if (e.data.command === 'start') {
        this._recording = true;
        this._buffer = [];
        this._bufferLength = 0;
      } else if (e.data.command === 'stop') {
        // Flush remaining samples
        if (this._bufferLength > 0) {
          this._flush();
        }
        this._recording = false;
        this.port.postMessage({ type: 'stopped' });
      }
    };
  }

  _flush() {
    // Merge buffered chunks into a single Float32Array
    const merged = new Float32Array(this._bufferLength);
    let offset = 0;
    for (let i = 0; i < this._buffer.length; i++) {
      merged.set(this._buffer[i], offset);
      offset += this._buffer[i].length;
    }
    // Transfer the buffer (zero-copy)
    this.port.postMessage(
      { type: 'pcm', samples: merged },
      [merged.buffer]
    );
    this._buffer = [];
    this._bufferLength = 0;
  }

  process(inputs) {
    if (!this._recording) return true;

    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // Take channel 0 (mono) — stereo mix is downmixed by the worklet node config
    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    // Copy the data (input buffers are reused by the audio engine)
    this._buffer.push(new Float32Array(channelData));
    this._bufferLength += channelData.length;

    // Flush when we have enough
    if (this._bufferLength >= this._batchSize) {
      this._flush();
    }

    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
