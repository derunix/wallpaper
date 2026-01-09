// Utility helpers shared across modules.

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class EMA {
  constructor(alpha = 0.5, initial = 0) {
    this.alpha = clamp(alpha, 0, 1);
    this.value = initial;
    this.initialized = false;
  }

  update(sample) {
    if (!this.initialized) {
      this.value = sample;
      this.initialized = true;
    } else {
      this.value = this.alpha * sample + (1 - this.alpha) * this.value;
    }
    return this.value;
  }
}

export function setupHiDPICanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const { innerWidth, innerHeight } = window;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, dpr, width: innerWidth, height: innerHeight };
}

export function formatSpeed(bytesPerSec, locale = 'en-US') {
  if (bytesPerSec === null || bytesPerSec === undefined || !isFinite(bytesPerSec)) return '--';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let idx = 0;
  let value = bytesPerSec;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx++;
  }
  return `${formatNumber(value, locale, value >= 10 ? 0 : 1)} ${units[idx]}`;
}

export function formatTemperature(t, locale = 'en-US', digits = 0) {
  if (t === null || t === undefined || !isFinite(t)) return '--°';
  return `${formatNumber(t, locale, digits)}°`;
}

export function formatPercent(v, locale = 'en-US') {
  if (v === null || v === undefined || !isFinite(v)) return '--%';
  return `${formatNumber(v, locale, 0)}%`;
}

export function formatMemoryPair(pairString, locale = 'en-US') {
  if (!pairString) return '--';
  const match = pairString.match(/([\d.]+)\s*([A-Za-z]+)\s*\/\s*([\d.]+)\s*([A-Za-z]+)/);
  if (!match) return pairString;
  const used = Number(match[1]);
  const unitA = match[2];
  const total = Number(match[3]);
  const unitB = match[4];
  const usedStr = formatNumber(used, locale, 1);
  const totalStr = formatNumber(total, locale, 1);
  if (unitA === unitB) {
    return `${usedStr} / ${totalStr} ${unitA}`;
  }
  return `${usedStr} ${unitA} / ${totalStr} ${unitB}`;
}

export function formatDateTime(date, locale = 'en-US', showSeconds = true, hour12) {
  const time = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: hour12 === undefined ? undefined : !!hour12,
  });
  const dateStr = date.toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return { time, date: dateStr };
}

export function formatNumber(value, locale = 'en-US', digits = 0) {
  if (!isFinite(value)) return '--';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function scrambleText(text, symbols, intensity = 0.5) {
  if (!text || typeof text !== 'string') return text;
  const chars = text.split('');
  const pool = symbols && symbols.length ? symbols : ['⌖', '⌬', '⍜', '⍰', '⟁', '⟟', '⌰', '⌇', '⎔', '⌿'];
  const replaceCount = Math.max(1, Math.floor(chars.length * Math.max(0.1, intensity)));
  const indices = new Set();
  while (indices.size < replaceCount) {
    indices.add(Math.floor(Math.random() * chars.length));
  }
  indices.forEach(idx => {
    if (chars[idx] === ' ') return;
    const sym = pool[Math.floor(Math.random() * pool.length)];
    chars[idx] = sym;
  });
  return chars.join('');
}

export function resampleArray(values, targetCount) {
  if (!Array.isArray(values) || values.length === 0) {
    return new Array(targetCount).fill(0);
  }
  const result = new Array(targetCount);
  const factor = values.length / targetCount;
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * factor);
    const end = Math.floor((i + 1) * factor);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      if (values[j] !== undefined) {
        sum += values[j];
        count++;
      }
    }
    result[i] = count > 0 ? sum / count : 0;
  }
  return result;
}

export function exponentialBackoff(attempt, base = 2000, max = 60000) {
  const delay = Math.min(max, base * Math.pow(2, attempt));
  return delay;
}

export function paintContactPads(ctx, points, size, color, thickness) {
  ctx.save();
  ctx.lineWidth = thickness * 0.6;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  points.forEach(([x, y]) => {
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    ctx.fillRect(x - size / 4, y - size / 4, size / 2, size / 2);
  });
  ctx.restore();
}

export function jitterNoise(seed = 0) {
  // LCG for deterministic-ish jitter
  let s = seed % 2147483647;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}





