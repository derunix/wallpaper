const DEFAULT_THRESHOLDS = {
  textCandidates: 70,
  glitchSpawns: 3,
  glitchContext: 1,
};

/**
 * Debug-only allocation counter for hot paths.
 */
export class AllocationDetector {
  constructor(options = {}) {
    this.enabled = false;
    this.warnIntervalMs = options.warnIntervalMs ?? 8000;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };
    this.counters = {
      textCandidates: 0,
      glitchSpawns: 0,
      glitchContext: 0,
    };
    this.lastWarnAt = 0;
    this._stats = {
      textCandidates: 0,
      glitchSpawns: 0,
      glitchContext: 0,
    };
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  resetFrame() {
    if (!this.enabled) return;
    this.counters.textCandidates = 0;
    this.counters.glitchSpawns = 0;
    this.counters.glitchContext = 0;
  }

  record(key, count = 1) {
    if (!this.enabled) return;
    if (this.counters[key] === undefined) this.counters[key] = 0;
    this.counters[key] += count;
  }

  maybeWarn(now = performance.now()) {
    if (!this.enabled) return null;
    if (now - this.lastWarnAt < this.warnIntervalMs) return null;
    const hits = [];
    for (const key of Object.keys(this.thresholds)) {
      const threshold = this.thresholds[key];
      const value = this.counters[key] ?? 0;
      if (value > threshold) hits.push(`${key}:${value}`);
    }
    if (!hits.length) return null;
    this.lastWarnAt = now;
    console.warn(`[alloc] high allocations: ${hits.join(' ')}`);
    return hits;
  }

  getStats() {
    if (!this.enabled) return null;
    this._stats.textCandidates = this.counters.textCandidates;
    this._stats.glitchSpawns = this.counters.glitchSpawns;
    this._stats.glitchContext = this.counters.glitchContext;
    return this._stats;
  }
}

export const allocationDetector = new AllocationDetector();
