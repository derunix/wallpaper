import {
  drawBackgroundStatic,
  drawBackgroundDynamic,
  drawForegroundStatic,
  drawForegroundDynamic,
} from '../hud.js';
import { setupHiDPICanvas } from '../utils.js';

/**
 * HUD renderer with static/dynamic offscreen layers.
 */
export class HudRenderer {
  constructor(bgCanvas, hudCanvas) {
    this.bgCanvas = bgCanvas;
    this.hudCanvas = hudCanvas;
    this.bgStaticCanvas = document.createElement('canvas');
    this.bgDynamicCanvas = document.createElement('canvas');
    this.hudStaticCanvas = document.createElement('canvas');
    this.hudDynamicCanvas = document.createElement('canvas');
    this.textCanvas = null;

    this.bgCtx = bgCanvas.getContext('2d');
    this.hudCtx = hudCanvas.getContext('2d');
    this.bgStaticCtx = this.bgStaticCanvas.getContext('2d');
    this.bgDynamicCtx = this.bgDynamicCanvas.getContext('2d');
    this.hudStaticCtx = this.hudStaticCanvas.getContext('2d');
    this.hudDynamicCtx = this.hudDynamicCanvas.getContext('2d');

    this.dimensions = { width: 0, height: 0 };
    this.staticDirty = true;
  }

  setTextCanvas(canvas) {
    this.textCanvas = canvas;
  }

  resize() {
    const bg = setupHiDPICanvas(this.bgCanvas);
    const hud = setupHiDPICanvas(this.hudCanvas);
    setupHiDPICanvas(this.bgStaticCanvas);
    setupHiDPICanvas(this.bgDynamicCanvas);
    setupHiDPICanvas(this.hudStaticCanvas);
    setupHiDPICanvas(this.hudDynamicCanvas);
    if (this.textCanvas) setupHiDPICanvas(this.textCanvas);
    this.bgCtx = bg.ctx;
    this.hudCtx = hud.ctx;
    this.dimensions = { width: bg.width, height: bg.height };
    this.staticDirty = true;
    return this.dimensions;
  }

  markStaticDirty() {
    this.staticDirty = true;
  }

  render(state, options = {}) {
    const dims = this.dimensions;
    if (this.staticDirty || options.forceStatic) {
      drawBackgroundStatic(this.bgStaticCtx, state);
      drawForegroundStatic(this.hudStaticCtx, state);
      this.staticDirty = false;
    }

    this.bgDynamicCtx.clearRect(0, 0, dims.width, dims.height);
    drawBackgroundDynamic(this.bgDynamicCtx, state);

    this.hudDynamicCtx.clearRect(0, 0, dims.width, dims.height);
    drawForegroundDynamic(this.hudDynamicCtx, state);

    this.bgCtx.clearRect(0, 0, dims.width, dims.height);
    this.bgCtx.drawImage(this.bgStaticCanvas, 0, 0);
    this.bgCtx.drawImage(this.bgDynamicCanvas, 0, 0);

    this.hudCtx.clearRect(0, 0, dims.width, dims.height);
    this.hudCtx.drawImage(this.hudStaticCanvas, 0, 0);
    this.hudCtx.drawImage(this.hudDynamicCanvas, 0, 0);
    if (this.textCanvas) {
      this.hudCtx.drawImage(this.textCanvas, 0, 0);
    }
  }
}
