export class MicroAnimations {
  constructor(bus, thresholds = {}, options = {}) {
    this.bus = bus;
    this.thresholds = {
      cpuHigh: 80,
      gpuHigh: 80,
      netHigh: 80,
      ...thresholds,
    };
    this.messages = {
      thermalSpike: 'THERMAL SPIKE',
      gpuOverload: 'GPU OVERLOAD',
      linkSaturated: 'LINK SATURATED',
      trendUp: '▲',
      trendDown: '▼',
    };
    this.textScale = options.textScale || 1;
    this.prev = {};
    this.markers = [];
    this.lastAlertAt = 0;
  }

  updateThresholds(next) {
    Object.assign(this.thresholds, next);
  }

  setMessages(messages = {}) {
    Object.assign(this.messages, messages);
  }

  setTextScale(scale = 1) {
    this.textScale = scale;
  }

  updateMetrics(metrics = {}) {
    const now = performance.now();
    const keys = ['cpu', 'gpu', 'net'];
    keys.forEach(key => {
      const value = metrics[key];
      if (value === undefined || value === null) return;
      const prev = this.prev[key] ?? value;
      if (Math.abs(value - prev) >= 3) {
        this.markers.push({
          key,
          dir: value > prev ? 'up' : 'down',
          life: 0.6,
          alpha: 1,
        });
      }
      this.prev[key] = value;
    });

    if (now - this.lastAlertAt > 30000) {
      if (metrics.cpu >= this.thresholds.cpuHigh) {
        this.bus.emit('message', { text: this.messages.thermalSpike, ttl: 1.2 });
        this.lastAlertAt = now;
      } else if (metrics.gpu >= this.thresholds.gpuHigh) {
        this.bus.emit('message', { text: this.messages.gpuOverload, ttl: 1.2 });
        this.lastAlertAt = now;
      } else if (metrics.net >= this.thresholds.netHigh) {
        this.bus.emit('message', { text: this.messages.linkSaturated, ttl: 1.2 });
        this.lastAlertAt = now;
      }
    }
  }

  reset() {
    this.prev = {};
    this.markers = [];
    this.lastAlertAt = 0;
  }

  update(dt) {
    this.markers.forEach(marker => {
      marker.life -= dt;
      marker.alpha = Math.max(0, marker.life / 0.6);
    });
    this.markers = this.markers.filter(m => m.life > 0);
  }

  render(ctx, blocks) {
    const system = blocks.system || blocks.systemLoad || blocks.metrics;
    if (!system?.rect) return;
    const rect = system.rect;
    ctx.save();
    ctx.font = `700 ${Math.round(16 * this.textScale)}px Orbitron, sans-serif`;
    ctx.textBaseline = 'middle';
    this.markers.forEach((marker, idx) => {
      ctx.fillStyle = `rgba(141,252,79,${marker.alpha})`;
      const x = rect.x + rect.w - 30 - idx * 14;
      const y = rect.y + 30 + idx * 16;
      ctx.fillText(marker.dir === 'up' ? this.messages.trendUp : this.messages.trendDown, x, y);
    });
    ctx.restore();
  }
}
