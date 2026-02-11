/**
 * Real-time granular pitch-shift AudioWorklet processor.
 *
 * Uses two overlapping read heads with Hanning-window crossfade reading
 * from a circular buffer at a variable rate.  When a grain finishes it
 * resets near the write head so the output never runs away from the input.
 *
 * Control via port.postMessage({ pitchFactor: 0.5–2.0 })
 *   0.5 = one octave down   (deep voice)
 *   1.0 = no change
 *   2.0 = one octave up     (chipmunk voice)
 */
class PitchShiftProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.grainSize = 1024;
    this.bufLen = this.grainSize * 8; // plenty of room
    this.buf = new Float32Array(this.bufLen);
    this.wPos = this.grainSize * 2; // start write ahead so reads don't underrun

    // Two read heads, offset by half a grain so their Hanning windows sum to 1.0
    this.rPos = [0, this.grainSize / 2];
    this.phase = [0.0, 0.5];

    this.pitchFactor = 1.0;

    this.port.onmessage = (e) => {
      if (e.data.pitchFactor !== undefined) {
        this.pitchFactor = Math.max(0.5, Math.min(2.0, e.data.pitchFactor));
      }
    };
  }

  process(inputs, outputs) {
    const inp = inputs[0];
    const out = outputs[0];
    if (!inp || !inp.length || !out || !out.length) return true;

    const inData = inp[0];
    const frames = out[0].length;
    if (!inData || frames === 0) return true;

    const phaseInc = this.pitchFactor / this.grainSize;
    const TWO_PI = 2.0 * Math.PI;
    const bufLen = this.bufLen;
    const buf = this.buf;
    const grainSize = this.grainSize;

    for (let i = 0; i < frames; i++) {
      // Write input to circular buffer
      buf[this.wPos % bufLen] = inData[i];
      this.wPos++;

      let sample = 0.0;

      for (let h = 0; h < 2; h++) {
        // Hanning window value at current phase (two windows offset by 0.5 sum to 1.0)
        const w = 0.5 * (1.0 - Math.cos(TWO_PI * this.phase[h]));

        // Linear-interpolated read from circular buffer
        const rp = this.rPos[h];
        const idx = Math.floor(rp);
        const frac = rp - idx;
        const i0 = ((idx % bufLen) + bufLen) % bufLen;
        const i1 = ((idx + 1) % bufLen + bufLen) % bufLen;
        sample += (buf[i0] + frac * (buf[i1] - buf[i0])) * w;

        // Advance read head
        this.rPos[h] += this.pitchFactor;
        this.phase[h] += phaseInc;

        // Grain finished — reset read position to trail write head
        if (this.phase[h] >= 1.0) {
          this.phase[h] -= 1.0;
          this.rPos[h] = this.wPos - grainSize;
        }
      }

      // Write to all output channels
      for (let ch = 0; ch < out.length; ch++) {
        out[ch][i] = sample;
      }
    }

    return true;
  }
}

registerProcessor('pitch-shift-processor', PitchShiftProcessor);
