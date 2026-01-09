import { paintContactPads, clamp } from './utils.js';

const GRID_PADDING = 24;

export function drawBackground(ctx, state) {
  const { width, height } = state.dimensions;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = state.colors.background;
  ctx.fillRect(0, 0, width, height);

  if (state.gridEnabled) {
    drawGrid(ctx, width, height, state);
  }
  drawEqualizer(ctx, width, height, state);
}

export function drawForeground(ctx, state) {
  const { width, height } = state.dimensions;
  ctx.clearRect(0, 0, width, height);

  if (state.audio.waveformEnabled) {
    drawWaveform(ctx, width, height, state);
  }

  drawHudFrames(ctx, width, height, state);
}

function drawGrid(ctx, width, height, state) {
  const density = clamp(state.gridDensity, 8, 64);
  const spacing = Math.max(16, Math.min(width, height) / density);
  const layout = state.hudLayout;
  const pad = layout ? layout.pad + layout.x : GRID_PADDING;
  const padY = layout ? layout.pad + layout.y : GRID_PADDING;
  const gridOffset = state.layerOffsets?.grid || state.parallax || { x: 0, y: 0 };
  const offsetX = gridOffset.x || 0;
  const offsetY = gridOffset.y || 0;
  ctx.save();
  ctx.strokeStyle = withAlpha(state.colors.secondary, clamp(state.gridAlpha ?? 0.18, 0.05, 0.4));
  ctx.lineWidth = Math.max(1, state.lineThickness * 0.35);

  for (let x = pad + offsetX; x < width - pad; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, padY + offsetY);
    ctx.lineTo(x, height - padY + offsetY);
    ctx.stroke();
  }
  for (let y = padY + offsetY; y < height - padY; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(pad + offsetX, y);
    ctx.lineTo(width - pad + offsetX, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEqualizer(ctx, width, height, state) {
  const bars = state.audio.bars;
  if (!bars || bars.length === 0) return;
  const barWidth = width / bars.length;
  const baseY = height * 0.85;
  const maxHeight = height * 0.5;
  const offset = state.layerOffsets?.grid || { x: 0, y: 0 };
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.lineWidth = Math.max(2, state.lineThickness * 0.8);
  ctx.strokeStyle = withAlpha(state.colors.primary, state.bgEQAlpha);
  ctx.lineCap = 'butt';

  bars.forEach((v, i) => {
    const barHeight = Math.max(2, v * maxHeight);
    const x = i * barWidth + barWidth / 2;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, baseY - barHeight);
    ctx.stroke();
  });
  ctx.restore();
}

function drawWaveform(ctx, width, height, state) {
  const waveform = state.audio.waveform;
  const midY = height * 0.35;
  const amp = height * clamp(state.audio.waveformHeight, 0.05, 0.5);
  const offset = state.layerOffsets?.panels || { x: 0, y: 0 };
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.lineWidth = Math.max(2, state.lineThickness * 1.2);
  ctx.strokeStyle = withAlpha(state.colors.primary, 0.75);
  ctx.shadowColor = withAlpha(state.colors.secondary, 0.2);
  ctx.shadowBlur = 8;

  ctx.beginPath();
  waveform.forEach((v, i) => {
    const x = (i / (waveform.length - 1)) * width;
    const y = midY - (v - 0.5) * 2 * amp;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.restore();
}

function drawHudFrames(ctx, width, height, state) {
  const layout = state.hudLayout;
  const thickness = Math.max(2, state.lineThickness);
  const colorA = state.colors.primary;
  const colorB = state.colors.secondary;
  const offset = state.layerOffsets?.panels || { x: 0, y: 0 };

  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.lineWidth = thickness;
  ctx.strokeStyle = colorA;
  ctx.fillStyle = withAlpha(colorA, 0.08);

  if (layout) {
    const x1 = layout.x + layout.pad;
    const y1 = layout.y + layout.pad;
    const x2 = x1 + layout.col + layout.gap;
    const x3 = x2 + layout.col + layout.gap;
    const y2 = y1 + layout.rowTop + layout.gap;
    const y3 = y2 + layout.rowMid + layout.gap;
    const leftHeight = layout.rowTop + layout.rowMid + layout.rowBottom + layout.gap * 2;

    drawSegmentedRect(ctx, x1, y1, layout.col, leftHeight, thickness, colorA, colorB);
    drawSegmentedRect(ctx, x2, y1, layout.col, layout.rowTop, thickness, colorA, colorB);
    drawSegmentedRect(ctx, x3, y1, layout.col, layout.rowTop, thickness, colorA, colorB);
    drawSegmentedRect(ctx, x2, y2, layout.col * 2 + layout.gap, layout.rowMid, thickness, colorA, colorB);
    drawSegmentedRect(ctx, x2, y3, layout.col, layout.rowBottom, thickness, colorA, colorB);
    drawSegmentedRect(ctx, x3, y3, layout.col, layout.rowBottom, thickness, colorA, colorB);

    paintContactPads(
      ctx,
      [
        [x1 + thickness * 2, y1 + thickness * 2],
        [x1 + layout.col - thickness * 2, y1 + thickness * 2],
        [x3 + thickness * 2, y1 + thickness * 2],
        [x3 + layout.col - thickness * 2, y1 + thickness * 2],
        [x2 + thickness * 2, y3 + layout.rowBottom - thickness * 2],
        [x3 + layout.col - thickness * 2, y3 + layout.rowBottom - thickness * 2],
      ],
      12,
      colorB,
      thickness
    );
  }

  ctx.restore();
}

function drawSegmentedRect(ctx, x, y, w, h, thickness, colorA, colorB) {
  const cut = Math.max(20, thickness * 4);
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
  ctx.stroke();

  // Secondary inner stroke
  ctx.save();
  ctx.strokeStyle = withAlpha(colorB, 0.5);
  ctx.lineWidth = Math.max(1.5, thickness * 0.55);
  ctx.stroke();
  ctx.restore();
}

function withAlpha(hex, alpha) {
  if (hex.startsWith('rgb')) {
    const nums = hex
      .replace(/[^\d,]/g, '')
      .split(',')
      .map(n => parseInt(n.trim(), 10));
    const [r, g, b] = nums;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const c = hex.replace('#', '');
  const bigint = parseInt(c, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
