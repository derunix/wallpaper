const _tempPool = [];

function getTempCanvas(w, h) {
  const existing = _tempPool.find(c => c.width === w && c.height === h);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  _tempPool.push(canvas);
  return canvas;
}

export function invertRect(ctx, x, y, w, h) {
  if (w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x, y, w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(img, x, y);
}

export function invertScreen(ctx) {
  invertRect(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function posterizeRect(ctx, x, y, w, h, levels = 6) {
  if (w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x, y, w, h);
  const data = img.data;
  const step = 255 / Math.max(1, levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / step) * step;
    data[i + 1] = Math.round(data[i + 1] / step) * step;
    data[i + 2] = Math.round(data[i + 2] / step) * step;
  }
  ctx.putImageData(img, x, y);
}

export function rgbSplitRect(ctx, x, y, w, h, offset = 4) {
  if (w <= 0 || h <= 0) return;
  const temp = getTempCanvas(w, h);
  const tctx = temp.getContext('2d');
  tctx.clearRect(0, 0, w, h);
  tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.6;
  ctx.drawImage(temp, x - offset, y, w, h);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(temp, x + offset, y, w, h);
  ctx.globalAlpha = 0.4;
  ctx.drawImage(temp, x, y - offset, w, h);
  ctx.restore();
}

export function rgbSplitScreen(ctx, offset = 6) {
  rgbSplitRect(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, offset);
}

export function horizontalTearRect(ctx, x, y, w, h, strength = 10) {
  if (w <= 0 || h <= 0) return;
  const temp = getTempCanvas(w, h);
  const tctx = temp.getContext('2d');
  tctx.clearRect(0, 0, w, h);
  tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);

  const slices = 6;
  for (let i = 0; i < slices; i++) {
    const sy = Math.floor((h / slices) * i);
    const sh = Math.floor(h / slices);
    const dx = Math.floor((Math.random() - 0.5) * strength);
    ctx.drawImage(temp, 0, sy, w, sh, x + dx, y + sy, w, sh);
  }
}

export function horizontalTearScreen(ctx, strength = 12) {
  horizontalTearRect(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, strength);
}

export function scanlinesRect(ctx, x, y, w, h, spacing = 4, alpha = 0.25) {
  ctx.save();
  ctx.strokeStyle = `rgba(63, 231, 255, ${alpha})`;
  ctx.lineWidth = 1;
  for (let yy = y; yy < y + h; yy += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
  }
  ctx.restore();
}

export function noiseRect(ctx, x, y, w, h, alpha = 0.2) {
  if (w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x, y, w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = Math.floor(alpha * 255);
  }
  ctx.putImageData(img, x, y);
}

export function displacementWaveRect(ctx, x, y, w, h, amplitude = 6, frequency = 16) {
  if (w <= 0 || h <= 0) return;
  const temp = getTempCanvas(w, h);
  const tctx = temp.getContext('2d');
  tctx.clearRect(0, 0, w, h);
  tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);

  ctx.save();
  for (let yy = 0; yy < h; yy++) {
    const shift = Math.sin((yy / h) * Math.PI * frequency) * amplitude;
    ctx.drawImage(temp, 0, yy, w, 1, x + shift, y + yy, w, 1);
  }
  ctx.restore();
}

export function jitterTransformRect(ctx, x, y, w, h, jitter = 4) {
  if (w <= 0 || h <= 0) return;
  const temp = getTempCanvas(w, h);
  const tctx = temp.getContext('2d');
  tctx.clearRect(0, 0, w, h);
  tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
  const dx = Math.floor((Math.random() - 0.5) * jitter);
  const dy = Math.floor((Math.random() - 0.5) * jitter);
  ctx.drawImage(temp, x + dx, y + dy);
}

export function clipAndShiftRect(ctx, x, y, w, h, dx = 8, dy = 0) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(ctx.canvas, x, y, w, h, x + dx, y + dy, w, h);
  ctx.restore();
}

export function outlineFlashRect(ctx, x, y, w, h, color = 'rgba(141,252,79,0.8)', thickness = 3) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

export function arcBetweenPoints(ctx, x1, y1, x2, y2, segments = 8, jitter = 6, color = 'rgba(63,231,255,0.8)') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter;
    const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function diagonalFractureSplit(ctx, x, y, w, h, offset = 10) {
  if (w <= 0 || h <= 0) return;
  const temp = getTempCanvas(w, h);
  const tctx = temp.getContext('2d');
  tctx.clearRect(0, 0, w, h);
  tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(temp, x + offset, y - offset);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(temp, x - offset, y + offset);
  ctx.restore();
}

export class AfterimageBuffer {
  constructor(size = 4) {
    this.size = size;
    this.frames = [];
  }

  push(canvas, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    const temp = getTempCanvas(w, h);
    const tctx = temp.getContext('2d');
    tctx.clearRect(0, 0, w, h);
    tctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    this.frames.unshift({ canvas: temp, w, h, x, y });
    if (this.frames.length > this.size) this.frames.pop();
  }

  render(ctx, alpha = 0.2) {
    ctx.save();
    this.frames.forEach((frame, idx) => {
      ctx.globalAlpha = alpha * (1 - idx / this.frames.length);
      ctx.drawImage(frame.canvas, frame.x, frame.y);
    });
    ctx.restore();
  }
}

export function noSignalOverlay(ctx, width, height, text = 'NO SIGNAL') {
  ctx.save();
  ctx.fillStyle = 'rgba(4,7,10,0.8)';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(63,231,255,0.5)';
  ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(141,252,79,0.9)';
  ctx.font = '24px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
  ctx.restore();
}
