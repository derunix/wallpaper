const DEFAULTS = {
  alpha: 0.12,
  minHoldSec: 8,
  maxHoldSec: 15,
};

export class MoodClassifier {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.energyEma = null;
    this.chaosEma = null;
    this.lastMoodClass = 'steady';
    this.moodChangeTs = 0;
    this.moodStableForSec = 0;
    this.lastState = null;
  }

  update({
    audioState = {},
    nowPlaying = {},
    timeState = null,
    aggressiveness = 1,
    now = performance.now(),
  } = {}) {
    const energyRaw = clamp(audioState.energy ?? 0, 0, 1);
    const transient = clamp(audioState.transient ?? 0, 0, 1);
    const low = clamp(audioState.low ?? 0, 0, 1);
    const mid = clamp(audioState.mid ?? 0, 0, 1);
    const high = clamp(audioState.high ?? 0, 0, 1);
    const chaosRaw = clamp(transient * 0.6 + high * 0.4 + (audioState.peak ? 0.2 : 0), 0, 1);

    const alpha = clamp(this.options.alpha ?? 0.12, 0.02, 0.5);
    this.energyEma = this.energyEma === null ? energyRaw : lerp(this.energyEma, energyRaw, alpha);
    this.chaosEma = this.chaosEma === null ? chaosRaw : lerp(this.chaosEma, chaosRaw, alpha);

    const agg = clamp(aggressiveness ?? 1, 0.5, 2);
    const energy = clamp(this.energyEma * agg, 0, 1);
    const chaos = clamp(this.chaosEma * agg, 0, 1);

    const bias = resolveTimeBias(timeState);
    const calmThreshold = clamp(0.08 + bias, 0.04, 0.18);
    const chaoticThreshold = clamp(0.65 + bias * 0.4, 0.5, 0.85);
    const tenseEnergyThreshold = clamp(0.55 + bias * 0.5, 0.35, 0.75);
    const tenseChaosMin = clamp(0.35 + bias * 0.35, 0.2, 0.55);
    const tenseChaosMax = clamp(0.65 + bias * 0.35, 0.45, 0.85);

    const isPlaying = nowPlaying?.isPlaying ?? nowPlaying?.playbackState === 'playing';
    let moodClass = 'steady';

    if (!isPlaying || energy < calmThreshold) {
      moodClass = 'calm';
    } else if (chaos > chaoticThreshold && energy > 0.35) {
      moodClass = 'chaotic';
    } else if (energy > tenseEnergyThreshold && chaos >= tenseChaosMin && chaos <= tenseChaosMax) {
      moodClass = 'tense';
    } else {
      moodClass = 'steady';
    }

    let confidence = 0.55;
    if (!isPlaying || energy < calmThreshold) {
      const gap = clamp(calmThreshold - energy, 0, calmThreshold);
      confidence = clamp(0.45 + gap / Math.max(0.02, calmThreshold), 0.4, 0.96);
      if (!isPlaying) confidence = clamp(confidence + 0.08, 0, 1);
    } else if (moodClass === 'chaotic') {
      const energyScore = clamp((energy - 0.35) / 0.65, 0, 1);
      const chaosScore = clamp((chaos - chaoticThreshold) / (1 - chaoticThreshold), 0, 1);
      confidence = clamp(0.45 + 0.55 * Math.min(energyScore, chaosScore), 0.35, 0.95);
    } else if (moodClass === 'tense') {
      const energyScore = clamp((energy - tenseEnergyThreshold) / (1 - tenseEnergyThreshold), 0, 1);
      const midChaos = (tenseChaosMin + tenseChaosMax) * 0.5;
      const chaosScore = clamp(1 - Math.abs(chaos - midChaos) / Math.max(0.01, (tenseChaosMax - tenseChaosMin) * 0.5), 0, 1);
      confidence = clamp(0.4 + 0.5 * Math.min(energyScore, chaosScore), 0.35, 0.9);
    } else {
      const calmGap = Math.abs(energy - calmThreshold);
      const tenseGap = Math.abs(energy - tenseEnergyThreshold);
      const chaosGap = Math.abs(chaos - chaoticThreshold);
      const margin = Math.min(calmGap, tenseGap, chaosGap);
      confidence = clamp(0.4 + margin * 0.9, 0.35, 0.8);
    }

    if (!this.moodChangeTs) this.moodChangeTs = now;
    const holdSec = lerp(this.options.minHoldSec, this.options.maxHoldSec, 1 - confidence);
    if (moodClass !== this.lastMoodClass) {
      if (now - this.moodChangeTs >= holdSec * 1000) {
        this.lastMoodClass = moodClass;
        this.moodChangeTs = now;
        this.moodStableForSec = 0;
      } else {
        moodClass = this.lastMoodClass;
      }
    }

    this.moodStableForSec = (now - this.moodChangeTs) / 1000;

    const state = {
      moodClass,
      confidence,
      features: {
        energy,
        chaos,
        transient,
        lowDrive: low,
        midPresence: mid,
        highPresence: high,
        energyRaw,
        chaosRaw,
        energyEma: this.energyEma,
        chaosEma: this.chaosEma,
        timeBias: bias,
        aggressiveness: agg,
        thresholds: {
          calm: calmThreshold,
          tenseEnergy: tenseEnergyThreshold,
          tenseChaosMin,
          tenseChaosMax,
          chaotic: chaoticThreshold,
        },
      },
      lastMoodClass: this.lastMoodClass,
      moodStableForSec: this.moodStableForSec,
      moodChangeTs: this.moodChangeTs,
    };
    this.lastState = state;
    return state;
  }

  getState() {
    return this.lastState;
  }
}

function resolveTimeBias(timeState) {
  const hour = timeState?.hour;
  if (hour === undefined || hour === null) return 0;
  if (hour >= 1 && hour < 6) return 0.08;
  if (hour >= 20 || hour === 0) return -0.06;
  return 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
