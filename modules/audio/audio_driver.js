export class AudioDriver {
  constructor(options = {}) {
    this.options = {
      smoothing: 0.2,
      peakHoldSec: 0.18,
      ...options,
    };
    this.energy = 0;
    this.low = 0;
    this.mid = 0;
    this.high = 0;
    this.transient = 0;
    this.peak = false;
    this._peakHold = 0;
    this._lastEnergy = 0;
    this._hasInput = false;
  }

  onAudioFrame(data) {
    if (!data || !data.length) return;
    const len = data.length;
    let sum = 0;
    let low = 0;
    let mid = 0;
    let high = 0;
    const lowEnd = Math.floor(len * 0.33);
    const midEnd = Math.floor(len * 0.66);
    for (let i = 0; i < len; i++) {
      const v = clamp(data[i], 0, 1);
      sum += v;
      if (i < lowEnd) low += v;
      else if (i < midEnd) mid += v;
      else high += v;
    }
    const energy = sum / len;
    const lowAvg = low / Math.max(1, lowEnd);
    const midAvg = mid / Math.max(1, midEnd - lowEnd);
    const highAvg = high / Math.max(1, len - midEnd);

    const smooth = this.options.smoothing;
    this.energy = lerp(this.energy, energy, smooth);
    this.low = lerp(this.low, lowAvg, smooth);
    this.mid = lerp(this.mid, midAvg, smooth);
    this.high = lerp(this.high, highAvg, smooth);
    this.transient = clamp(energy - this._lastEnergy, 0, 1);
    this._lastEnergy = energy;
    this._hasInput = true;

    if (energy > 0.85 || this.transient > 0.2 || highAvg > 0.8) {
      this._peakHold = this.options.peakHoldSec;
    }
  }

  update(dt) {
    if (!this._hasInput) {
      this.energy = lerp(this.energy, 0, 0.05);
      this.low = lerp(this.low, 0, 0.05);
      this.mid = lerp(this.mid, 0, 0.05);
      this.high = lerp(this.high, 0, 0.05);
      this.transient = 0;
      this.peak = false;
      return;
    }
    this._peakHold = Math.max(0, this._peakHold - dt);
    this.peak = this._peakHold > 0;
    this.transient = lerp(this.transient, 0, 0.2);
  }

  getState() {
    return {
      energy: clamp(this.energy, 0, 1),
      low: clamp(this.low, 0, 1),
      mid: clamp(this.mid, 0, 1),
      high: clamp(this.high, 0, 1),
      transient: clamp(this.transient, 0, 1),
      peak: this.peak,
      hasInput: this._hasInput,
    };
  }

  reset() {
    this.energy = 0;
    this.low = 0;
    this.mid = 0;
    this.high = 0;
    this.transient = 0;
    this.peak = false;
    this._peakHold = 0;
    this._lastEnergy = 0;
    this._hasInput = false;
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
