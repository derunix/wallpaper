import { createEffectDefinitions } from './glitch_effects.js';
import { DEFAULT_SYMBOL_SET } from './text_scramble.js';
import { allocationDetector } from '../core/allocation_detector.js';

/**
 * Glitch effect manager with local/global scheduling.
 */
export class GlitchManager {
  constructor(config = {}, blocks = {}) {
    this.config = {
      glitchesEnabled: true,
      glitchIntervalMinSec: 10,
      glitchIntervalMaxSec: 20,
      glitchIntensity: 1,
      musicReactiveGlitches: true,
      localGlitchesEnabled: true,
      localGlitchIntervalMinSec: 6,
      localGlitchIntervalMaxSec: 16,
      localGlitchIntensityBoost: 1,
      localGlitchFrequencyBoost: 1,
      allowTwoBlockGlitches: true,
      electricEffectsEnabled: true,
      electricIntensity: 1.2,
      electricArcCooldown: 20,
      electricLadderSpeed: 1,
      electricAudioReactive: true,
      maxSimultaneousLocal: 2,
      maxSimultaneousGlitches: 2,
      allowScreenWideEffects: true,
      bigEventChance: 0.2,
      bigEventCooldownSec: 600,
      maxSimultaneousBigEvents: 1,
      chromaticAberrationEnabled: true,
      themePrimary: '#8dfc4f',
      themeSecondary: '#3fe7ff',
      alienAlphabetStrength: 0.7,
      alienSymbolSet: DEFAULT_SYMBOL_SET,
      debugGlitchOverlay: false,
      ...config,
    };
    this.blocks = blocks;
    this.textTargets = [];
    this.blockLabels = {};
    this.blockList = [];
    this.blockWeightSum = 0;
    this.blockPairList = [];
    this.blockPairWeightSum = 0;
    this.effectDefs = createEffectDefinitions();
    this.active = [];
    this.lastRun = new Map();
    this.lastBigEventAt = 0;
    this.moodMultipliers = { freqMul: 1, intensityMul: 1, bigEventBoost: 0, chaotic: false };
    const now = performance.now();
    this.nextGlitchAt = now + this._nextGlobalInterval({});
    this.nextLocalAt = now + this._nextLocalInterval({});
    this.lastManualAt = 0;
    this.manualCooldownMs = 450;
    this._ctxCache = null;
    this.debugInfo = {
      nextIn: 0,
      nextLocalIn: 0,
      active: [],
      activeMeta: [],
      audio: null,
    };
    this._rebuildBlockCache();
  }

  setBlocks(blocks = {}, labels = {}, textTargets = []) {
    this.blocks = blocks;
    this.blockLabels = labels;
    this.textTargets = textTargets;
    this._rebuildBlockCache();
  }

  setConfig(config = {}) {
    Object.assign(this.config, config);
  }

  setMoodMultipliers({ freqMul = 1, intensityMul = 1, bigEventBoost = 0, chaotic = false } = {}) {
    this.moodMultipliers = {
      freqMul: clamp(freqMul, 0.7, 1.6),
      intensityMul: clamp(intensityMul, 0.8, 1.5),
      bigEventBoost: clamp(bigEventBoost, 0, 0.3),
      chaotic: !!chaotic,
    };
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

    if (this.config.localGlitchesEnabled && now >= this.nextLocalAt) {
      this._triggerLocalEffects(now, audio);
      this.nextLocalAt = now + this._nextLocalInterval(audio);
    }

    if (now >= this.nextGlitchAt) {
      this._triggerGlobalEffects(now, audio);
      const interval = this._nextGlobalInterval(audio);
      this.nextGlitchAt = now + interval;
    }

    this.debugInfo.nextIn = Math.max(0, (this.nextGlitchAt - now) / 1000);
    this.debugInfo.nextLocalIn = Math.max(0, (this.nextLocalAt - now) / 1000);
    const activeIds = this.debugInfo.active;
    const activeMeta = this.debugInfo.activeMeta;
    activeIds.length = 0;
    for (let i = 0; i < this.active.length; i++) {
      const effect = this.active[i];
      activeIds.push(effect.id);
      if (activeMeta[i]) {
        activeMeta[i].id = effect.id;
        activeMeta[i].category = effect.category;
      } else {
        activeMeta[i] = { id: effect.id, category: effect.category };
      }
    }
    activeMeta.length = this.active.length;
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
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
    });
  }

  triggerBigEvent() {
    const now = performance.now();
    const cooldown = Math.max(0, this.config.bigEventCooldownSec || 0) * 1000;
    if (cooldown && now - this.lastBigEventAt < cooldown) return;
    const bigDefs = this.effectDefs.filter(e => e.category === 'big');
    const available = bigDefs.filter(def => this._cooldownReady(def, now));
    const pick = available[Math.floor(Math.random() * available.length)];
    if (pick) {
      this._spawnEffect(pick, now);
      this.lastBigEventAt = now;
    }
  }

  triggerLocal(audioState = {}, options = {}) {
    const now = performance.now();
    if (!this.config.glitchesEnabled || !this.config.localGlitchesEnabled) return false;
    if (now - this.lastManualAt < this.manualCooldownMs) return false;
    const spawned = this._triggerLocalEffects(now, audioState, { ...options, manual: true });
    if (spawned) this.lastManualAt = now;
    return spawned;
  }

  getDebugInfo() {
    return this.debugInfo;
  }

  reset() {
    const context = this._context({});
    this.active.forEach(effect => {
      effect.cleanup(context);
    });
    this.active = [];
    this.debugInfo.active = [];
    this.debugInfo.activeMeta = [];
    this.lastBigEventAt = 0;
    this.lastManualAt = 0;
    const now = performance.now();
    this.nextGlitchAt = now + this._nextGlobalInterval({});
    this.nextLocalAt = now + this._nextLocalInterval({});
  }

  _triggerLocalEffects(now, audio, options = {}) {
    if (!this.config.localGlitchesEnabled) return false;
    const availableSlots = this._getAvailableSlots();
    const availableLocal = this._getAvailableLocalSlots();
    if (availableSlots <= 0 || availableLocal <= 0) return false;

    const localPool = this.effectDefs.filter(def => {
      if (def.category === 'block') return true;
      if (def.category === 'block_pair') return this.config.allowTwoBlockGlitches;
      return false;
    });
    if (!localPool.length) return false;

    const spawnCount = Math.min(availableSlots, availableLocal, Math.random() < 0.35 ? 2 : 1);
    let spawned = false;
    for (let i = 0; i < spawnCount; i++) {
      const preferPair = options.preferPair && this.config.allowTwoBlockGlitches;
      const pool = preferPair ? localPool.filter(def => def.category === 'block_pair') : localPool;
      const pick = this._pickEffect(pool.length ? pool : localPool, now, audio, options);
      if (pick && this._spawnEffect(pick, now, audio, options)) {
        spawned = true;
      }
    }
    return spawned;
  }

  _triggerGlobalEffects(now, audio) {
    const allowScreen = this.config.allowScreenWideEffects;
    let bigChance = this.config.bigEventChance;
    if (this.moodMultipliers.chaotic && audio.peak) {
      bigChance += this.moodMultipliers.bigEventBoost || 0;
    }
    bigChance = clamp(bigChance, 0, 1);
    const bigDefs = this.effectDefs.filter(e => e.category === 'big');
    const bigCooldown = Math.max(0, this.config.bigEventCooldownSec || 0) * 1000;
    const bigReady = !bigCooldown || now - this.lastBigEventAt >= bigCooldown;
    const maxBig = Math.max(1, this.config.maxSimultaneousBigEvents || 1);
    let activeBig = 0;
    for (let i = 0; i < this.active.length; i++) {
      if (this.active[i].category === 'big') activeBig += 1;
    }
    if (
      allowScreen &&
      bigReady &&
      activeBig < maxBig &&
      Math.random() < bigChance &&
      this._cooldownReadyAny(bigDefs, now)
    ) {
      const pick = this._pickEffect(bigDefs, now);
      if (pick) {
        this._spawnEffect(pick, now, audio);
        this.lastBigEventAt = now;
        return;
      }
    }

    const maxCount = this.config.maxSimultaneousGlitches || 1;
    const localEnabled = this.config.localGlitchesEnabled;
    const pool = this.effectDefs.filter(def => {
      if (def.category === 'big') return false;
      if (!allowScreen && def.category === 'screen') return false;
      if (!localEnabled && (def.category === 'block' || def.category === 'block_pair')) return false;
      if (def.category === 'block_pair' && !this.config.allowTwoBlockGlitches) return false;
      return true;
    });
    const hasScreenActive = this.active.some(effect => effect.category === 'screen');
    const availableSlots = Math.max(0, maxCount - this.active.length);
    if (availableSlots <= 0) return;

    const targetCount = Math.min(availableSlots, Math.random() < 0.55 ? 2 : 1);
    let remaining = targetCount;

    const screenDefs = pool.filter(def => def.category === 'screen');
    const nonScreenPool = pool.filter(def => def.category !== 'screen');
    const blockDefs = pool.filter(def => def.category === 'block' || def.category === 'block_pair');
    const textDefs = pool.filter(def => def.category === 'text');
    let screenPicked = false;

    if (!hasScreenActive && allowScreen && remaining > 0 && Math.random() < 0.2) {
      const pick = this._pickEffect(screenDefs, now, audio);
      if (pick) {
        this._spawnEffect(pick, now, audio);
        remaining -= 1;
        screenPicked = true;
      }
    }

    while (remaining > 0) {
      const allowLocal = this.config.localGlitchesEnabled && this._getAvailableLocalSlots() > 0;
      const useLocal = allowLocal && Math.random() < 0.4;
      const fallback = hasScreenActive || screenPicked ? nonScreenPool : pool;
      const nonLocalFallback = fallback.filter(def => def.category !== 'block' && def.category !== 'block_pair');
      let pick = null;
      if (useLocal) {
        const localPool = blockDefs.filter(def => def.category !== 'block_pair' || this.config.allowTwoBlockGlitches);
        pick = this._pickEffect(localPool, now, audio);
      } else {
        pick =
          this._pickEffect(textDefs, now, audio) ||
          this._pickEffect(nonLocalFallback.length ? nonLocalFallback : fallback, now, audio);
      }
      if (pick && this._spawnEffect(pick, now, audio)) {
        remaining -= 1;
      } else {
        break;
      }
    }
  }

  _spawnEffect(def, now, audio, options = {}) {
    if (!this._cooldownReady(def, now)) return;
    if (def.exclusive && this.active.some(effect => effect.id === def.id)) return;
    if (def.category === 'block_pair' && !this.config.allowTwoBlockGlitches) return;
    const blocked = this._getBlockedBlocks(def);
    if (options.blockId && blocked.has(options.blockId)) return;
    const context = this._context(audio, { ...options, excludeBlocks: blocked });
    const effect = new EffectInstance(def, context);
    if (def.category === 'block' && !effect.rect) {
      effect.cleanup(context);
      return;
    }
    if (def.category === 'block_pair' && (!effect.rectA || !effect.rectB)) {
      effect.cleanup(context);
      return;
    }
    this.active.push(effect);
    this.lastRun.set(def.id, now);
    allocationDetector.record('glitchSpawns', 1);
    return effect;
  }

  _pickEffect(defs, now, audio, options = {}) {
    const electricDisabled = this.config.electricEffectsEnabled === false;
    const available = defs.filter(def => {
      if (electricDisabled && hasAnyTag(def.tags, ['electric-special'])) return false;
      return this._cooldownReady(def, now);
    });
    if (!available.length) return null;
    const requiredTags = options.tags && options.tags.length ? options.tags : null;
    const filtered = requiredTags ? available.filter(def => hasAnyTag(def.tags, requiredTags)) : available;
    const pool = filtered.length ? filtered : available;
    const weights = pool.map(def => this._weightFor(def, audio));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[0];
  }

  _weightFor(def, audio) {
    let weight = def.weight ?? 1;
    const tags = def.tags || [];
    if (audio?.peak) {
      weight += 0.5;
      if (hasAnyTag(tags, ['electric', 'signal', 'color'])) weight += 0.6;
    }
    if (audio?.low) {
      if (hasAnyTag(tags, ['deform', 'tear', 'smear'])) weight += audio.low * 1.4;
      if (LOW_IDS.has(def.id)) weight += audio.low * 1.2;
    }
    if (audio?.high) {
      if (hasAnyTag(tags, ['electric', 'color', 'spark'])) weight += audio.high * 1.35;
      if (HIGH_IDS.has(def.id)) weight += audio.high * 1.1;
    }
    if (audio?.mid && hasAnyTag(tags, ['signal'])) weight += audio.mid * 0.4;
    if (def.category === 'screen') weight *= audio?.peak ? 1.25 : 0.85;
    if (def.category === 'text') weight *= 0.9;
    return weight;
  }

  _cooldownReady(def, now) {
    const last = this.lastRun.get(def.id) || 0;
    const cooldown = this._resolveCooldown(def);
    return now - last > cooldown * 1000;
  }

  _cooldownReadyAny(defs, now) {
    return defs.some(def => this._cooldownReady(def, now));
  }

  _resolveCooldown(def) {
    if (def.cooldownKey && this.config[def.cooldownKey] !== undefined) {
      return Math.max(0, Number(this.config[def.cooldownKey]) || 0);
    }
    return def.cooldown || 0;
  }

  _rebuildBlockCache() {
    this.blockList = [];
    this.blockWeightSum = 0;
    this.blockPairList = [];
    this.blockPairWeightSum = 0;

    const entries = Object.entries(this.blocks || {});
    for (let i = 0; i < entries.length; i++) {
      const [id, block] = entries[i];
      if (!block || !block.rect) continue;
      const rect = block.rect;
      const cx = rect.x + rect.w * 0.5;
      const cy = rect.y + rect.h * 0.5;
      const weight = block.importance || 1;
      this.blockList.push({ id, rect, weight, cx, cy });
      this.blockWeightSum += weight;
    }

    if (this.blockList.length < 2) return;
    const pairs = [];
    for (let i = 0; i < this.blockList.length; i++) {
      const a = this.blockList[i];
      for (let j = i + 1; j < this.blockList.length; j++) {
        const b = this.blockList[j];
        const dx = a.cx - b.cx;
        const dy = a.cy - b.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const weight = (a.weight + b.weight) / Math.max(1, dist);
        pairs.push({ a: a.id, b: b.id, dist, weight });
      }
    }
    pairs.sort((p, q) => p.dist - q.dist);
    const maxPairs = Math.min(pairs.length, Math.max(12, this.blockList.length * 4));
    this.blockPairList = pairs.slice(0, maxPairs);
    let sum = 0;
    for (let i = 0; i < this.blockPairList.length; i++) sum += this.blockPairList[i].weight;
    this.blockPairWeightSum = sum;
  }

  _getActiveLocalCount() {
    return this.active.filter(effect => effect.category === 'block' || effect.category === 'block_pair').length;
  }

  _getAvailableSlots() {
    const maxCount = this.config.maxSimultaneousGlitches || 1;
    return Math.max(0, maxCount - this.active.length);
  }

  _getAvailableLocalSlots() {
    const maxLocal = this.config.maxSimultaneousLocal || 1;
    return Math.max(0, maxLocal - this._getActiveLocalCount());
  }

  _getBlockedBlocks(def) {
    const blocked = new Set();
    const newAllows = !!def.allowOverlap;
    this.active.forEach(effect => {
      const ids = [];
      if (effect.block) ids.push(effect.block);
      if (effect.blockA) ids.push(effect.blockA);
      if (effect.blockB) ids.push(effect.blockB);
      if (!ids.length) return;
      if (!newAllows || !effect.allowOverlap) {
        ids.forEach(id => {
          if (id && id !== 'none') blocked.add(id);
        });
      }
    });
    return blocked;
  }

  _nextGlobalInterval(audio) {
    const min = this.config.glitchIntervalMinSec * 1000;
    const max = this.config.glitchIntervalMaxSec * 1000;
    let base = this._randRange(min, max);
    if (this.config.musicReactiveGlitches) {
      const boost = 1 - clamp(audio?.energy || 0, 0, 1) * 0.4;
      base *= boost;
    }
    const moodMul = clamp(this.moodMultipliers.freqMul || 1, 0.7, 1.6);
    return base / moodMul;
  }

  _nextLocalInterval(audio) {
    const min = (this.config.localGlitchIntervalMinSec ?? 6) * 1000;
    const max = (this.config.localGlitchIntervalMaxSec ?? 16) * 1000;
    let base = this._randRange(min, max);
    if (this.config.musicReactiveGlitches) {
      const boost = 1 - clamp(audio?.energy || 0, 0, 1) * 0.3;
      base *= boost;
    }
    const freqBoost = clamp(this.config.localGlitchFrequencyBoost ?? 1, 0, 2);
    const moodMul = clamp(this.moodMultipliers.freqMul || 1, 0.7, 1.6);
    const safeBoost = Math.max(0.2, freqBoost);
    return base / (moodMul * safeBoost);
  }

  _context(audio, options = {}) {
    const userIntensity = clamp(this.config.glitchIntensity ?? 1, 0.2, 2.5);
    const moodMul = this.moodMultipliers.intensityMul || 1;
    const intensityScale = (0.6 + Math.pow(userIntensity, 1.6)) * moodMul;
    const localBoost = clamp(this.config.localGlitchIntensityBoost ?? 1, 0, 2);
    const localIntensityScale = clamp((0.7 + Math.pow(userIntensity, 1.7)) * moodMul * localBoost, 0, 6);
    const vw = window.innerWidth || 2560;
    const vh = window.innerHeight || 1440;
    const viewportScale = clamp(Math.min(vw / 2560, vh / 1440), 0.75, 1.5);
    const excludeBlocks = options.excludeBlocks || null;
    const preferredBlock = options.blockId || null;
    const preferredPair = options.blockPair || null;
    let ctx = this._ctxCache;
    if (!ctx) {
      ctx = {
        blocks: this.blocks,
        blockLabels: this.blockLabels,
        textTargets: this.textTargets,
        config: this.config,
        excludeBlocks: null,
        preferredBlock: null,
        preferredPair: null,
        symbolSet: this.config.alienSymbolSet || DEFAULT_SYMBOL_SET,
        symbolStrength: this.config.alienAlphabetStrength || 0.7,
        intensityScale: 1,
        localIntensityScale: 1,
        viewportScale: 1,
        rand: Math.random,
        audio: null,
        pickBlock: null,
        pickBlockPair: null,
        pickTextTargets: null,
      };
      ctx.pickBlock = () =>
        pickWeightedBlockList(this.blockList, this.blockWeightSum, ctx.excludeBlocks, ctx.preferredBlock);
      ctx.pickBlockPair = () =>
        pickWeightedBlockPairList(
          this.blockPairList,
          this.blockPairWeightSum,
          ctx.excludeBlocks,
          ctx.preferredBlock,
          ctx.preferredPair
        );
      ctx.pickTextTargets = () => pickTextTargets(ctx.textTargets);
      this._ctxCache = ctx;
      allocationDetector.record('glitchContext', 1);
    }
    ctx.blocks = this.blocks;
    ctx.blockLabels = this.blockLabels;
    ctx.textTargets = this.textTargets;
    ctx.config = this.config;
    ctx.excludeBlocks = excludeBlocks;
    ctx.preferredBlock = preferredBlock;
    ctx.preferredPair = preferredPair;
    ctx.symbolSet = this.config.alienSymbolSet || DEFAULT_SYMBOL_SET;
    ctx.symbolStrength = this.config.alienAlphabetStrength || 0.7;
    ctx.intensityScale = intensityScale;
    ctx.localIntensityScale = localIntensityScale;
    ctx.viewportScale = viewportScale;
    ctx.audio = audio;
    return ctx;
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
    this.allowOverlap = !!def.allowOverlap;
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

function pickWeightedBlockList(blockList, weightSum, exclude = null, preferred = null) {
  if (!blockList || !blockList.length) return null;
  if (preferred) {
    for (let i = 0; i < blockList.length; i++) {
      if (blockList[i].id === preferred && (!exclude || !exclude.has(preferred))) return preferred;
    }
  }
  let total = weightSum;
  if (exclude && exclude.size) {
    total = 0;
    for (let i = 0; i < blockList.length; i++) {
      const id = blockList[i].id;
      if (!exclude.has(id)) total += blockList[i].weight;
    }
  }
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (let i = 0; i < blockList.length; i++) {
    const entry = blockList[i];
    if (exclude && exclude.has(entry.id)) continue;
    r -= entry.weight;
    if (r <= 0) return entry.id;
  }
  return blockList[0].id;
}

function pickWeightedBlockPairList(pairList, weightSum, exclude = null, preferredBlock = null, preferredPair = null) {
  if (!pairList || pairList.length === 0) return null;
  if (preferredPair) {
    const a = Array.isArray(preferredPair) ? preferredPair[0] : preferredPair.a;
    const b = Array.isArray(preferredPair) ? preferredPair[1] : preferredPair.b;
    if (a && b && (!exclude || (!exclude.has(a) && !exclude.has(b)))) return { a, b };
  }

  let total = weightSum;
  if (exclude || preferredBlock) {
    total = 0;
    for (let i = 0; i < pairList.length; i++) {
      const pair = pairList[i];
      if (exclude && (exclude.has(pair.a) || exclude.has(pair.b))) continue;
      if (preferredBlock && pair.a !== preferredBlock && pair.b !== preferredBlock) continue;
      total += pair.weight;
    }
  }
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (let i = 0; i < pairList.length; i++) {
    const pair = pairList[i];
    if (exclude && (exclude.has(pair.a) || exclude.has(pair.b))) continue;
    if (preferredBlock && pair.a !== preferredBlock && pair.b !== preferredBlock) continue;
    r -= pair.weight;
    if (r <= 0) return { a: pair.a, b: pair.b };
  }
  const fallback = pairList[0];
  return fallback ? { a: fallback.a, b: fallback.b } : null;
}

function pickTextTargets(targets) {
  if (!targets || targets.length === 0) return [];
  const count = Math.min(2, Math.max(1, Math.floor(Math.random() * 2) + 1));
  if (targets.length <= count) return targets.slice(0, count);
  const result = [];
  const first = Math.floor(Math.random() * targets.length);
  result.push(targets[first]);
  if (count > 1) {
    let second = Math.floor(Math.random() * targets.length);
    if (second === first) second = (second + 1) % targets.length;
    result.push(targets[second]);
  }
  return result;
}

const LOW_IDS = new Set([2, 4, 5, 7, 9, 11, 12, 13, 20, 21, 23, 24]);
const HIGH_IDS = new Set([1, 3, 6, 8, 14, 15, 18, 22, 73, 74]);

function hasAnyTag(tags, list) {
  if (!tags || !tags.length || !list || !list.length) return false;
  return tags.some(tag => list.includes(tag));
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
