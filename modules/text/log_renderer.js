import { clamp } from '../utils.js';

export class LogRenderer {
  constructor(options = {}) {
    this.config = {
      fontScale: 1.2,
      textScale: 1,
      showTimestamp: true,
      locale: 'en-US',
      fontFamily: 'Orbitron, Oxanium, sans-serif',
      color: 'rgba(245, 255, 252, 0.98)',
      secondary: 'rgba(125, 255, 214, 0.7)',
      shadowColor: 'rgba(0, 0, 0, 0.6)',
      shadowBlur: 6,
      shadowOffsetX: 0,
      shadowOffsetY: 1,
      strokeColor: 'rgba(0, 0, 0, 0.5)',
      strokeWidth: 1,
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

    const lines = this._buildLines(ctx, entries, cfg, width, maxLines);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const y = bottomY - i * lineHeight;
      const fade = 1 - i / Math.max(1, maxLines - 1);
      const alpha = clamp(0.45 + 0.55 * fade, 0.35, 1) * (0.92 + (1 - level) * 0.08);
      const jitterX = jitter > 0 ? (Math.random() - 0.5) * jitter : 0;
      const jitterY = jitter > 0 ? (Math.random() - 0.5) * jitter * 0.35 : 0;
      const flickerAlpha = flicker > 0 ? clamp(0.8 + (Math.random() - 0.5) * flicker * 0.4, 0.6, 1) : 1;
      ctx.globalAlpha = alpha * flickerAlpha;
      ctx.fillStyle = cfg.color;
      ctx.shadowColor = cfg.shadowColor || 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = cfg.shadowBlur ?? 6;
      ctx.shadowOffsetX = cfg.shadowOffsetX ?? 0;
      ctx.shadowOffsetY = cfg.shadowOffsetY ?? 1;
      if (cfg.strokeWidth && cfg.strokeWidth > 0) {
        ctx.lineWidth = cfg.strokeWidth;
        ctx.strokeStyle = cfg.strokeColor || 'rgba(0, 0, 0, 0.5)';
        ctx.strokeText(line, baseX + jitterX, y + jitterY);
      }
      ctx.fillText(line, baseX + jitterX, y + jitterY);
    }

    ctx.restore();
  }

  _buildLines(ctx, entries, cfg, width, maxLines) {
    if (!entries || !entries.length) return [];
    const lines = [];
    for (let idx = entries.length - 1; idx >= 0; idx--) {
      const entry = entries[idx];
      const text = this._formatLine(entry, cfg);
      const wrapped = this._wrapLine(ctx, text, width);
      for (let i = wrapped.length - 1; i >= 0; i--) {
        lines.push(wrapped[i]);
        if (lines.length >= maxLines) return lines;
      }
    }
    return lines;
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

  _wrapLine(ctx, text, maxWidth) {
    if (!text) return [];
    if (ctx.measureText(text).width <= maxWidth) return [text];
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    words.forEach(word => {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        return;
      }
      if (current) lines.push(current);
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
        return;
      }
      const split = this._breakWord(ctx, word, maxWidth);
      split.forEach(part => {
        if (current) lines.push(current);
        current = part;
      });
    });
    if (current) lines.push(current);
    return lines;
  }

  _breakWord(ctx, word, maxWidth) {
    const parts = [];
    let chunk = '';
    for (let i = 0; i < word.length; i++) {
      const next = chunk + word[i];
      if (ctx.measureText(next).width <= maxWidth || !chunk) {
        chunk = next;
      } else {
        parts.push(chunk);
        chunk = word[i];
      }
    }
    if (chunk) parts.push(chunk);
    return parts;
  }
}
