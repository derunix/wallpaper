export class InteractionStateMachine {
  constructor(bus, options = {}) {
    this.bus = bus;
    this.options = {
      idleTimeoutSec: 60,
      ...options,
    };
    this.state = 'STABLE';
    this.elapsedIdle = 0;
  }

  update(dt, audio, input) {
    const was = this.state;
    if (!input.focused) {
      this.state = 'IDLE';
    } else if (input.idle) {
      this.state = 'IDLE';
    } else if (audio?.energy > 0.7) {
      this.state = 'OVERLOAD';
    } else if (input.velocity && (Math.abs(input.velocity.x) + Math.abs(input.velocity.y)) > 60) {
      this.state = 'ACTIVE';
    } else {
      this.state = 'STABLE';
    }

    if (was !== this.state) {
      this.bus.emit('state:change', { from: was, to: this.state });
    }
    return this.state;
  }

  getState() {
    return this.state;
  }
}
