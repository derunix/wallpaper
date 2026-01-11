/**
 * RAF loop with update/render separation and error handling.
 */
export class MainLoop {
  constructor(options = {}) {
    this.update = options.update || (() => {});
    this.render = options.render || (() => {});
    this.onError = options.onError || (() => {});
    this.onFrame = options.onFrame || (() => {});
    this.maxDt = options.maxDt ?? 0.05;
    this.running = false;
    this._last = 0;
    this._raf = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _tick(now) {
    if (!this.running) return;
    const rawDt = (now - this._last) / 1000;
    const safeDt = Number.isFinite(rawDt) ? rawDt : 0;
    const dt = Math.min(this.maxDt, Math.max(0, safeDt));
    this._last = now;
    try {
      this.update(dt, now);
      this.render(dt, now);
      this.onFrame(dt, now);
    } catch (err) {
      this.onError(err);
      return;
    }
    this._raf = requestAnimationFrame(this._tick);
  }
}
