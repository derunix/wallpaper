import { clamp } from '../utils.js';

export const INTENTS = {
  TRACK_REACT: 'TRACK_REACT',
  SYSTEM_COMMENT: 'SYSTEM_COMMENT',
  ANOMALY_WARNING: 'ANOMALY_WARNING',
  RECOVERY_NOTE: 'RECOVERY_NOTE',
  USER_REACTION: 'USER_REACTION',
  SELF_DIAG: 'SELF_DIAG',
  IDLE_MUMBLE: 'IDLE_MUMBLE',
  PREEMPTIVE_WARNING: 'PREEMPTIVE_WARNING',
};

const WARNING_COOLDOWN_MIN_MS = 2 * 60 * 1000;
const WARNING_COOLDOWN_MAX_MS = 5 * 60 * 1000;

export class IntentPlanner {
  constructor(options = {}) {
    this.options = { ...options };
    this.lastPreemptiveAt = 0;
    this.nextPreemptiveAfter = randRange(WARNING_COOLDOWN_MIN_MS, WARNING_COOLDOWN_MAX_MS);
  }

  plan(context = {}) {
    const now = context.now ?? performance.now();
    if (context.preemptiveWarning && this._preemptiveReady(now)) {
      this._markPreemptive(now);
      return { intent: INTENTS.PREEMPTIVE_WARNING, reason: 'preemptive' };
    }

    const eventType = context.eventType || '';
    if (eventType === 'TRACK_CHANGE' || context.musicContext?.novelty?.isNewTrack) {
      return { intent: INTENTS.TRACK_REACT, reason: 'track' };
    }

    // Narrative arc: follow up on recent events after system returns to calm
    const lastEvent = context.lastEventType || '';
    const lastEventAt = context.lastEventAt || 0;
    const nowMs = context.now ?? performance.now();
    const timeSince = nowMs - lastEventAt;
    if (lastEvent && timeSince > 8000 && timeSince < 90000) {
      const isSpikeEvent = lastEvent === 'CPU_SPIKE' || lastEvent === 'GPU_SPIKE' || lastEvent === 'DISK_ANOMALY' || lastEvent === 'NET_DROP';
      const isNowCalm = context.systemState === 'STABLE' || context.systemState === 'RECOVERY' || context.systemState === 'IDLE';
      if (isSpikeEvent && isNowCalm && Math.random() < 0.28) {
        return { intent: INTENTS.RECOVERY_NOTE, reason: 'narrative_arc' };
      }
    }

    if (eventType === 'RECOVERY' || context.systemState === 'RECOVERY') {
      return { intent: INTENTS.RECOVERY_NOTE, reason: 'recovery' };
    }

    if (eventType && isAnomalyEvent(eventType)) {
      return { intent: INTENTS.ANOMALY_WARNING, reason: 'event' };
    }

    const systemEvents = context.systemEvents || {};
    if (systemEvents.cpuSpike || systemEvents.gpuSpike || systemEvents.netDrop || systemEvents.diskAnomaly) {
      return { intent: INTENTS.ANOMALY_WARNING, reason: 'system' };
    }

    const user = context.userInputEvents || {};
    if (user.wake || user.firstClickAfterIdle || user.rapidClicks) {
      return { intent: INTENTS.USER_REACTION, reason: 'user' };
    }

    if (context.systemState === 'IDLE' || user.longIdle) {
      return { intent: INTENTS.IDLE_MUMBLE, reason: 'idle' };
    }

    const personality = context.personality || {};
    const fatigue = clamp(personality.fatigue ?? 0.5, 0, 1);
    const irritation = clamp(personality.irritation ?? 0.4, 0, 1);
    const suspicion = clamp(personality.suspicion ?? 0.4, 0, 1);

    if (fatigue > 0.75 && Math.random() < 0.4 + irritation * 0.1) {
      return { intent: INTENTS.IDLE_MUMBLE, reason: 'fatigue' };
    }

    if (suspicion > 0.7 && Math.random() < 0.35) {
      return { intent: INTENTS.SELF_DIAG, reason: 'suspicion' };
    }

    if (context.coherence !== undefined && context.coherence < 0.4 && Math.random() < 0.35 + suspicion * 0.15) {
      return { intent: INTENTS.SELF_DIAG, reason: 'coherence' };
    }

    return { intent: INTENTS.SYSTEM_COMMENT, reason: 'default' };
  }

  shouldPreemptive(context = {}) {
    if (!context.preemptiveWarnings) return false;
    const now = context.now ?? performance.now();
    if (!this._preemptiveReady(now)) return false;
    return !!context.approachingRobot;
  }

  _preemptiveReady(now) {
    return now - this.lastPreemptiveAt >= this.nextPreemptiveAfter;
  }

  _markPreemptive(now) {
    this.lastPreemptiveAt = now;
    this.nextPreemptiveAfter = randRange(WARNING_COOLDOWN_MIN_MS, WARNING_COOLDOWN_MAX_MS);
  }
}

function isAnomalyEvent(type) {
  return (
    type === 'CPU_SPIKE' ||
    type === 'GPU_SPIKE' ||
    type === 'NET_DROP' ||
    type === 'DISK_ANOMALY' ||
    type === 'GLITCH_EVENT'
  );
}

function randRange(min, max) {
  const safeMin = clamp(min, 0, max);
  const safeMax = Math.max(safeMin, max);
  return safeMin + Math.random() * (safeMax - safeMin);
}
