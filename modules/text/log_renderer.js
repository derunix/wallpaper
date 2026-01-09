import { clamp } from '../utils.js';

export class LogRenderer {
  constructor(options = {}) {
    this.config = {
      fontScale: 1.2,
      textScale: 1,
      showTimestamp: true,
      locale: 'en-US',
      fontFamily: 'Orbitron, Oxanium, sans-serif',
      color: 'rgba(232, 255, 247, 0.85)',
      secondary: 'rgba(63, 231, 255, 0.55)',
      headerInset: 0,
      ...options,
    };
  }

  setConfig(options = {}) {
    Object.assign(this.config, options);
  }

  render(ctx, rect, entries = [], options = {}) {
    if (!rect || rect.w <= 0 || rect.h <= 0) return;
    if (!entries || entries.length === 0) return;
    const cfg = { ...this.config, ...options };
    const textScale = clamp(cfg.textScale ?? 1, 0.6, 2);
    const fontScale = clamp(cfg.fontScale ?? 1, 0.6, 2);
    const padding = clamp(rect.h * 0.06, 8, 20);
    const headerInset = cfg.headerInset > 0 ? cfg.headerInset : Math.max(18 * textScale, rect.h * 0.12);
    const usableH = rect.h - padding * 2 - headerInset;
    if (usableH <= 0) return;

    const fontSize = clamp(Math.floor(14 * textScale * fontScale), 12, 28);
    const lineHeight = Math.max(16, Math.floor(fontSize * 1.35));
    const maxLines = Math.max(1, Math.floor(usableH / lineHeight));
    const slice = entries.slice(-maxLines);

    const displayState = cfg.displayState || {};
    const jitter = clamp(displayState.jitter ?? 0, 0, 2.5);
    const flicker = clamp(displayState.flicker ?? 0, 0, 1);
    const level = clamp(displayState.level ?? 0, 0, 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    ctx.font = `600 ${fontSize}px ${cfg.fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    const baseX = rect.x + padding;
    const bottomY = rect.y + rect.h - padding;
    const width = rect.w - padding * 2;

    for (let i = 0; i < slice.length; i++) {
      const entry = slice[slice.length - 1 - i];
      const y = bottomY - i * lineHeight;
      const fade = 1 - i / Math.max(1, maxLines - 1);
      const alpha = clamp(0.35 + 0.65 * fade, 0.2, 1) * (0.85 + (1 - level) * 0.15);
      const jitterX = jitter > 0 ? (Math.random() - 0.5) * jitter : 0;
      const jitterY = jitter > 0 ? (Math.random() - 0.5) * jitter * 0.35 : 0;
      const flickerAlpha = flicker > 0 ? clamp(0.8 + (Math.random() - 0.5) * flicker * 0.4, 0.6, 1) : 1;
      ctx.globalAlpha = alpha * flickerAlpha;
      ctx.fillStyle = cfg.color;
      const text = this._formatLine(entry, cfg);
      const trimmed = this._truncate(ctx, text, width);
      ctx.fillText(trimmed, baseX + jitterX, y + jitterY);
    }

    ctx.restore();
  }

  _formatLine(entry, cfg) {
    const raw = String(entry.text || '').replace(/[\r\n]+/g, ' ');
    if (!cfg.showTimestamp) return raw;
    const ts = entry.ts ? new Date(entry.ts) : new Date();
    const stamp = ts.toLocaleTimeString(cfg.locale || 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `[${stamp}] ${raw}`;
  }

  _truncate(ctx, text, maxWidth) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 4 && ctx.measureText(`${truncated}...`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}...`;
  }
}
