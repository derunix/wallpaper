import { clamp, EMA, resampleArray, jitterNoise } from './utils.js';

// Handles audio input coming from Wallpaper Engine.
export class AudioEngine {
  constructor(options = {}) {
    this.options = {
      barsCount: 48,
      sensitivity: 1.0,
      smoothing: 0.35,
      waveformEnabled: true,
      waveformHeight: 0.25,
      ...options,
    };
    this.bars = new Float32Array(this.options.barsCount).fill(0);
    this.waveform = new Float32Array(256).fill(0);
    this.emaBars = Array.from({ length: this.options.barsCount }, () => new EMA(this.options.smoothing));
    this.emaWaveform = this.waveform.map(() => 0);
    this.lastUpdate = performance.now();
    this.lastTick = performance.now();
    this.idlePhase = 0;
    this.noise = jitterNoise(Date.now());
  }

  updateSettings(opts = {}) {
    Object.assign(this.options, opts);
    if (opts.barsCount) {
      this.bars = new Float32Array(this.options.barsCount).fill(0);
      this.emaBars = Array.from({ length: this.options.barsCount }, () => new EMA(this.options.smoothing));
    }
    if (opts.smoothing !== undefined) {
      this.emaBars.forEach(ema => (ema.alpha = clamp(opts.smoothing, 0, 1)));
    }
  }

  processAudioArray(inputArray) {
    if (!inputArray || !inputArray.length) {
      this._decay();
      return;
    }
    const normalized = resampleArray(inputArray, this.options.barsCount).map(v =>
      clamp(v * this.options.sensitivity, 0, 1)
    );
    normalized.forEach((v, i) => {
      this.bars[i] = this.emaBars[i].update(v);
    });

    // Synthesizing waveform from spectrum if no direct waveform is provided.
    const synthetic = this._buildWaveformFromSpectrum(normalized);
    this.waveform = synthetic;
    this.lastUpdate = performance.now();
  }

  processWaveform(waveArray) {
    if (!waveArray || !waveArray.length) return;
    const targetLength = 256;
    const resampled = resampleArray(waveArray, targetLength);
    for (let i = 0; i < targetLength; i++) {
      const v = clamp((resampled[i] + 1) / 2, 0, 1); // [-1,1] => [0,1]
      const smoothed = this.emaWaveform[i] * (1 - this.options.smoothing) + v * this.options.smoothing;
      this.emaWaveform[i] = smoothed;
      this.waveform[i] = smoothed;
    }
    this.lastUpdate = performance.now();
  }

  tick(now) {
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (now - this.lastUpdate < 400) return;
    this._idleAnimate(dt);
  }

  _buildWaveformFromSpectrum(spectrum) {
    const len = 256;
    const result = new Float32Array(len);
    const noise = this.noise;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const bandIndex = Math.floor(t * spectrum.length);
      const base = spectrum[bandIndex] || 0;
      const jitter = (noise() - 0.5) * 0.1;
      const value = clamp(base * 0.9 + jitter, 0, 1);
      result[i] = value;
    }
    return result;
  }

  _decay() {
    // Soft decay when no new audio is coming in.
    this.bars = this.bars.map(v => v * 0.96);
    this.waveform = this.waveform.map(v => v * 0.96);
  }

  _idleAnimate(dt) {
    this.idlePhase += dt * 0.9;
    const phase = this.idlePhase;
    for (let i = 0; i < this.bars.length; i++) {
      const wave = 0.18 + 0.08 * Math.sin(phase + i * 0.22);
      const jitter = (this.noise() - 0.5) * 0.08;
      const value = clamp(wave + jitter, 0, 0.6);
      this.bars[i] = this.emaBars[i].update(value);
    }

    const len = this.waveform.length;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const base = 0.5 + 0.18 * Math.sin(phase * 1.6 + t * Math.PI * 4);
      const jitter = (this.noise() - 0.5) * 0.06;
      this.waveform[i] = clamp(base + jitter, 0, 1);
    }
  }

  getState() {
    return {
      bars: this.bars,
      waveform: this.waveform,
      waveformHeight: this.options.waveformHeight,
      waveformEnabled: this.options.waveformEnabled,
    };
  }
}

export function registerWallpaperAudio(engine, extraListener) {
  if (window.wallpaperRegisterAudioListener) {
    window.wallpaperRegisterAudioListener(arr => {
      engine.processAudioArray(arr);
      extraListener?.(arr);
    });
  }
  // Some setups provide waveform separately.
  if (window.wallpaperRegisterSoundListener) {
    window.wallpaperRegisterSoundListener(wave => {
      engine.processWaveform(wave);
    });
  }
}
