import { renderCalendar } from '../ui/render_calendar.js';
import { setupHiDPICanvas } from '../utils.js';

/**
 * Renders calendar and log to an offscreen canvas.
 */
export class TextRenderer {
  constructor(logRenderer) {
    this.logRenderer = logRenderer;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.lastLogCount = 0;
    this.lastDisplaySig = 0;
    this.lastDrawAt = 0;
    this.lastHoverKey = -1;
    this.dirty = true;
  }

  resize(width, height) {
    if (!width || !height) return;
    setupHiDPICanvas(this.canvas);
    this.dirty = true;
  }

  markDirty() {
    this.dirty = true;
  }

  render(now, options = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const logEntries = options.logEntries || [];
    const logRect = options.logRect;
    const logEnabled = !!options.logEnabled;
    const displayState = options.logDisplayState || {};

    const level = displayState.level ?? 0;
    const jitter = displayState.jitter ?? 0;
    const flicker = displayState.flicker ?? 0;
    const displaySig =
      (Math.round(level * 100) << 16) |
      (Math.round(jitter * 100) << 8) |
      Math.round(flicker * 100);

    const logCount = logEntries.length;
    const hover = options.calendarHover || null;
    const hoverKey = hover ? (hover.row << 4) | hover.col : -1;
    const needsAnimation = jitter > 0 || flicker > 0;
    const animationTick = needsAnimation && now - this.lastDrawAt > 80;
    if (
      !this.dirty &&
      logCount === this.lastLogCount &&
      displaySig === this.lastDisplaySig &&
      hoverKey === this.lastHoverKey &&
      !animationTick
    ) {
      return;
    }

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (options.calendarData && options.calendarRect) {
      renderCalendar(ctx, options.calendarRect, options.calendarData, {
        colors: options.colors,
        lineWidth: options.lineWidth,
        textScale: options.textScale,
        hover,
      });
    }

    if (logEnabled && logRect && logEntries.length) {
      this.logRenderer.render(ctx, logRect, logEntries, {
        textScale: options.textScale,
        fontScale: options.fontScale,
        showTimestamp: options.showTimestamp,
        locale: options.locale,
        displayState,
        color: options.logColor,
        secondary: options.logSecondary,
      });
    }

    this.lastLogCount = logCount;
    this.lastDisplaySig = displaySig;
    this.lastHoverKey = hoverKey;
    this.lastDrawAt = now;
    this.dirty = false;
  }
}
