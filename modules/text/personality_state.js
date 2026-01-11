import { clamp, lerp } from '../utils.js';
import { loadState, saveState } from '../utils/persistence.js';

const STORAGE_KEY = 'semantic_personality_v1';
const SAVE_INTERVAL_MS = 12000;

const BASELINE = {
  fatigue: 0.45,
  irritation: 0.35,
  suspicion: 0.32,
  coherence: 0.7,
  shame: 0.2,
};

export class PersonalityState {
  constructor(options = {}) {
    this.storageKey = options.storageKey || STORAGE_KEY;
    this.persist = options.persist ?? true;
    this.values = { ...BASELINE };
    this.lastUpdateTs = Date.now();
    this.lastSaveTs = 0;
    this._dirty = false;
    if (this.persist) this._load();
  }

  getState() {
    return { ...this.values };
  }

  update(dt, context = {}, mode = 'SMART') {
    const now = Date.now();
    const elapsedSec = Math.max(0, dt || 0);
    const systemState = context.systemState || 'STABLE';
    const events = context.systemEvents || {};
    const input = context.userInputEvents || {};
    const audio = context.audioState || {};
    const glitch = context.glitchState || {};
    const entropy = clamp(context.entropyLevel ?? 0.4, 0, 1);

    const glitchCount = glitch.activeCount ?? (glitch.activeGlitches?.length || 0);
    const overload = systemState === 'OVERLOAD' || systemState === 'DEGRADED' || systemState === 'ANOMALY';

    let fatigue = this.values.fatigue;
    let irritation = this.values.irritation;
    let suspicion = this.values.suspicion;
    let coherence = this.values.coherence;
    let shame = this.values.shame;

    const lowEnergy = (audio.energy ?? 0) < 0.12;
    const restFactor = (lowEnergy ? 0.004 : 0) + (systemState === 'IDLE' ? 0.003 : 0) + (systemState === 'RECOVERY' ? 0.002 : 0);
    const strainFactor = 0.0025 + (overload ? 0.006 : 0) + (glitchCount ? 0.002 : 0);
    fatigue = clamp(fatigue + elapsedSec * strainFactor - elapsedSec * restFactor, 0, 1);

    if (input.rapidClicks) irritation = clamp(irritation + 0.09, 0, 1);
    if (input.click) irritation = clamp(irritation + 0.02, 0, 1);
    if (events.cpuSpike || events.gpuSpike) irritation = clamp(irritation + 0.05, 0, 1);
    irritation = clamp(irritation - elapsedSec * 0.0015, 0, 1);

    if ((events.netDrop || events.endpointOffline) && Math.random() < 0.8) {
      suspicion = clamp(suspicion + 0.08, 0, 1);
    }
    if (systemState === 'STABLE' && entropy < 0.2) {
      suspicion = clamp(suspicion + elapsedSec * 0.002, 0, 1);
    }
    suspicion = clamp(suspicion - elapsedSec * 0.0012, 0, 1);

    const coherenceDrain = elapsedSec * (0.002 + glitchCount * 0.004 + (overload ? 0.004 : 0));
    const coherenceGain = elapsedSec * (systemState === 'RECOVERY' ? 0.01 : 0.003);
    coherence = clamp(coherence + coherenceGain - coherenceDrain, 0, 1);

    if (mode === 'DUMB_ROBOT') shame = clamp(shame + elapsedSec * 0.006, 0, 1);
    shame = clamp(shame - elapsedSec * 0.002, 0, 1);

    this.values = { fatigue, irritation, suspicion, coherence, shame };
    this.lastUpdateTs = now;
    this._dirty = true;
    if (this.persist && now - this.lastSaveTs > SAVE_INTERVAL_MS) {
      this._save();
    }
    return this.getState();
  }

  markRobotUsed() {
    this.values.shame = clamp(this.values.shame + 0.12, 0, 1);
    this._dirty = true;
  }

  markApology() {
    this.values.shame = clamp(this.values.shame - 0.25, 0, 1);
    this._dirty = true;
  }

  applyDecay(elapsedMs) {
    const seconds = Math.max(0, elapsedMs / 1000);
    const halfLife = 4 * 60 * 60;
    const decay = clamp(1 - Math.exp(-seconds / Math.max(1, halfLife)), 0, 1);
    this.values.fatigue = lerp(this.values.fatigue, BASELINE.fatigue, decay);
    this.values.irritation = lerp(this.values.irritation, BASELINE.irritation, decay);
    this.values.suspicion = lerp(this.values.suspicion, BASELINE.suspicion, decay);
    this.values.coherence = lerp(this.values.coherence, BASELINE.coherence, decay);
    this.values.shame = lerp(this.values.shame, BASELINE.shame, decay);
  }

  _load() {
    const stored = loadState(this.storageKey, null);
    if (!stored || typeof stored !== 'object') return;
    const values = stored.values || {};
    this.values = {
      fatigue: clamp(values.fatigue ?? BASELINE.fatigue, 0, 1),
      irritation: clamp(values.irritation ?? BASELINE.irritation, 0, 1),
      suspicion: clamp(values.suspicion ?? BASELINE.suspicion, 0, 1),
      coherence: clamp(values.coherence ?? BASELINE.coherence, 0, 1),
      shame: clamp(values.shame ?? BASELINE.shame, 0, 1),
    };
    const lastTs = stored.ts || 0;
    if (lastTs) this.applyDecay(Date.now() - lastTs);
  }

  _save() {
    if (!this.persist || !this.storageKey) return;
    this.lastSaveTs = Date.now();
    this._dirty = false;
    saveState(this.storageKey, { values: this.values, ts: this.lastSaveTs });
  }
}
