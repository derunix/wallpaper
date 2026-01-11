const _tempPool = [];
const _noisePatternCache = new WeakMap();

const NOISE_SIZE = 64;
const _noiseCanvas = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = NOISE_SIZE;
  canvas.height = NOISE_SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(NOISE_SIZE, NOISE_SIZE);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
})();

function getTempCanvas(w, h) {
  const existing = _tempPool.find(c => c.width === w && c.height === h);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  _tempPool.push(canvas);
  return canvas;
}

function getNoisePattern(ctx) {
  let pattern = _noisePatternCache.get(ctx);
  if (!pattern) {
    pattern = ctx.createPattern(_noiseCanvas, 'repeat');
    _noisePatternCache.set(ctx, pattern);
  }
  return pattern;
}

export function getTempCanvasRect(w, h) {
  return getTempCanvas(w, h);
}

export function copyRectToCanvas(ctx, x, y, w, h) {
  if (w <= 0 || h <= 0) return null;
  const temp = getTempCanvas(w, h);
  const tctx = temp.getContext('2d');
  tctx.clearRect(0, 0, w, h);
  tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
  return temp;
}

export function invertRect(ctx, x, y, w, h) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
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
  const pattern = getNoisePattern(ctx);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
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

export function outlineFlashRect(
  ctx,
  x,
  y,
  w,
  h,
  color = 'rgba(141,252,79,0.8)',
  thickness = 3,
  composite = 'lighter'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.globalCompositeOperation = composite;
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

export function buildLightningPath(p0, p1, opts = {}) {
  if (!p0 || !p1) return [];
  const targetSegments = clamp(Math.round(opts.segments ?? 24), 12, 48);
  const baseJitter = clamp(opts.jitter ?? 12, 2, 48);
  const forkChance = clamp(opts.forkChance ?? 0.12, 0, 0.35);
  const forkLength = clamp(opts.forkLength ?? 0.3, 0.15, 0.6);
  const maxForks = clamp(opts.maxForks ?? 3, 0, 3);
  const rand = typeof opts.rand === 'function' ? opts.rand : createSeededRandom(opts.seed ?? (Math.random() * 1e9));

  const points = opts.out || [];
  const forksOut = opts.forksOut === null ? null : opts.forksOut || [];
  const scratchA = opts.scratchA || [];
  const scratchB = opts.scratchB || [];
  scratchA.length = 0;
  scratchB.length = 0;

  setPoint(scratchA, 0, p0.x, p0.y);
  setPoint(scratchA, 1, p1.x, p1.y);

  let current = scratchA;
  let next = scratchB;
  let jitter = baseJitter;
  const iterations = Math.max(1, Math.ceil(Math.log2(targetSegments)));
  for (let i = 0; i < iterations; i++) {
    next.length = 0;
    for (let j = 0; j < current.length - 1; j++) {
      const a = current[j];
      const b = current[j + 1];
      setPoint(next, next.length, a.x, a.y);
      const mid = midpointOffset(a, b, jitter, rand);
      setPoint(next, next.length, mid.x, mid.y);
    }
    const last = current[current.length - 1];
    setPoint(next, next.length, last.x, last.y);
    jitter *= 0.62;
    const swap = current;
    current = next;
    next = swap;
  }

  resamplePoints(current, targetSegments + 1, points);

  if (forksOut && maxForks > 0 && !opts.noForks) {
    let forkCount = 0;
    const length = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    for (let i = 2; i < points.length - 2; i++) {
      if (forkCount >= maxForks) break;
      if (rand() > forkChance) continue;
      const origin = points[i];
      const dir = points[i + 1];
      const dx = dir.x - origin.x;
      const dy = dir.y - origin.y;
      const inv = 1 / Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy * inv;
      const ny = dx * inv;
      const sign = rand() < 0.5 ? -1 : 1;
      const len = length * forkLength * (0.6 + rand() * 0.6);
      const fx = origin.x + nx * len * sign + (rand() - 0.5) * len * 0.25;
      const fy = origin.y + ny * len * sign + (rand() - 0.5) * len * 0.25;
      const forkPoints = forksOut[forkCount] || [];
      forkPoints.length = 0;
      buildLightningPath(
        origin,
        { x: fx, y: fy },
        {
          segments: Math.max(8, Math.round(targetSegments * 0.6)),
          jitter: baseJitter * 0.75,
          rand,
          out: forkPoints,
          forksOut: null,
          noForks: true,
          scratchA: opts.scratchA,
          scratchB: opts.scratchB,
        }
      );
      forksOut[forkCount] = forkPoints;
      forkCount += 1;
    }
    forksOut.length = forkCount;
  }
  points.forks = forksOut || null;
  return points;
}

export function drawLightning(ctx, points, style = {}) {
  if (!points || points.length < 2) return;
  const intensity = clamp(style.intensity ?? 1, 0.4, 2.5);
  const baseWidth = clamp(style.width ?? 3, 1.5, 8) * intensity;
  const flicker = clamp(style.flicker ?? 0, 0, 1);
  const time = style.time ?? 0;
  const pulse = clamp(0.82 + Math.sin(time * (12 + intensity * 7)) * 0.12 + flicker * 0.35, 0.45, 1.35);
  const alpha = clamp((style.alpha ?? 0.9) * pulse, 0.1, 1);
  const whiteBoost = clamp(style.white ?? 0, 0, 1);
  const primary = style.primary || '#8dfc4f';
  const secondary = style.secondary || '#3fe7ff';

  const core = mixColors(primary, secondary, 0.6, alpha);
  const glow = mixColors(secondary, '#ffffff', 0.35 + whiteBoost * 0.4, alpha * 0.65);
  const hot = mixColors(primary, '#ffffff', 0.2 + whiteBoost * 0.6, alpha);

  ctx.save();
  ctx.globalCompositeOperation = style.composite || 'screen';

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = glow;
  ctx.lineWidth = baseWidth * 2.4;
  strokePath(ctx, points);
  drawForks(ctx, points, baseWidth * 1.6, glow);

  ctx.strokeStyle = core;
  ctx.lineWidth = baseWidth * 1.35;
  strokePath(ctx, points);
  drawForks(ctx, points, baseWidth * 1.1, core);

  ctx.strokeStyle = hot;
  ctx.lineWidth = baseWidth * 0.7;
  strokePath(ctx, points);
  drawForks(ctx, points, baseWidth * 0.65, hot);

  ctx.restore();
}

export function drawElectricSparks(ctx, rect, count = 8, options = {}) {
  if (!rect || count <= 0) return;
  const rand = typeof options.rand === 'function' ? options.rand : Math.random;
  const alpha = clamp(options.alpha ?? 0.8, 0.2, 1);
  const color = options.color || `rgba(214,255,97,${alpha})`;
  const lineWidth = clamp(options.lineWidth ?? 1.5, 1, 3);

  ctx.save();
  ctx.globalCompositeOperation = options.composite || 'screen';
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'square';

  for (let i = 0; i < count; i++) {
    const x = rect.x + rand() * rect.w;
    const y = rect.y + rand() * rect.h;
    const len = 2 + rand() * 5;
    if (rand() < 0.5) {
      ctx.beginPath();
      ctx.moveTo(x - len, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - len);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    } else {
      const ang = rand() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  }
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

function midpointOffset(a, b, jitter, rand) {
  const midX = (a.x + b.x) * 0.5;
  const midY = (a.y + b.y) * 0.5;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const inv = 1 / Math.max(0.001, Math.hypot(dx, dy));
  const nx = -dy * inv;
  const ny = dx * inv;
  const offset = (rand() - 0.5) * 2 * jitter;
  return { x: midX + nx * offset, y: midY + ny * offset };
}

function resamplePoints(points, targetCount, out) {
  if (!points.length) return out;
  const lastIndex = points.length - 1;
  const step = lastIndex / Math.max(1, targetCount - 1);
  for (let i = 0; i < targetCount; i++) {
    const idx = i * step;
    const low = Math.floor(idx);
    const high = Math.min(lastIndex, low + 1);
    const t = idx - low;
    const a = points[low];
    const b = points[high];
    const x = lerp(a.x, b.x, t);
    const y = lerp(a.y, b.y, t);
    setPoint(out, i, x, y);
  }
  out.length = targetCount;
  return out;
}

function strokePath(ctx, points) {
  if (!points || points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function drawForks(ctx, points, width, color) {
  const forks = points.forks;
  if (!forks || !forks.length) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  forks.forEach(path => {
    strokePath(ctx, path);
  });
}

function mixColors(a, b, t, alpha) {
  const ca = parseColor(a);
  const cb = parseColor(b);
  const r = Math.round(lerp(ca.r, cb.r, t));
  const g = Math.round(lerp(ca.g, cb.g, t));
  const bch = Math.round(lerp(ca.b, cb.b, t));
  const aOut = clamp(alpha ?? 1, 0, 1);
  return `rgba(${r},${g},${bch},${aOut})`;
}

function parseColor(value) {
  if (!value || typeof value !== 'string') return { r: 255, g: 255, b: 255 };
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b };
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b };
    }
  }
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(',').map(v => parseFloat(v.trim()));
    if (parts.length >= 3) return { r: parts[0], g: parts[1], b: parts[2] };
  }
  return { r: 255, g: 255, b: 255 };
}

function setPoint(list, idx, x, y) {
  const existing = list[idx];
  if (existing) {
    existing.x = x;
    existing.y = y;
    return existing;
  }
  const point = { x, y };
  list[idx] = point;
  return point;
}

function createSeededRandom(seed) {
  let x = (seed >>> 0) || 0x2f6e2b1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
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
