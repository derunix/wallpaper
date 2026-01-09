import { loadState, saveState } from '../utils/persistence.js';
import { clamp } from '../utils.js';

export class BehaviorMemory {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    this.storageKey = options.storageKey || 'hud_behavior_v1';
    this.halfLifeSec = options.halfLifeSec || 180;
    this.saveIntervalSec = options.saveIntervalSec || 20;
    this.stats = {};
    this.lastSaveAt = 0;
    this._load();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.enabled && !Object.keys(this.stats).length) this._load();
  }

  update(dt) {
    if (!this.enabled) return;
    const decay = Math.exp(-dt / Math.max(1, this.halfLifeSec));
    Object.values(this.stats).forEach(entry => {
      entry.hover *= decay;
      entry.click *= decay;
      entry.focus *= decay;
    });
    const now = performance.now();
    if (now - this.lastSaveAt > this.saveIntervalSec * 1000) {
      this.save();
      this.lastSaveAt = now;
    }
  }

  recordHover(blockId, dt = 0.016) {
    if (!this.enabled || !blockId) return;
    const entry = this._ensure(blockId);
    entry.hover += Math.max(0, dt) * 2.2;
  }

  recordClick(blockId) {
    if (!this.enabled || !blockId) return;
    const entry = this._ensure(blockId);
    entry.click += 1.5;
  }

  recordFocus(blockId) {
    if (!this.enabled || !blockId) return;
    const entry = this._ensure(blockId);
    entry.focus += 1.0;
  }

  getInterest(blockId) {
    if (!blockId) return 0;
    const entry = this.stats[blockId];
    if (!entry) return 0;
    const score = entry.hover * 0.35 + entry.click * 0.45 + entry.focus * 0.4;
    const maxScore = this._maxScore();
    if (maxScore <= 0) return 0;
    return clamp(score / maxScore, 0, 1);
  }

  applyToBlocks(blocks = {}) {
    if (!this.enabled) return;
    Object.entries(blocks).forEach(([id, block]) => {
      if (!block) return;
      if (block.baseImportance === undefined) {
        block.baseImportance = block.importance ?? 1;
      }
      const interest = this.getInterest(id);
      block.interest = interest;
      block.importance = block.baseImportance * (0.65 + interest * 0.85);
    });
  }

  getSummary() {
    const interests = {};
    let sum = 0;
    let count = 0;
    Object.keys(this.stats).forEach(key => {
      const interest = this.getInterest(key);
      interests[key] = interest;
      sum += interest;
      count++;
    });
    return {
      engagement: count ? sum / count : 0,
      interests,
    };
  }

  save() {
    if (!this.enabled) return;
    const payload = {
      t: Date.now(),
      stats: this.stats,
    };
    saveState(this.storageKey, payload);
  }

  _load() {
    const payload = loadState(this.storageKey, null);
    if (!payload || !payload.stats) return;
    this.stats = payload.stats;
  }

  _ensure(blockId) {
    if (!this.stats[blockId]) {
      this.stats[blockId] = { hover: 0, click: 0, focus: 0 };
    }
    return this.stats[blockId];
  }

  _maxScore() {
    let max = 0;
    Object.values(this.stats).forEach(entry => {
      const score = entry.hover * 0.35 + entry.click * 0.45 + entry.focus * 0.4;
      if (score > max) max = score;
    });
    return max;
  }
}
