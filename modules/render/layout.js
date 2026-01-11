import { clamp } from '../utils.js';

/**
 * @param {HTMLElement} el
 * @returns {{x:number,y:number,w:number,h:number}|null}
 */
export function getElementRect(el) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (!rect || !isFinite(rect.width) || rect.width === 0) return null;
  return {
    x: rect.left,
    y: rect.top,
    w: rect.width,
    h: rect.height,
  };
}

/**
 * @param {{width:number,height:number}} dimensions
 * @param {number} gridDensity
 */
export function computeHudLayout(dimensions, gridDensity) {
  if (!dimensions) return null;
  const { width, height } = dimensions;
  const rawSpacing = Math.min(width, height) / gridDensity;
  const grid = Math.max(16, Math.min(28, Math.round(rawSpacing)));
  const pad = grid;
  const gap = grid;
  const safeTop = Math.round(grid * 0.9);
  const safeBottom = Math.round(grid * 2.8);
  const safeLeft = Math.round(grid * 0.9);
  const safeRight = Math.round(grid * 0.9);
  const availableWidth = Math.max(0, width - safeLeft - safeRight);
  const availableHeight = Math.max(0, height - safeTop - safeBottom);
  const usableWidth = availableWidth - pad * 2;
  const usableHeight = availableHeight - pad * 2;

  let col = Math.floor((usableWidth - gap * 2) / 3 / grid) * grid;
  if (!isFinite(col) || col <= 0) {
    const base = Math.floor(Math.max(0, usableWidth - gap * 2) / 3 / grid) * grid;
    col = Math.max(grid * 3, base || grid * 3);
  }
  let hudWidth = col * 3 + gap * 2 + pad * 2;
  if (hudWidth > availableWidth) {
    const maxCol = Math.floor((availableWidth - pad * 2 - gap * 2) / 3 / grid) * grid;
    col = Math.max(grid * 3, maxCol);
    hudWidth = col * 3 + gap * 2 + pad * 2;
  }

  const ratios = [0.9, 1, 0.7];
  const sum = ratios[0] + ratios[1] + ratios[2];
  const heightForRows = Math.max(0, usableHeight - gap * 2);
  let rowTop = Math.floor((heightForRows * ratios[0]) / sum / grid) * grid;
  let rowMid = Math.floor((heightForRows * ratios[1]) / sum / grid) * grid;
  let rowBottom = heightForRows - rowTop - rowMid;
  rowBottom = Math.max(grid * 3, Math.floor(rowBottom / grid) * grid);
  let hudHeight = rowTop + rowMid + rowBottom + gap * 2 + pad * 2;
  if (hudHeight > availableHeight) {
    const maxRow = Math.floor((availableHeight - pad * 2 - gap * 2) / grid) * grid;
    rowBottom = Math.max(grid * 3, maxRow - rowTop - rowMid);
    hudHeight = rowTop + rowMid + rowBottom + gap * 2 + pad * 2;
  }

  const rawOffsetX = safeLeft + Math.round((availableWidth - hudWidth) / 2 / grid) * grid;
  const rawOffsetY = safeTop + Math.round((availableHeight - hudHeight) / 2 / grid) * grid;
  const maxOffsetX = Math.max(0, width - hudWidth);
  const maxOffsetY = Math.max(0, height - hudHeight);
  const offsetX = clamp(rawOffsetX, 0, maxOffsetX);
  const offsetY = clamp(rawOffsetY, 0, maxOffsetY);

  return {
    x: offsetX,
    y: offsetY,
    pad,
    gap,
    col,
    rowTop,
    rowMid,
    rowBottom,
    width: hudWidth,
    height: hudHeight,
  };
}

/**
 * @param {Object} layout
 * @param {HTMLElement} root
 */
export function applyHudCssVars(layout, root = document.documentElement) {
  if (!layout || !root) return;
  root.style.setProperty('--hud-pad', `${layout.pad}px`);
  root.style.setProperty('--hud-gap', `${layout.gap}px`);
  root.style.setProperty('--hud-col', `${layout.col}px`);
  root.style.setProperty('--hud-row-top', `${layout.rowTop}px`);
  root.style.setProperty('--hud-row-mid', `${layout.rowMid}px`);
  root.style.setProperty('--hud-row-bottom', `${layout.rowBottom}px`);
  root.style.setProperty('--hud-width', `${layout.width}px`);
  root.style.setProperty('--hud-height', `${layout.height}px`);
  root.style.setProperty('--hud-x', `${layout.x}px`);
  root.style.setProperty('--hud-y', `${layout.y}px`);
}

/**
 * @param {Object} layout
 * @param {Object} rects
 * @param {Object} strings
 */
export function computeBlockRegistry(layout, rects = {}, strings = {}) {
  if (!layout) return { blocks: {}, blockLabels: {}, textTargets: [] };
  const x1 = layout.x + layout.pad;
  const y1 = layout.y + layout.pad;
  const x2 = x1 + layout.col + layout.gap;
  const x3 = x2 + layout.col + layout.gap;
  const y2 = y1 + layout.rowTop + layout.gap;
  const y3 = y2 + layout.rowMid + layout.gap;
  const leftHeight = layout.rowTop + layout.rowMid + layout.rowBottom + layout.gap * 2;

  const timeRect = { x: x3, y: y1, w: layout.col, h: layout.rowTop };
  const calendarRect =
    rects.calendar || {
      x: x3 + 12,
      y: y1 + layout.rowTop * 0.35,
      w: layout.col - 24,
      h: layout.rowTop * 0.6,
    };
  const waveformRect = {
    x: layout.x,
    y: layout.y + layout.height * 0.32,
    w: layout.width,
    h: layout.rowMid * 0.5,
  };
  const systemTextRect =
    rects.systemText || {
      x: x1 + layout.col * 0.06,
      y: y1 + leftHeight * 0.44,
      w: layout.col * 0.88,
      h: leftHeight * 0.48,
    };

  const blocks = {
    nowPlaying: { rect: { x: x1, y: y1, w: layout.col, h: leftHeight }, importance: 3, priority: 4 },
    systemText: { rect: systemTextRect, importance: 2.2, priority: 6 },
    weather: { rect: { x: x2, y: y1, w: layout.col, h: layout.rowTop }, importance: 2, priority: 3 },
    time: { rect: timeRect, importance: 2, priority: 3 },
    calendar: { rect: calendarRect, importance: 1, priority: 2 },
    system: { rect: { x: x2, y: y2, w: layout.col * 2 + layout.gap, h: layout.rowMid }, importance: 3, priority: 5 },
    network: { rect: { x: x2, y: y3, w: layout.col, h: layout.rowBottom }, importance: 2, priority: 2 },
    disks: { rect: { x: x3, y: y3, w: layout.col, h: layout.rowBottom }, importance: 2, priority: 2 },
    waveform: { rect: waveformRect, importance: 1, priority: 1 },
  };

  const blockLabels = {
    nowPlaying: strings.titles?.nowPlaying || 'NOW PLAYING',
    systemText: strings.titles?.systemText || 'SYSTEM TEXT',
    weather: strings.titles?.weather || 'WEATHER',
    time: strings.titles?.clock || 'TIME',
    calendar: strings.titles?.calendar || 'CALENDAR',
    system: strings.titles?.metrics || 'SYSTEM',
    network: strings.titles?.network || 'NETWORK',
    disks: strings.titles?.disks || 'DISKS',
    waveform: strings.titles?.waveform || 'WAVEFORM',
  };

  const textTargets = Array.from(document.querySelectorAll('[data-glitch="1"]'));

  return { blocks, blockLabels, textTargets };
}
