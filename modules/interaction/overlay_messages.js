export class OverlayMessages {
  constructor(bus, resolver = null) {
    this.bus = bus;
    this.messages = [];
    this.resolver = resolver;
    this.bus.on('message', payload => this.add(payload));
    this.bus.on('message:key', payload => this.add({ key: payload?.key, ttl: payload?.ttl }));
  }

  setResolver(resolver) {
    this.resolver = resolver;
  }

  add({ text, key, ttl = 1.2 }) {
    const resolved = text || (key && this.resolver ? this.resolver(key) : '');
    if (!resolved) return;
    this.messages.push({
      text: resolved,
      ttl,
      life: ttl,
    });
  }

  update(dt) {
    this.messages.forEach(msg => {
      msg.life -= dt;
    });
    this.messages = this.messages.filter(msg => msg.life > 0);
  }

  render(ctx, width, height) {
    if (!this.messages.length) return;
    const msg = this.messages[0];
    const alpha = Math.max(0, msg.life / msg.ttl);
    ctx.save();
    ctx.fillStyle = `rgba(63,231,255,${0.75 * alpha})`;
    ctx.font = '700 18px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg.text, width / 2, height * 0.12);
    ctx.restore();
  }

  reset() {
    this.messages = [];
  }
}
