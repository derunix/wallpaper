import { clamp, scrambleText } from './utils.js';

const ALIEN_SYMBOLS = ['⌖', '⌬', '⍜', '⍰', '⟁', '⟟', '⌰', '⌇', '⎔', '⌿'];

export class GlitchController {
  constructor(options = {}, getTargets = () => []) {
    this.options = {
      enabled: false,
      frequency: 0.35,
      intensity: 0.35,
      alienSymbols: true,
      ...options,
    };
    this.getTargets = getTargets;
    this.timer = null;
    this.restoreTimers = new Set();
  }

  updateOptions(opts = {}) {
    Object.assign(this.options, opts);
    document.documentElement.style.setProperty('--glitch-intensity', `${this.options.intensity}`);
    if (this.options.enabled) {
      this._scheduleNext(true);
    } else {
      this.stop();
    }
  }

  start() {
    this.updateOptions({ enabled: true });
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.restoreTimers.forEach(t => clearTimeout(t));
    this.restoreTimers.clear();
    document.body.classList.remove('glitch-active');
  }

  _scheduleNext(reset = false) {
    if (!this.options.enabled) return;
    if (this.timer) clearTimeout(this.timer);
    if (reset) this.timer = null;

    const factor = clamp(this.options.frequency, 0, 1);
    const min = lerp(60, 20, factor);
    const max = lerp(120, 90, factor);
    const delay = (min + Math.random() * (max - min)) * 1000;
    this.timer = setTimeout(() => this._trigger(), delay);
  }

  _trigger() {
    if (!this.options.enabled) return;
    this._visualGlitch();
    this._textGlitch();
    this._scheduleNext();
  }

  _visualGlitch() {
    const intensity = clamp(this.options.intensity, 0, 1);
    if (intensity <= 0) return;
    const duration = lerp(100, 400, intensity);
    document.body.classList.add('glitch-active');
    const timer = setTimeout(() => {
      document.body.classList.remove('glitch-active');
      this.restoreTimers.delete(timer);
    }, duration);
    this.restoreTimers.add(timer);
  }

  _textGlitch() {
    if (!this.options.alienSymbols) return;
    const targets = this.getTargets().filter(el => el && el.textContent && el.textContent.trim().length > 0);
    if (!targets.length) return;
    const intensity = clamp(this.options.intensity, 0, 1);
    if (intensity <= 0) return;
    const strength = Math.max(0.1, intensity);
    const count = strength > 0.6 ? 2 : 1;
    const picked = new Set();
    while (picked.size < count && picked.size < targets.length) {
      picked.add(targets[Math.floor(Math.random() * targets.length)]);
    }

    picked.forEach(el => {
      if (!el.dataset.glitchRaw) el.dataset.glitchRaw = el.textContent;
      el.textContent = scrambleText(el.dataset.glitchRaw, ALIEN_SYMBOLS, strength);
      const restoreDelay = 500 + Math.random() * 500;
      const timer = setTimeout(() => {
        el.textContent = el.dataset.glitchRaw || el.textContent;
        this.restoreTimers.delete(timer);
      }, restoreDelay);
      this.restoreTimers.add(timer);
    });
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
