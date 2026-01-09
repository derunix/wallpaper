import { noSignalOverlay, scanlinesRect, noiseRect, outlineFlashRect } from './fx_primitives.js';

let overlayEls = null;

function getOverlayEls() {
  if (overlayEls) return overlayEls;
  const root = document.getElementById('globalOverlay');
  const title = document.getElementById('overlayTitle');
  const subtitle = document.getElementById('overlaySubtitle');
  const bar = document.getElementById('overlayBarFill');
  overlayEls = { root, title, subtitle, bar };
  return overlayEls;
}

function resolveOverlayColor(fallback = 'rgba(141,252,79,0.9)') {
  const css = getComputedStyle(document.documentElement).getPropertyValue('--primary');
  if (css && css.trim()) return css.trim();
  return fallback;
}

export function showOverlay(title, subtitle = '', color) {
  const els = getOverlayEls();
  if (!els.root) return;
  if (els.title) els.title.textContent = title || '';
  if (els.subtitle) els.subtitle.textContent = subtitle || '';
  const chosen = color || resolveOverlayColor();
  els.root.style.color = chosen;
  if (els.bar) els.bar.style.width = '0%';
  els.root.classList.remove('hidden');
}

export function updateOverlay(progress = 0) {
  const els = getOverlayEls();
  if (!els.root || !els.bar) return;
  const clamped = Math.max(0, Math.min(1, progress));
  els.bar.style.width = `${Math.round(clamped * 100)}%`;
}

export function hideOverlay() {
  const els = getOverlayEls();
  if (!els.root) return;
  els.root.classList.add('hidden');
}

export function renderNoSignal(ctx, width, height, progress = 0) {
  noSignalOverlay(ctx, width, height, 'NO SIGNAL');
  scanlinesRect(ctx, 0, 0, width, height, 3, 0.2);
  noiseRect(ctx, 0, 0, width, height, 0.12);
  ctx.save();
  ctx.fillStyle = 'rgba(141,252,79,0.7)';
  ctx.fillRect(width * 0.2, height * 0.7, width * 0.6 * progress, 6);
  ctx.restore();
}

export function renderRebootSequence(ctx, width, height, blocks, progress = 0) {
  ctx.save();
  ctx.fillStyle = `rgba(4,7,10,${0.9 - 0.4 * progress})`;
  ctx.fillRect(0, 0, width, height);
  const blockKeys = Object.keys(blocks);
  const count = Math.min(blockKeys.length, 6);
  const step = 1 / Math.max(1, count);
  for (let i = 0; i < count; i++) {
    const key = blockKeys[i];
    const rect = blocks[key]?.rect;
    if (!rect) continue;
    if (progress > i * step) {
      const alpha = Math.min(1, (progress - i * step) / step);
      outlineFlashRect(ctx, rect.x, rect.y, rect.w, rect.h, `rgba(63,231,255,${alpha})`, 3);
    }
  }
  ctx.restore();
}

export function renderPowerSurge(ctx, width, height, progress = 0) {
  ctx.save();
  const flash = Math.sin(progress * Math.PI);
  ctx.fillStyle = `rgba(63,231,255,${0.12 * flash})`;
  ctx.fillRect(0, 0, width, height);
  outlineFlashRect(ctx, width * 0.05, height * 0.05, width * 0.9, height * 0.9, 'rgba(141,252,79,0.6)', 4);
  ctx.restore();
}
