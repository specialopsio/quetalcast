/**
 * Noise Gate AudioWorklet Processor
 *
 * Monitors RMS amplitude and mutes audio that falls below a configurable
 * threshold. Uses smoothed gain transitions and a hold timer to avoid
 * chattering and clicks.
 *
 * Messages:
 *   { thresholdDb: number }  — gate threshold in dBFS (-80 to -20)
 */
class NoiseGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Gate threshold in linear amplitude (default ~ -40 dBFS)
    this._thresholdLinear = Math.pow(10, -40 / 20);
    // Current smoothed gain (0 = closed, 1 = open)
    this._gain = 1;
    // Hold counter (samples remaining before gate closes after signal drops)
    this._holdSamples = 0;
    // Hold time in samples (~50ms at 48kHz)
    this._holdTime = Math.round(0.05 * 48000);
    // Smoothing coefficients (attack = open speed, release = close speed)
    this._attackCoeff = 0.01;  // fast open
    this._releaseCoeff = 0.002; // slower close to avoid clicks

    this.port.onmessage = (e) => {
      if (typeof e.data.thresholdDb === 'number') {
        const db = e.data.thresholdDb;
        // -100 or below = gate effectively off
        this._thresholdLinear = db <= -100 ? 0 : Math.pow(10, db / 20);
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0) return true;

    // Calculate RMS across all channels
    let sumSq = 0;
    let totalSamples = 0;
    for (let ch = 0; ch < input.length; ch++) {
      const chan = input[ch];
      for (let i = 0; i < chan.length; i++) {
        sumSq += chan[i] * chan[i];
      }
      totalSamples += chan.length;
    }
    const rms = totalSamples > 0 ? Math.sqrt(sumSq / totalSamples) : 0;

    // Gate logic
    const gateOpen = rms >= this._thresholdLinear || this._thresholdLinear === 0;

    if (gateOpen) {
      this._holdSamples = this._holdTime;
    } else if (this._holdSamples > 0) {
      this._holdSamples -= input[0].length;
    }

    const targetGain = (gateOpen || this._holdSamples > 0) ? 1 : 0;

    // Apply gain with smoothing (per-sample for click-free transitions)
    for (let ch = 0; ch < input.length; ch++) {
      const inp = input[ch];
      const out = output[ch];
      let g = this._gain;

      for (let i = 0; i < inp.length; i++) {
        if (targetGain > g) {
          g += this._attackCoeff * (targetGain - g);
        } else {
          g += this._releaseCoeff * (targetGain - g);
        }
        out[i] = inp[i] * g;
      }

      this._gain = g;
    }

    return true;
  }
}

registerProcessor('noise-gate-processor', NoiseGateProcessor);
