import { clamp, lerp } from '../utils.js';

export class EntropyController {
  constructor(options = {}) {
    this.base = clamp(options.base ?? 0.4, 0, 1);
    this.level = this.base;
    this.timeAdaptive = options.timeAdaptive ?? true;
    this.userBias = 0;
  }

  setBase(level) {
    this.base = clamp(level, 0, 1);
  }

  setTimeAdaptive(enabled) {
    this.timeAdaptive = !!enabled;
  }

  update(dt, context = {}) {
    const audio = context.audio || {};
    const time = context.time || {};
    const behavior = context.behavior || {};
    const input = context.input || {};
    const anomaly = context.anomaly;

    let target = this.base + this.userBias;
    if (this.timeAdaptive) {
      if (time.phase === 'night') target -= 0.12;
      if (time.phase === 'evening') target += 0.18;
      if (time.phase === 'day') target += 0.05;
    }

    if (audio.energy) target += audio.energy * 0.25;
    if (audio.peak) target += 0.08;
    if (behavior.engagement !== undefined) {
      target += clamp(behavior.engagement - 0.35, -0.1, 0.18);
    }
    if (input.idle) target -= 0.15;
    if (anomaly) target += 0.2;

    target = clamp(target, 0, 1);
    this.level = lerp(this.level, target, clamp(dt * 0.25, 0.02, 0.2));
    return this.level;
  }

  getLevel() {
    return this.level;
  }

  getModifiers() {
    const level = this.level;
    return {
      glitchIntervalScale: clamp(1 - level * 0.5, 0.5, 1.2),
      glitchIntensityScale: clamp(0.7 + level * 0.6, 0.6, 1.6),
      responseScale: clamp(0.8 + level * 0.7, 0.6, 1.8),
      driftScale: clamp(0.5 + level * 1.2, 0.5, 1.8),
    };
  }
}
