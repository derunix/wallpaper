const DEFAULT_SEQUENCES = [
  {
    id: 'signal_instability',
    steps: [
      { duration: 0.6, messageKey: 'signalInstability', action: 'glitchBurst' },
      { duration: 0.8, messageKey: 'realigningData', action: 'pulseSystem' },
      { duration: 0.6, messageKey: 'stable', action: 'profileEngineering' },
    ],
  },
  {
    id: 'sensor_desync',
    steps: [
      { duration: 0.6, messageKey: 'sensorDesync', action: 'markUncertain' },
      { duration: 0.8, messageKey: 'sensorSync', action: 'pulseSystem' },
      { duration: 0.6, messageKey: 'stable' },
    ],
  },
  {
    id: 'link_resync',
    steps: [
      { duration: 0.6, messageKey: 'linkResync', action: 'pulseNetwork' },
      { duration: 0.8, messageKey: 'linkStable' },
    ],
  },
  {
    id: 'audio_resync',
    steps: [
      { duration: 0.6, messageKey: 'audioResync', action: 'pulseWave' },
      { duration: 0.8, messageKey: 'audioStable' },
    ],
  },
  {
    id: 'memory_realloc',
    steps: [
      { duration: 0.7, messageKey: 'memoryReallocation', action: 'pulseSystem' },
      { duration: 0.7, messageKey: 'indexComplete' },
    ],
  },
  {
    id: 'observation_pass',
    steps: [
      { duration: 0.6, messageKey: 'observationPass', action: 'profileObservation' },
      { duration: 0.8, messageKey: 'engineeringMode', action: 'profileEngineering' },
    ],
  },
  {
    id: 'signature_trace',
    steps: [
      { duration: 0.7, messageKey: 'signatureTrace', action: 'signature' },
      { duration: 0.6, messageKey: 'lockConfirmed' },
    ],
  },
];

export class NarrativeEngine {
  constructor(bus, options = {}) {
    this.bus = bus;
    this.enabled = options.enabled ?? true;
    this.sequences = options.sequences || DEFAULT_SEQUENCES;
    this.active = null;
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.nextAt = performance.now() + this._randRange(30000, 60000);
    this.signature = null;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  update(dt, context = {}) {
    if (!this.enabled) {
      this._updateSignature(dt);
      return;
    }

    if (this.active) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepIndex += 1;
        if (this.stepIndex >= this.active.steps.length) {
          this.active = null;
          this.stepIndex = 0;
          const entropy = context.entropy ?? 0.4;
          this.nextAt = performance.now() + this._randRange(28000, 52000) * (1.1 - entropy * 0.4);
        } else {
          this._applyStep(this.active.steps[this.stepIndex], context);
        }
      }
    } else {
      const now = performance.now();
      const entropy = context.entropy ?? 0.4;
      if (now >= this.nextAt && Math.random() < 0.35 + entropy * 0.4) {
        this.startRandom(context);
      }
    }

    this._updateSignature(dt);
  }

  startRandom(context) {
    if (!this.sequences.length) return;
    const pick = this.sequences[Math.floor(Math.random() * this.sequences.length)];
    this.start(pick.id, context);
  }

  start(id, context) {
    const seq = this.sequences.find(s => s.id === id) || this.sequences[0];
    if (!seq) return;
    this.active = seq;
    this.stepIndex = 0;
    this._applyStep(seq.steps[0], context);
  }

  trigger(id, context) {
    this.start(id, context);
  }

  _applyStep(step, context) {
    this.stepTimer = step.duration ?? 0.8;
    if (step.messageKey) this.bus?.emit('message:key', { key: step.messageKey, ttl: 1.1 });
    if (step.message) this.bus?.emit('message', { text: step.message, ttl: 1.1 });
    if (step.action) this._runAction(step.action, context);
  }

  _runAction(action, context) {
    switch (action) {
      case 'glitchBurst':
        this.bus?.emit('glitch:manual');
        break;
      case 'pulseSystem':
        this.bus?.emit('block:pulse', { id: 'system' });
        break;
      case 'pulseNetwork':
        this.bus?.emit('block:pulse', { id: 'network' });
        break;
      case 'pulseWave':
        this.bus?.emit('block:pulse', { id: 'waveform' });
        break;
      case 'markUncertain':
        this.bus?.emit('block:uncertain', { id: 'system' });
        break;
      case 'profileObservation':
        this.bus?.emit('profile:temp', { profile: 'OBSERVATION', duration: 8 });
        break;
      case 'profileEngineering':
        this.bus?.emit('profile:temp', { profile: 'ENGINEERING', duration: 4 });
        break;
      case 'signature':
        this._startSignature(context);
        break;
      default:
        break;
    }
  }

  _startSignature(context) {
    const types = ['lattice', 'orbital'];
    const pick = types[Math.floor(Math.random() * types.length)];
    this.signature = { type: pick, ttl: 1.2, life: 1.2 };
  }

  _updateSignature(dt) {
    if (!this.signature) return;
    this.signature.life -= dt;
    if (this.signature.life <= 0) this.signature = null;
  }

  render(ctx, width, height) {
    if (!this.signature) return;
    const t = Math.max(0, this.signature.life / this.signature.ttl);
    ctx.save();
    ctx.globalAlpha = 0.6 * t;
    ctx.strokeStyle = 'rgba(141,252,79,0.6)';
    ctx.lineWidth = 2;
    if (this.signature.type === 'lattice') {
      const step = 24;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + height * 0.15, height);
        ctx.stroke();
      }
    } else {
      const cx = width * 0.5;
      const cy = height * 0.5;
      const radius = Math.min(width, height) * 0.32;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.6, Math.PI * 0.2, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  _randRange(min, max) {
    return min + Math.random() * (max - min);
  }
}
