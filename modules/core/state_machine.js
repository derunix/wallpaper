import { clamp, lerp } from '../utils.js';

const STATES = ['STABLE', 'ACTIVE', 'OVERLOAD', 'ANOMALY', 'IDLE', 'DEGRADED', 'RECOVERY'];

const PROCESS_DEFS = [
  { id: 'BACKGROUND INDEXING', key: 'processBackgroundIndexing', min: 6, max: 12, effects: { drift: 0.6, glitch: 0.1 } },
  { id: 'SIGNAL CALIBRATION', key: 'processSignalCalibration', min: 5, max: 10, effects: { drift: 0.4, contrast: -0.05 } },
  { id: 'MEMORY REALLOCATION', key: 'processMemoryReallocation', min: 8, max: 14, effects: { drift: 0.5, jitter: 0.15 } },
  { id: 'SENSOR SYNC', key: 'processSensorSync', min: 5, max: 9, effects: { drift: 0.3, glitch: 0.08 } },
  { id: 'DATA COMPRESSION', key: 'processDataCompression', min: 6, max: 11, effects: { drift: 0.35, contrast: -0.04 } },
];

export class CoreStateMachine {
  constructor(bus, options = {}) {
    this.bus = bus;
    this.options = {
      degradationEnabled: true,
      timeOfDayAdaptive: true,
      ...options,
    };
    this.state = 'STABLE';
    this.prevState = 'STABLE';
    this.degradation = 0;
    this.degradationTarget = 0;
    this.recoveryTimer = 0;
    this.anomaly = { active: false, timer: 0, type: null };
    this.processes = [];
    this.nextProcessAt = performance.now() + this._randRange(20000, 45000);
    this.prevMetrics = null;
    this.prevOnline = null;
    this.lastAudioEnergy = 0;
    this.layerSeed = Math.random() * 100;
    this.time = 0;
    this.confidence = {};
  }

  setOptions(next = {}) {
    Object.assign(this.options, next);
  }

  update(dt, context = {}) {
    this.time += dt;
    const input = context.input || {};
    const audio = context.audio || {};
    const metrics = context.metrics || null;
    const perfOnline = context.perfOnline;
    const entropy = context.entropy ?? 0.4;
    const time = context.time || {};

    const presenceActive = !input.idle && (input.focused !== false);
    let baseState = presenceActive ? 'ACTIVE' : 'IDLE';
    if (presenceActive && metrics) {
      const cpu = metrics.cpu ?? 0;
      const gpu = metrics.gpu_usage ?? metrics.gpu ?? 0;
      if (cpu > 85 || gpu > 85) baseState = 'OVERLOAD';
    }
    if (presenceActive && audio.energy > 0.65) baseState = 'OVERLOAD';
    if (!presenceActive && audio.energy > 0.2) baseState = 'ACTIVE';

    this._detectAnomalies(dt, { metrics, perfOnline, audio });
    this._updateProcesses(dt, entropy);
    this._updateDegradation(dt, entropy, time);
    this._updateConfidence(dt);

    let state = baseState;
    if (this.recoveryTimer > 0) state = 'RECOVERY';
    else if (this.anomaly.active) state = 'ANOMALY';
    else if (this.degradation > 0.55) state = 'DEGRADED';
    if (!presenceActive && !this.anomaly.active && state !== 'DEGRADED' && state !== 'RECOVERY') {
      state = 'IDLE';
    }

    this._transition(state);

    const modifiers = this._computeModifiers(entropy);
    return {
      state: this.state,
      degradation: this.degradation,
      anomaly: this.anomaly,
      modifiers,
      confidence: this.confidence,
      processes: this.processes,
    };
  }

  reportDataStatus(blockId, ok, label = 'UNCERTAIN') {
    if (!blockId) return;
    if (!ok) {
      this.confidence[blockId] = { state: 'uncertain', timer: 2.2, label };
    } else if (this.confidence[blockId]?.state === 'uncertain') {
      this.confidence[blockId] = { state: 'confirming', timer: 1.4, label: 'CONFIRMED' };
      this.bus?.emit('message:key', { key: 'dataConfirmed', ttl: 1.1 });
    }
  }

  triggerAnomaly(typeKey = 'anomalyDetected') {
    this.anomaly.active = true;
    this.anomaly.timer = 2.8;
    this.anomaly.type = typeKey;
    this.bus?.emit('message:key', { key: typeKey, ttl: 1.2 });
    this.degradationTarget = Math.max(this.degradationTarget, 0.35);
  }

  _transition(next) {
    if (this.state === next) return;
    this.prevState = this.state;
    this.state = next;
    this.bus?.emit('core:state', { from: this.prevState, to: this.state });
    if (this.prevState === 'IDLE' && this.state === 'ACTIVE') {
      this.bus?.emit('message:key', { key: 'attentionAcquired', ttl: 1.1 });
    }
    if (this.state === 'RECOVERY') {
      this.bus?.emit('message:key', { key: 'selfRecovery', ttl: 1.1 });
    }
  }

  _detectAnomalies(dt, { metrics, perfOnline, audio }) {
    if (this.anomaly.timer > 0) {
      this.anomaly.timer = Math.max(0, this.anomaly.timer - dt);
      if (this.anomaly.timer === 0) {
        this.anomaly.active = false;
        this.anomaly.type = null;
      }
    }

    if (perfOnline !== undefined && this.prevOnline !== null && perfOnline !== this.prevOnline) {
      this.triggerAnomaly(perfOnline ? 'sensorSync' : 'sensorDesync');
    }
    this.prevOnline = perfOnline ?? this.prevOnline;

    if (metrics) {
      if (this.prevMetrics) {
        const cpuDelta = Math.abs((metrics.cpu ?? 0) - (this.prevMetrics.cpu ?? 0));
        const gpuDelta = Math.abs((metrics.gpu_usage ?? 0) - (this.prevMetrics.gpu_usage ?? 0));
        if (cpuDelta > 22 || gpuDelta > 22) {
          this.triggerAnomaly('anomalyDetected');
          this.confidence.system = { state: 'uncertain', timer: 2.2, label: 'SYSTEM UNCERTAIN' };
        }
        const net = metrics.download_speed ?? 0;
        if (net > 90000 && (audio?.energy ?? 0) < 0.15) {
          this.triggerAnomaly('unexpectedTraffic');
          this.confidence.network = { state: 'uncertain', timer: 2.2, label: 'NETWORK UNCERTAIN' };
        }
      }
      this.prevMetrics = { ...metrics };
    }

    if (audio?.energy !== undefined) {
      const diff = Math.abs(audio.energy - this.lastAudioEnergy);
      if (diff > 0.45) {
        this.triggerAnomaly('sensorDesync');
      }
      this.lastAudioEnergy = audio.energy;
    }
  }

  _updateProcesses(dt, entropy) {
    const now = performance.now();
    if (now >= this.nextProcessAt) {
      const def = PROCESS_DEFS[Math.floor(Math.random() * PROCESS_DEFS.length)];
      const duration = this._randRange(def.min, def.max);
      this.processes.push({ ...def, timeLeft: duration });
      if (def.key) this.bus?.emit('message:key', { key: def.key, ttl: 1.1 });
      const interval = this._randRange(18000, 42000) * clamp(1 - entropy * 0.3, 0.6, 1.2);
      this.nextProcessAt = now + interval;
    }

    this.processes.forEach(p => {
      p.timeLeft -= dt;
    });
    this.processes = this.processes.filter(p => p.timeLeft > 0);
  }

  _updateDegradation(dt, entropy, time) {
    if (!this.options.degradationEnabled) {
      this.degradation = lerp(this.degradation, 0, dt * 0.5);
      return;
    }
    let target = 0.05 + entropy * 0.2;
    if (this.options.timeOfDayAdaptive) {
      if (time.phase === 'night') target += 0.15;
      if (time.phase === 'evening') target += 0.12;
    }
    if (this.anomaly.active) target += 0.2;
    if (this.processes.length) target += 0.08;

    this.degradationTarget = clamp(target, 0, 0.8);
    const prev = this.degradation;
    this.degradation = lerp(this.degradation, this.degradationTarget, clamp(dt * 0.25, 0.05, 0.35));

    if (prev > 0.45 && this.degradation < 0.3) {
      this.recoveryTimer = Math.max(this.recoveryTimer, 1.6);
    }
    if (this.recoveryTimer > 0) {
      this.recoveryTimer = Math.max(0, this.recoveryTimer - dt);
    }
  }

  _updateConfidence(dt) {
    Object.keys(this.confidence).forEach(key => {
      const entry = this.confidence[key];
      if (!entry) return;
      entry.timer = Math.max(0, entry.timer - dt);
      if (entry.timer === 0) {
        if (entry.state === 'uncertain') {
          this.confidence[key] = { state: 'confirming', timer: 1.2, label: 'CONFIRMED' };
        } else if (entry.state === 'confirming') {
          this.confidence[key] = { state: 'stable', timer: 0, label: '' };
        }
      }
    });
  }

  _computeModifiers(entropy) {
    const processEffects = this.processes.reduce(
      (acc, p) => {
        acc.drift += p.effects?.drift ?? 0;
        acc.glitch += p.effects?.glitch ?? 0;
        acc.contrast += p.effects?.contrast ?? 0;
        acc.jitter += p.effects?.jitter ?? 0;
        return acc;
      },
      { drift: 0, glitch: 0, contrast: 0, jitter: 0 }
    );

    const driftBase = (0.4 + entropy) * 1.4 + this.degradation * 1.6 + processEffects.drift;
    const driftX = Math.sin(this.time * 0.45 + this.layerSeed) * driftBase;
    const driftY = Math.cos(this.time * 0.38 + this.layerSeed * 1.7) * driftBase;
    return {
      gridOffset: { x: driftX * 0.35, y: driftY * 0.35 },
      panelOffset: { x: driftX * 0.55, y: driftY * 0.55 },
      textOffset: { x: driftX * 0.85, y: driftY * 0.85 },
      contrast: clamp(1 - this.degradation * 0.25 + processEffects.contrast, 0.65, 1.2),
      glitchBoost: clamp(processEffects.glitch + (this.anomaly.active ? 0.2 : 0), 0, 0.6),
      textJitter: clamp(this.degradation * 0.4 + processEffects.jitter, 0, 0.6),
    };
  }

  _randRange(min, max) {
    return min + Math.random() * (max - min);
  }
}

export { STATES as CORE_STATES };
