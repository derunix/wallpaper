export class DiagnosticsMode {
  constructor(bus, overlayEl) {
    this.bus = bus;
    this.overlayEl = overlayEl;
    this.enabled = false;
    this.lastToggleAt = 0;
    this.mode = { showInput: false, showGlitch: false };
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled && this.overlayEl) this.overlayEl.hidden = true;
  }

  setMode(mode = {}) {
    Object.assign(this.mode, mode);
  }

  toggle() {
    this.setEnabled(!this.enabled);
  }

  update(info = {}) {
    if (!this.enabled || !this.overlayEl) return;
    const lines = [];
    if (this.mode.showInput) {
      lines.push(`HOVER: ${info.hoveredBlock || '--'}`);
      lines.push(`MOUSE SPD: ${info.mouseSpeed?.toFixed(1) || 0}`);
    }
    if (this.mode.showGlitch) {
      lines.push(`GLITCH: ${info.activeGlitches?.join(',') || '--'}`);
      lines.push(`NEXT: ${info.nextGlitch?.toFixed(1) || '--'}s`);
      lines.push(`AUDIO: ${info.audio?.energy?.toFixed(2) || 0} PEAK:${info.audio?.peak ? '1' : '0'}`);
    }
    if (this.mode.showInput || this.mode.showGlitch) {
      lines.push(`FPS: ${info.fps || 0}`);
    }
    if (!lines.length) {
      this.overlayEl.hidden = true;
      return;
    }
    this.overlayEl.textContent = lines.join('\n');
    this.overlayEl.hidden = false;
  }

  render(ctx, blocks, hoveredBlock) {
    if (!this.enabled || !hoveredBlock || !blocks[hoveredBlock]) return;
    const rect = blocks[hoveredBlock].rect;
    if (!rect) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(63,231,255,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}
