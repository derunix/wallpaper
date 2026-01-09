export class InputManager {
  constructor(target = window, options = {}) {
    this.target = target;
    this.options = {
      idleTimeoutSec: 60,
      ...options,
    };
    this.pos = { x: 0, y: 0 };
    this.prev = { x: 0, y: 0 };
    this.delta = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.accel = { x: 0, y: 0 };
    this.isDown = false;
    this.button = 0;
    this.click = null;
    this.doubleClick = null;
    this.wheel = 0;
    this.lastMoveAt = performance.now();
    this.lastClickAt = 0;
    this.idle = false;
    this.focused = true;
    this.shiftKey = false;
    this.ctrlKey = false;
    this.altKey = false;
    this._bind();
  }

  _bind() {
    this.target.addEventListener('mousemove', e => this._onMove(e));
    this.target.addEventListener('mousedown', e => this._onDown(e));
    this.target.addEventListener('mouseup', e => this._onUp(e));
    this.target.addEventListener('wheel', e => this._onWheel(e), { passive: true });
    this.target.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('blur', () => this._onBlur());
    window.addEventListener('focus', () => this._onFocus());
  }

  _onMove(e) {
    this.pos.x = e.clientX;
    this.pos.y = e.clientY;
    this.shiftKey = e.shiftKey;
    this.ctrlKey = e.ctrlKey;
    this.altKey = e.altKey;
    this.lastMoveAt = performance.now();
    this.idle = false;
  }

  _onDown(e) {
    this.isDown = true;
    this.button = e.button;
  }

  _onUp(e) {
    this.isDown = false;
    const now = performance.now();
    const clickData = {
      x: e.clientX,
      y: e.clientY,
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
    };
    if (now - this.lastClickAt < 300) {
      this.doubleClick = clickData;
    } else {
      this.click = clickData;
    }
    this.lastClickAt = now;
  }

  _onWheel(e) {
    this.wheel = e.deltaY;
  }

  _onBlur() {
    this.focused = false;
    this.isDown = false;
  }

  _onFocus() {
    this.focused = true;
  }

  update(dt) {
    const dx = this.pos.x - this.prev.x;
    const dy = this.pos.y - this.prev.y;
    this.delta.x = dx;
    this.delta.y = dy;
    const vx = dt > 0 ? dx / dt : 0;
    const vy = dt > 0 ? dy / dt : 0;
    this.accel.x = vx - this.velocity.x;
    this.accel.y = vy - this.velocity.y;
    this.velocity.x = vx;
    this.velocity.y = vy;
    this.prev.x = this.pos.x;
    this.prev.y = this.pos.y;

    const idleLimit = this.options.idleTimeoutSec * 1000;
    if (performance.now() - this.lastMoveAt > idleLimit) {
      this.idle = true;
    }
  }

  consumeClick() {
    const click = this.click;
    this.click = null;
    return click;
  }

  consumeDoubleClick() {
    const dbl = this.doubleClick;
    this.doubleClick = null;
    return dbl;
  }

  consumeWheel() {
    const delta = this.wheel;
    this.wheel = 0;
    return delta;
  }

  getState() {
    return {
      pos: { ...this.pos },
      delta: { ...this.delta },
      velocity: { ...this.velocity },
      accel: { ...this.accel },
      isDown: this.isDown,
      button: this.button,
      click: this.click,
      doubleClick: this.doubleClick,
      wheel: this.wheel,
      idle: this.idle,
      focused: this.focused,
      shiftKey: this.shiftKey,
      ctrlKey: this.ctrlKey,
      altKey: this.altKey,
    };
  }
}
