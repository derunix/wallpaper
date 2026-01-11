const DEFAULT_FRAME_CAPACITY = 600; // ~10s at 60fps
const DEFAULT_SECTION_CAPACITY = 240; // ~4s at 60fps
const DEFAULT_HIST_BINS = 200; // 0..199ms

const SECTIONS = ['update', 'renderHUD', 'renderFX', 'textGen', 'weather', 'perf'];

/**
 * Lightweight performance profiler using ring buffers.
 */
export class PerfProfiler {
  constructor(options = {}) {
    this.enabled = false;
    this.frameCapacity = options.frameCapacity || DEFAULT_FRAME_CAPACITY;
    this.sectionCapacity = options.sectionCapacity || DEFAULT_SECTION_CAPACITY;
    this.histBins = options.histBins || DEFAULT_HIST_BINS;
    this.logIntervalMs = options.logIntervalMs || 20000;

    this.frameTimes = new Float32Array(this.frameCapacity);
    this.frameIndex = 0;
    this.frameCount = 0;
    this.frameSum = 0;
    this.frameWorst = 0;
    this.hist = new Uint16Array(this.histBins);

    this.sectionStarts = Object.create(null);
    this.sections = Object.create(null);
    for (let i = 0; i < SECTIONS.length; i++) {
      const name = SECTIONS[i];
      this.sections[name] = {
        buffer: new Float32Array(this.sectionCapacity),
        index: 0,
        count: 0,
        sum: 0,
        max: 0,
        last: 0,
      };
    }

    this.counters = {
      activeEffects: 0,
      activeTimers: 0,
      activeFetches: 0,
      logSize: 0,
    };

    this.frameStart = 0;
    this.lastLogAt = 0;

    this._stats = {
      frameAvg: 0,
      frameP95: 0,
      frameWorst: 0,
      sections: Object.create(null),
      counters: this.counters,
    };
    for (let i = 0; i < SECTIONS.length; i++) {
      const name = SECTIONS[i];
      this._stats.sections[name] = { avg: 0, max: 0, last: 0 };
    }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  beginFrame(now) {
    if (!this.enabled) return;
    this.frameStart = now;
  }

  endFrame(now) {
    if (!this.enabled || !this.frameStart) return;
    const dt = now - this.frameStart;
    this._pushFrame(dt);
  }

  start(name, now = performance.now()) {
    if (!this.enabled || !this.sections[name]) return;
    this.sectionStarts[name] = now;
  }

  end(name, now = performance.now()) {
    if (!this.enabled || !this.sections[name]) return;
    const start = this.sectionStarts[name];
    if (!start) return;
    const dt = now - start;
    this._pushSection(name, dt);
  }

  setCounters(counters = {}) {
    if (!this.enabled) return;
    if (counters.activeEffects !== undefined) this.counters.activeEffects = counters.activeEffects;
    if (counters.activeTimers !== undefined) this.counters.activeTimers = counters.activeTimers;
    if (counters.activeFetches !== undefined) this.counters.activeFetches = counters.activeFetches;
    if (counters.logSize !== undefined) this.counters.logSize = counters.logSize;
  }

  getStats() {
    if (!this.enabled) return null;
    this._stats.frameAvg = this.frameCount ? this.frameSum / this.frameCount : 0;
    this._stats.frameP95 = this._getFrameP95();
    this._stats.frameWorst = this.frameWorst;
    for (let i = 0; i < SECTIONS.length; i++) {
      const name = SECTIONS[i];
      const sec = this.sections[name];
      const target = this._stats.sections[name];
      target.avg = sec.count ? sec.sum / sec.count : 0;
      target.max = sec.max;
      target.last = sec.last;
    }
    return this._stats;
  }

  maybeLog(now = performance.now()) {
    if (!this.enabled) return;
    if (now - this.lastLogAt < this.logIntervalMs) return;
    this.lastLogAt = now;
    const stats = this.getStats();
    if (!stats) return;
    const fmt = n => n.toFixed(1);
    const secs = stats.sections;
    console.log(
      `[perf] frame avg:${fmt(stats.frameAvg)}ms p95:${fmt(stats.frameP95)}ms worst:${fmt(stats.frameWorst)}ms | ` +
        `upd:${fmt(secs.update.avg)} hud:${fmt(secs.renderHUD.avg)} fx:${fmt(secs.renderFX.avg)} text:${fmt(
          secs.textGen.avg
        )} w:${fmt(secs.weather.avg)} p:${fmt(secs.perf.avg)} | ` +
        `fx:${stats.counters.activeEffects} timers:${stats.counters.activeTimers} fetch:${stats.counters.activeFetches} log:${stats.counters.logSize}`
    );
  }

  _pushFrame(dt) {
    const idx = this.frameIndex;
    const old = this.frameTimes[idx];
    if (this.frameCount === this.frameCapacity) {
      this.frameSum -= old;
      this._histRemove(old);
    } else {
      this.frameCount += 1;
    }
    this.frameTimes[idx] = dt;
    this.frameSum += dt;
    if (dt > this.frameWorst) this.frameWorst = dt;
    this._histAdd(dt);
    this.frameIndex = (idx + 1) % this.frameCapacity;
  }

  _pushSection(name, dt) {
    const sec = this.sections[name];
    const idx = sec.index;
    const old = sec.buffer[idx];
    if (sec.count === this.sectionCapacity) {
      sec.sum -= old;
    } else {
      sec.count += 1;
    }
    sec.buffer[idx] = dt;
    sec.sum += dt;
    sec.last = dt;
    if (dt > sec.max) sec.max = dt;
    sec.index = (idx + 1) % this.sectionCapacity;
  }

  _histAdd(dt) {
    const bin = Math.min(this.histBins - 1, Math.max(0, Math.floor(dt)));
    this.hist[bin] += 1;
  }

  _histRemove(dt) {
    const bin = Math.min(this.histBins - 1, Math.max(0, Math.floor(dt)));
    if (this.hist[bin] > 0) this.hist[bin] -= 1;
  }

  _getFrameP95() {
    const count = this.frameCount;
    if (!count) return 0;
    const target = Math.ceil(count * 0.95);
    let acc = 0;
    for (let i = 0; i < this.histBins; i++) {
      acc += this.hist[i];
      if (acc >= target) return i;
    }
    return this.histBins - 1;
  }
}
