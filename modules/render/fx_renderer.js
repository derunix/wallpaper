import { setupHiDPICanvas } from '../utils.js';

/**
 * FX renderer for overlay effects.
 */
export class FxRenderer {
  constructor(fxCanvas) {
    this.fxCanvas = fxCanvas;
    this.fxCtx = fxCanvas.getContext('2d');
    this.dimensions = { width: 0, height: 0 };
  }

  resize() {
    const fx = setupHiDPICanvas(this.fxCanvas);
    this.fxCtx = fx.ctx;
    this.dimensions = { width: fx.width, height: fx.height };
  }

  render(targetCtx, options = {}) {
    if (!this.fxCtx || !targetCtx) return;
    const dims = this.dimensions;
    this.fxCtx.clearRect(0, 0, dims.width, dims.height);

    const hudCanvas = options.hudCanvas;
    const mainCanvas = options.mainCanvas || hudCanvas;
    const blocks = options.blocks || {};

    options.interactionFX?.render(this.fxCtx, hudCanvas);
    options.microAnimations?.render(this.fxCtx, blocks);
    options.glitchSystem?.render(this.fxCtx, hudCanvas, mainCanvas);
    options.narrativeEngine?.render(this.fxCtx, dims.width, dims.height);
    options.overlayMessages?.render(this.fxCtx, dims.width, dims.height);

    targetCtx.drawImage(this.fxCanvas, 0, 0);
  }
}
