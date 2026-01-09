import { createEffectDefinitions } from './glitch_effects.js';
import { DEFAULT_SYMBOL_SET } from './text_scramble.js';

export class GlitchManager {
  constructor(config = {}, blocks = {}) {
    this.config = {
      glitchesEnabled: true,
      glitchIntervalMinSec: 10,
      glitchIntervalMaxSec: 20,
      glitchIntensity: 1,
      musicReactiveGlitches: true,
      maxSimultaneousGlitches: 2,
      allowScreenWideEffects: true,
      bigEventChance: 0.2,
      chromaticAberrationEnabled: true,
      alienAlphabetStrength: 0.7,
      alienSymbolSet: DEFAULT_SYMBOL_SET,
      debugGlitchOverlay: false,
      ...config,
    };
    this.blocks = blocks;
    this.textTargets = [];
    this.blockLabels = {};
    this.effectDefs = createEffectDefinitions();
    this.active = [];
    this.lastRun = new Map();
    this.nextGlitchAt = performance.now() + this._randRange(8000, 14000);
    this.debugInfo = {
      nextIn: 0,
      active: [],
      audio: null,
    };
  }

  setBlocks(blocks = {}, labels = {}, textTargets = []) {
    this.blocks = blocks;
    this.blockLabels = labels;
    this.textTargets = textTargets;
  }

  setConfig(config = {}) {
    Object.assign(this.config, config);
  }

  update(dt, now, audioState) {
    if (!this.config.glitchesEnabled) return;
    const audio = audioState || {};

    this.active.forEach(effect => {
      effect.update(dt, this._context(audio));
    });
    const stillActive = [];
    this.active.forEach(effect => {
      if (effect.active) stillActive.push(effect);
      else effect.cleanup(this._context(audio));
    });
    this.active = stillActive;

    if (now >= this.nextGlitchAt) {
      this._triggerEffects(now, audio);
      const interval = this._nextInterval(audio);
      this.nextGlitchAt = now + interval;
    }

    this.debugInfo.nextIn = Math.max(0, (this.nextGlitchAt - now) / 1000);
    this.debugInfo.active = this.active.map(e => e.id);
    this.debugInfo.audio = audio;
  }

  render(ctx, hudCanvas, mainCanvas, audioState) {
    if (!this.config.glitchesEnabled) return;
    const context = this._context(audioState || {});
    this.active.forEach(effect => {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      effect.render(ctx, hudCanvas, mainCanvas, context);
      ctx.restore();
    });
  }

  triggerBigEvent() {
    const now = performance.now();
    const bigDefs = this.effectDefs.filter(e => e.category === 'big');
    const available = bigDefs.filter(def => this._cooldownReady(def, now));
    const pick = available[Math.floor(Math.random() * available.length)];
    if (pick) this._spawnEffect(pick, now);
  }

  getDebugInfo() {
    return this.debugInfo;
  }

  _triggerEffects(now, audio) {
    const allowScreen = this.config.allowScreenWideEffects;
    const bigChance = this.config.bigEventChance + (audio.peak ? 0.2 : 0);
    const bigDefs = this.effectDefs.filter(e => e.category === 'big');
    if (allowScreen && Math.random() < bigChance && this._cooldownReadyAny(bigDefs, now)) {
      const pick = this._pickEffect(bigDefs, now);
      if (pick) {
        this._spawnEffect(pick, now, audio);
        return;
      }
    }

    const maxCount = this.config.maxSimultaneousGlitches || 1;
    const pool = this.effectDefs.filter(def => {
      if (def.category === 'big') return false;
      if (!allowScreen && def.category === 'screen') return false;
      return true;
    });
    const hasScreenActive = this.active.some(effect => effect.category === 'screen');
    const availableSlots = Math.max(0, maxCount - this.active.length);
    if (availableSlots <= 0) return;

    const targetCount = Math.min(availableSlots, Math.random() < 0.68 ? 2 : 1);
    let remaining = targetCount;

    const screenDefs = pool.filter(def => def.category === 'screen');
    const nonScreenPool = pool.filter(def => def.category !== 'screen');
    const blockDefs = pool.filter(def => def.category === 'block');
    const textDefs = pool.filter(def => def.category === 'text');
    let screenPicked = false;

    if (!hasScreenActive && allowScreen && remaining > 0 && Math.random() < 0.28) {
      const pick = this._pickEffect(screenDefs, now, audio);
      if (pick) {
        this._spawnEffect(pick, now, audio);
        remaining -= 1;
        screenPicked = true;
      }
    }

    if (remaining > 0) {
      const fallback = hasScreenActive || screenPicked ? nonScreenPool : pool;
      const pick = this._pickEffect(blockDefs, now, audio) || this._pickEffect(fallback, now, audio);
      if (pick) {
        this._spawnEffect(pick, now, audio);
        remaining -= 1;
      }
    }

    if (remaining > 0) {
      const fallback = hasScreenActive || screenPicked ? nonScreenPool : pool;
      const pick = this._pickEffect(textDefs, now, audio) || this._pickEffect(fallback, now, audio);
      if (pick) {
        this._spawnEffect(pick, now, audio);
      }
    }
  }

  _spawnEffect(def, now, audio) {
    if (!this._cooldownReady(def, now)) return;
    const effect = new EffectInstance(def, this._context(audio));
    this.active.push(effect);
    this.lastRun.set(def.id, now);
  }

  _pickEffect(defs, now, audio) {
    const available = defs.filter(def => this._cooldownReady(def, now));
    if (!available.length) return null;
    const weights = available.map(def => this._weightFor(def, audio));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < available.length; i++) {
      r -= weights[i];
      if (r <= 0) return available[i];
    }
    return available[0];
  }

  _weightFor(def, audio) {
    let weight = 1;
    if (audio?.peak) weight += 0.8;
    if (audio?.low && [2, 3, 4, 15, 30, 41].includes(def.id)) weight += audio.low * 1.5;
    if (audio?.high && [1, 5, 6, 21, 31, 33].includes(def.id)) weight += audio.high * 1.3;
    if (def.category === 'screen') weight *= audio?.peak ? 1.4 : 0.9;
    if (def.category === 'text') weight *= 0.9;
    return weight;
  }

  _cooldownReady(def, now) {
    const last = this.lastRun.get(def.id) || 0;
    return now - last > (def.cooldown || 0) * 1000;
  }

  _cooldownReadyAny(defs, now) {
    return defs.some(def => this._cooldownReady(def, now));
  }

  _nextInterval(audio) {
    const min = this.config.glitchIntervalMinSec * 1000;
    const max = this.config.glitchIntervalMaxSec * 1000;
    const base = this._randRange(min, max);
    if (!this.config.musicReactiveGlitches) return base;
    const boost = 1 - clamp(audio?.energy || 0, 0, 1) * 0.4;
    return base * boost;
  }

  _context(audio) {
    const userIntensity = clamp(this.config.glitchIntensity ?? 1, 0.2, 2.5);
    const intensityScale = 0.6 + Math.pow(userIntensity, 1.6);
    const vw = window.innerWidth || 2560;
    const vh = window.innerHeight || 1440;
    const viewportScale = clamp(Math.min(vw / 2560, vh / 1440), 0.75, 1.5);
    return {
      blocks: this.blocks,
      blockLabels: this.blockLabels,
      textTargets: this.textTargets,
      config: this.config,
      symbolSet: this.config.alienSymbolSet || DEFAULT_SYMBOL_SET,
      symbolStrength: this.config.alienAlphabetStrength || 0.7,
      intensityScale,
      viewportScale,
      rand: Math.random,
      pickBlock: () => pickWeightedBlock(this.blocks),
      pickTextTargets: () => pickTextTargets(this.textTargets),
      audio,
    };
  }

  _randRange(min, max) {
    return min + Math.random() * (max - min);
  }
}

class EffectInstance {
  constructor(def, context) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.category = def.category;
    this.duration = def.duration;
    this.elapsed = 0;
    this.active = true;
    this.progress = 0;
    if (def.trigger) def.trigger.call(this, context);
  }

  update(dt, context) {
    this.elapsed += dt;
    this.progress = clamp(this.elapsed / Math.max(0.001, this.duration), 0, 1);
    if (this.def.update) this.def.update.call(this, dt, context);
    if (this.elapsed >= this.duration) this.active = false;
  }

  render(ctx, hudCanvas, mainCanvas, context) {
    if (this.def.render) this.def.render.call(this, ctx, hudCanvas, mainCanvas, context);
  }

  cleanup(context) {
    if (this.def.cleanup) this.def.cleanup.call(this, context);
  }
}

function pickWeightedBlock(blocks) {
  const entries = Object.entries(blocks).filter(([, b]) => b && b.rect);
  if (!entries.length) return 'none';
  const weights = entries.map(([, b]) => b.importance || 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r <= 0) return entries[i][0];
  }
  return entries[0][0];
}

function pickTextTargets(targets) {
  if (!targets || targets.length === 0) return [];
  const count = Math.min(2, Math.max(1, Math.floor(Math.random() * 2) + 1));
  const shuffled = [...targets].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
