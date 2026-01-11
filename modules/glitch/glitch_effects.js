import {
  invertRect,
  invertScreen,
  posterizeRect,
  rgbSplitRect,
  rgbSplitScreen,
  horizontalTearRect,
  horizontalTearScreen,
  scanlinesRect,
  noiseRect,
  displacementWaveRect,
  jitterTransformRect,
  clipAndShiftRect,
  outlineFlashRect,
  arcBetweenPoints,
  buildLightningPath,
  drawLightning,
  drawElectricSparks,
  diagonalFractureSplit,
  AfterimageBuffer,
  copyRectToCanvas,
} from './fx_primitives.js';
import { ScrambleAnimator, scrambleText } from './text_scramble.js';
import { renderNoSignal, renderRebootSequence, renderPowerSurge, showOverlay, updateOverlay, hideOverlay } from './screen_events.js';

export function createEffectDefinitions() {
  const defs = [];
  const noop = () => {};
  const keepChars = /[\s\-:/,.%]/;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const getIntensity = context => context.intensityScale || 1;
  const getLocalIntensity = context => context.localIntensityScale || getIntensity(context);
  const getScale = context => context.viewportScale || 1;
  const scaledPx = (context, min, max) => (min + context.rand() * (max - min)) * getScale(context) * getIntensity(context);
  const scaledLocalPx = (context, min, max) =>
    (min + context.rand() * (max - min)) * getScale(context) * getLocalIntensity(context);
  const scaledAlpha = (context, min, max) => {
    const base = min + context.rand() * (max - min);
    const scaled = base * (0.7 + getIntensity(context) * 0.25);
    return clamp(scaled, min, max);
  };
  const scaledLocalAlpha = (context, min, max) => {
    const base = min + context.rand() * (max - min);
    const scaled = base * (0.7 + getLocalIntensity(context) * 0.35);
    return clamp(scaled, min, max);
  };
  const getElectricConfig = context => {
    const cfg = context.config || {};
    return {
      intensity: clamp(cfg.electricIntensity ?? 1.2, 0.5, 2),
      ladderSpeed: clamp(cfg.electricLadderSpeed ?? 1, 0.5, 2),
      audioReactive: cfg.electricAudioReactive !== false,
    };
  };
  const getElectricAudio = context => {
    const { audioReactive } = getElectricConfig(context);
    if (!audioReactive) return { peak: false, high: 0, transient: 0, energy: 0, low: 0, mid: 0 };
    const audio = context.audio || {};
    return {
      peak: !!audio.peak,
      high: audio.high ?? 0,
      transient: audio.transient ?? 0,
      energy: audio.energy ?? 0,
      low: audio.low ?? 0,
      mid: audio.mid ?? 0,
    };
  };
  const getElectricColors = context => {
    const cfg = context.config || {};
    return {
      primary: cfg.themePrimary || '#8dfc4f',
      secondary: cfg.themeSecondary || '#3fe7ff',
    };
  };
  const makeFlickerPattern = (rand, min = 2, max = 6) => {
    const count = Math.max(min, Math.floor(rand() * (max - min + 1)) + min);
    const flashes = [];
    for (let i = 0; i < count; i++) {
      flashes.push({
        t: rand(),
        width: 0.03 + rand() * 0.05,
        amp: 0.6 + rand() * 0.6,
      });
    }
    flashes.sort((a, b) => a.t - b.t);
    return flashes;
  };
  const flickerValue = (pattern, progress) => {
    if (!pattern || !pattern.length) return 0;
    let value = 0;
    pattern.forEach(flash => {
      const d = Math.abs(progress - flash.t);
      if (d < flash.width) value += flash.amp * (1 - d / flash.width);
    });
    return clamp(value, 0, 1.6);
  };
  const edgePointToward = (rectA, rectB) => {
    const ax = rectA.x + rectA.w * 0.5;
    const ay = rectA.y + rectA.h * 0.5;
    const bx = rectB.x + rectB.w * 0.5;
    const by = rectB.y + rectB.h * 0.5;
    const dx = bx - ax;
    const dy = by - ay;
    if (Math.abs(dx) > Math.abs(dy)) {
      const sign = dx > 0 ? 1 : -1;
      const t = (rectA.w * 0.5) / Math.max(1, Math.abs(dx));
      return {
        x: clamp(ax + rectA.w * 0.5 * sign, rectA.x, rectA.x + rectA.w),
        y: clamp(ay + dy * t, rectA.y, rectA.y + rectA.h),
      };
    }
    const sign = dy > 0 ? 1 : -1;
    const t = (rectA.h * 0.5) / Math.max(1, Math.abs(dy));
    return {
      x: clamp(ax + dx * t, rectA.x, rectA.x + rectA.w),
      y: clamp(ay + rectA.h * 0.5 * sign, rectA.y, rectA.y + rectA.h),
    };
  };
  const pickNearbyBlockPair = (context, maxDistance) => {
    const blocks = context.blocks || {};
    const exclude = context.excludeBlocks;
    const entries = Object.entries(blocks).filter(([, b]) => b && b.rect);
    const filtered = exclude ? entries.filter(([id]) => !exclude.has(id)) : entries;
    if (filtered.length < 2) return null;
    const pairs = [];
    for (let i = 0; i < filtered.length; i++) {
      const [idA, a] = filtered[i];
      const ca = { x: a.rect.x + a.rect.w * 0.5, y: a.rect.y + a.rect.h * 0.5 };
      for (let j = i + 1; j < filtered.length; j++) {
        const [idB, b] = filtered[j];
        const cb = { x: b.rect.x + b.rect.w * 0.5, y: b.rect.y + b.rect.h * 0.5 };
        const dist = Math.hypot(cb.x - ca.x, cb.y - ca.y);
        if (maxDistance && dist > maxDistance) continue;
        const importance = (a.importance || 1) * 0.6 + (b.importance || 1) * 0.6;
        const weight = importance * (1 / (0.15 + dist / Math.max(1, maxDistance || dist)));
        pairs.push({ a: idA, b: idB, weight });
      }
    }
    if (!pairs.length) return null;
    const total = pairs.reduce((sum, p) => sum + p.weight, 0);
    let r = context.rand() * total;
    for (let i = 0; i < pairs.length; i++) {
      r -= pairs[i].weight;
      if (r <= 0) return { a: pairs[i].a, b: pairs[i].b };
    }
    return { a: pairs[0].a, b: pairs[0].b };
  };
  const pickPreferredBlock = (context, preferIds) => {
    const blocks = context.blocks || {};
    const exclude = context.excludeBlocks;
    const entries = Object.entries(blocks).filter(([, b]) => b && b.rect);
    const filtered = exclude ? entries.filter(([id]) => !exclude.has(id)) : entries;
    if (!filtered.length) return null;
    const total = filtered.reduce((sum, [id, b]) => {
      const base = b.importance || 1;
      const boost = preferIds && preferIds.has(id) ? 1.6 : 1;
      return sum + base * boost;
    }, 0);
    let r = context.rand() * total;
    for (let i = 0; i < filtered.length; i++) {
      const [id, b] = filtered[i];
      const base = b.importance || 1;
      const boost = preferIds && preferIds.has(id) ? 1.6 : 1;
      r -= base * boost;
      if (r <= 0) return id;
    }
    return filtered[0][0];
  };
  const samplePath = (points, t, out) => {
    if (!points || points.length < 2) return null;
    const idx = Math.max(0, Math.min(points.length - 1, t * (points.length - 1)));
    const low = Math.floor(idx);
    const high = Math.min(points.length - 1, low + 1);
    const frac = idx - low;
    const a = points[low];
    const b = points[high];
    const x = a.x + (b.x - a.x) * frac;
    const y = a.y + (b.y - a.y) * frac;
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  };
  const buildSegmentPath = (points, startIdx, endIdx, out) => {
    if (!points || points.length < 2) return out;
    const last = points.length - 1;
    const begin = Math.max(0, Math.min(last, startIdx));
    const end = Math.max(0, Math.min(last, endIdx));
    const lo = Math.min(begin, end);
    const hi = Math.max(begin, end);
    out.length = 0;
    if (hi - lo < 1) return out;
    for (let i = lo; i <= hi; i++) {
      out.push(points[i]);
    }
    return out;
  };
  const pointOnPerimeter = (rect, t) => {
    const per = (rect.w + rect.h) * 2;
    let dist = (t % 1) * per;
    if (dist < rect.w) return { x: rect.x + dist, y: rect.y };
    dist -= rect.w;
    if (dist < rect.h) return { x: rect.x + rect.w, y: rect.y + dist };
    dist -= rect.h;
    if (dist < rect.w) return { x: rect.x + rect.w - dist, y: rect.y + rect.h };
    dist -= rect.w;
    return { x: rect.x, y: rect.y + rect.h - dist };
  };

  const blockEffect = (id, name, duration, cooldown, renderFn, updateFn, cleanupFn, triggerFn, options = {}) =>
    defs.push({
      id,
      name,
      category: 'block',
      weight: options.weight ?? 1,
      tags: options.tags || [],
      allowOverlap: options.allowOverlap ?? false,
      exclusive: options.exclusive ?? false,
      cooldownKey: options.cooldownKey || null,
      duration,
      cooldown,
      trigger(context) {
        this.block = context.pickBlock();
        this.rect = context.blocks[this.block]?.rect;
        if (triggerFn) triggerFn.call(this, context);
      },
      update(dt, context) {
        if (updateFn) updateFn.call(this, dt, context);
      },
      render(ctx, hudCanvas, mainCanvas, context) {
        if (!this.rect) return;
        if (renderFn) renderFn.call(this, ctx, hudCanvas, mainCanvas, context, this.rect);
      },
      cleanup(context) {
        if (cleanupFn) cleanupFn.call(this, context);
      },
    });

  const textEffect = (id, name, duration, cooldown, triggerFn, updateFn, cleanupFn, options = {}) =>
    defs.push({
      id,
      name,
      category: 'text',
      weight: options.weight ?? 1,
      tags: options.tags || [],
      duration,
      cooldown,
      trigger(context) {
        this.targets = context.pickTextTargets();
        this.originals = this.targets.map(el => el.textContent);
        if (triggerFn) triggerFn.call(this, context);
      },
      update(dt, context) {
        if (updateFn) updateFn.call(this, dt, context);
      },
      render: noop,
      cleanup(context) {
        if (cleanupFn) cleanupFn.call(this, context);
        if (this.targets && this.originals) {
          this.targets.forEach((el, idx) => {
            const original = this.originals[idx];
            if (original !== undefined) el.textContent = original;
          });
        }
      },
    });

  const screenEffect = (id, name, duration, cooldown, renderFn, weight = 1) =>
    defs.push({
      id,
      name,
      category: 'screen',
      duration,
      cooldown,
      weight,
      trigger: noop,
      update: noop,
      render: renderFn,
      cleanup: noop,
    });

  const bigEffect = (id, name, duration, cooldown, renderFn, triggerFn, updateFn, cleanupFn) =>
    defs.push({
      id,
      name,
      category: 'big',
      duration,
      cooldown,
      trigger: triggerFn || noop,
      update: updateFn || noop,
      render: renderFn,
      cleanup: cleanupFn || noop,
    });

  const pairEffect = (id, name, duration, cooldown, renderFn, updateFn, cleanupFn, triggerFn, options = {}) =>
    defs.push({
      id,
      name,
      category: 'block_pair',
      weight: options.weight ?? 1,
      tags: options.tags || [],
      allowOverlap: options.allowOverlap ?? false,
      exclusive: options.exclusive ?? false,
      cooldownKey: options.cooldownKey || null,
      duration,
      cooldown,
      trigger(context) {
        const pair = context.pickBlockPair ? context.pickBlockPair() : null;
        if (!pair) return;
        this.blockA = pair.a;
        this.blockB = pair.b;
        this.rectA = context.blocks[this.blockA]?.rect;
        this.rectB = context.blocks[this.blockB]?.rect;
        if (triggerFn) triggerFn.call(this, context);
      },
      update(dt, context) {
        if (updateFn) updateFn.call(this, dt, context);
      },
      render(ctx, hudCanvas, mainCanvas, context) {
        if (!this.rectA || !this.rectB) return;
        if (renderFn) renderFn.call(this, ctx, hudCanvas, mainCanvas, context, this.rectA, this.rectB);
      },
      cleanup(context) {
        if (cleanupFn) cleanupFn.call(this, context);
      },
    });

  blockEffect(1, 'Block Inversion Flicker', 0.2, 8, function (ctx, hud, main, context, r) {
    const rate = 18 + getLocalIntensity(context) * 6;
    if (Math.sin(this.elapsed * rate) > -0.1) invertRect(ctx, r.x, r.y, r.w, r.h);
  });

  blockEffect(2, 'Diagonal Fracture', 0.7, 10, (ctx, hud, main, context, r) => {
    diagonalFractureSplit(ctx, r.x, r.y, r.w, r.h, scaledPx(context, 12, 26));
  });

  blockEffect(3, 'RGB Misalign Snap', 0.6, 8, (ctx, hud, main, context, r) => {
    rgbSplitRect(ctx, r.x, r.y, r.w, r.h, scaledLocalPx(context, 6, 18));
  });

  blockEffect(4, 'Horizontal Signal Tear', 0.6, 8, (ctx, hud, main, context, r) => {
    horizontalTearRect(ctx, r.x, r.y, r.w, r.h, scaledLocalPx(context, 12, 80));
  });

  blockEffect(5, 'Block Phase Shift', 0.7, 9, (ctx, hud, main, context, r) => {
    const dx = scaledPx(context, 6, 14);
    const dy = -scaledPx(context, 3, 9);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x + dx, r.y + dy, r.w, r.h);
    ctx.restore();
  });

  blockEffect(6, 'Voltage Spike Outline', 0.6, 7, (ctx, hud, main, context, r) => {
    const alpha = scaledLocalAlpha(context, 0.65, 0.95);
    outlineFlashRect(
      ctx,
      r.x,
      r.y,
      r.w,
      r.h,
      `rgba(214,255,97,${alpha})`,
      Math.max(3, 3 + getLocalIntensity(context) * 0.8),
      'screen'
    );
  });

  blockEffect(7, 'Micro Jitter Shake', 0.55, 7, (ctx, hud, main, context, r) => {
    jitterTransformRect(ctx, r.x, r.y, r.w, r.h, scaledLocalPx(context, 2, 10));
  });

  blockEffect(8, 'Bit Depth Drop', 0.6, 9, (ctx, hud, main, context, r) => {
    const levels = clamp(Math.round(6 - getIntensity(context) * 1.2), 2, 6);
    posterizeRect(ctx, r.x, r.y, r.w, r.h, levels);
  });

  blockEffect(9, 'Viewport Crop Error', 0.55, 8, (ctx, hud, main, context, r) => {
    const dx = scaledPx(context, 12, 36) * (context.rand() < 0.5 ? -1 : 1);
    const dy = scaledPx(context, 2, 8) * (context.rand() < 0.5 ? -1 : 1);
    clipAndShiftRect(ctx, r.x, r.y, r.w, r.h, dx, dy);
  });

  blockEffect(10, 'Wireframe Mode', 0.8, 12, (ctx, hud, main, context, r) => {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(4,7,10,0.55)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    outlineFlashRect(ctx, r.x, r.y, r.w, r.h, `rgba(63,231,255,${scaledAlpha(context, 0.5, 0.8)})`, 2);
    scanlinesRect(ctx, r.x, r.y, r.w, r.h, 6, scaledAlpha(context, 0.25, 0.5));
  });

  blockEffect(11, 'Negative Shadow', 0.65, 9, (ctx, hud, main, context, r) => {
    const offset = scaledPx(context, 6, 16);
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.globalAlpha = 0.75;
    ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x + offset, r.y + offset, r.w, r.h);
    ctx.restore();
  });

  blockEffect(12, 'Panel Afterimage', 0.85, 12, function (ctx, hud, main, context, r) {
    if (!this.trail) this.trail = new AfterimageBuffer(5);
    this.trail.push(hud, r.x, r.y, r.w, r.h);
    this.trail.render(ctx, 0.22 + getIntensity(context) * 0.04);
  }, null, function () {
    this.trail = null;
  });

  blockEffect(13, 'HUD Parallax Slip', 0.8, 11, (ctx, hud, main, context, r) => {
    const dx = scaledPx(context, 8, 16);
    const dy = scaledPx(context, 4, 10);
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x + dx, r.y, r.w, r.h);
    ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x - dx * 0.6, r.y + dy * 0.6, r.w, r.h);
    ctx.restore();
  });

  blockEffect(14, 'Chromatic Aberration', 0.7, 10, (ctx, hud, main, context, r) => {
    if (!context.config.chromaticAberrationEnabled) return;
    rgbSplitRect(ctx, r.x, r.y, r.w, r.h, scaledLocalPx(context, 6, 18));
  });

  blockEffect(15, 'Electrical Arc', 0.75, 10, (ctx, hud, main, context, r) => {
    const x1 = r.x + context.rand() * r.w;
    const y1 = r.y + context.rand() * r.h;
    const x2 = r.x + context.rand() * r.w;
    const y2 = r.y + context.rand() * r.h;
    arcBetweenPoints(ctx, x1, y1, x2, y2, 12, scaledPx(context, 6, 12), 'rgba(63,231,255,0.85)');
  });

  blockEffect(16, 'Data Stream Leak', 0.9, 12, (ctx, hud, main, context, r) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(63,231,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const x = r.x + context.rand() * r.w;
      ctx.beginPath();
      ctx.moveTo(x, r.y);
      ctx.lineTo(x, r.y + r.h);
      ctx.stroke();
    }
    ctx.restore();
  });

  blockEffect(17, 'Grid Desync Pulse', 0.7, 10, (ctx, hud, main, context, r) => {
    scanlinesRect(ctx, r.x, r.y, r.w, r.h, 5, scaledAlpha(context, 0.3, 0.55));
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = 'rgba(141,252,79,0.4)';
    for (let x = r.x; x < r.x + r.w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x + (context.rand() - 0.5) * scaledPx(context, 2, 6), r.y);
      ctx.lineTo(x + (context.rand() - 0.5) * scaledPx(context, 2, 6), r.y + r.h);
      ctx.stroke();
    }
    ctx.restore();
  });

  blockEffect(18, 'Signal Gain Surge', 0.6, 8, (ctx, hud, main, context, r) => {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(141,252,79,${scaledAlpha(context, 0.25, 0.55)})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  });

  blockEffect(19, 'Font Weight Pop', 0.65, 10, function (ctx, hud, main, context, r) {
    const label = context.blockLabels[this.block] || this.block.toUpperCase();
    ctx.save();
    const size = Math.round(18 + getIntensity(context) * 2);
    ctx.font = `700 ${size}px Orbitron, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(141,252,79,0.85)';
    ctx.lineWidth = 3 + getIntensity(context) * 0.4;
    ctx.strokeText(label, r.x + 16, r.y + 12);
    ctx.restore();
  });

  blockEffect(20, 'Quantum Duplication', 0.8, 12, (ctx, hud, main, context, r) => {
    const dx = scaledPx(context, 10, 18);
    const dy = -scaledPx(context, 6, 14);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x + dx, r.y + dy, r.w, r.h);
    ctx.restore();
  });

  blockEffect(21, 'Scanline Collapse', 0.65, 10, (ctx, hud, main, context, r) => {
    scanlinesRect(ctx, r.x, r.y, r.w, r.h, 2, scaledAlpha(context, 0.35, 0.55));
  });

  blockEffect(22, 'HUD Overclock', 0.85, 12, function (ctx, hud, main, context, r) {
    const t = (this.elapsed * 4) % 1;
    const y = r.y + r.h * t;
    ctx.save();
    ctx.strokeStyle = 'rgba(63,231,255,0.6)';
    ctx.lineWidth = 3 + getIntensity(context) * 0.4;
    ctx.beginPath();
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
    ctx.stroke();
    ctx.restore();
  });

  blockEffect(23, 'Block Stutter', 0.9, 14, function (ctx, hud, main, context, r) {
    if (!this.frozen) {
      const temp = document.createElement('canvas');
      temp.width = r.w;
      temp.height = r.h;
      temp.getContext('2d').drawImage(hud, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      this.frozen = temp;
    }
    ctx.drawImage(this.frozen, r.x, r.y);
  }, null, function () {
    this.frozen = null;
  });

  blockEffect(24, 'Reflection Glitch', 0.75, 12, (ctx, hud, main, context, r) => {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.translate(0, r.y * 2 + r.h);
    ctx.scale(1, -1);
    ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    ctx.restore();
  });

  blockEffect(
    44,
    'Arc L-Branch',
    0.45,
    9,
    function (ctx, hud, main, context, r) {
      const jitter = scaledLocalPx(context, 6, 14);
      arcBetweenPoints(ctx, this.p1.x, this.p1.y, this.mid.x, this.mid.y, 8, jitter, this.arcColor);
      arcBetweenPoints(ctx, this.mid.x, this.mid.y, this.p2.x, this.p2.y, 8, jitter, this.arcColor);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = this.arcColor;
      ctx.fillRect(this.p1.x - 2, this.p1.y - 2, 4, 4);
      ctx.fillRect(this.p2.x - 2, this.p2.y - 2, 4, 4);
      ctx.restore();
    },
    null,
    null,
    function (context) {
      const margin = Math.max(6, Math.min(this.rect.w, this.rect.h) * 0.08);
      const pickPoint = () => ({
        x: this.rect.x + margin + context.rand() * (this.rect.w - margin * 2),
        y: this.rect.y + margin + context.rand() * (this.rect.h - margin * 2),
      });
      this.p1 = pickPoint();
      this.p2 = pickPoint();
      const useCorner = context.rand() < 0.5;
      this.mid = useCorner
        ? { x: this.p1.x, y: this.p2.y }
        : { x: this.p2.x, y: this.p1.y };
      this.mid.x += (context.rand() - 0.5) * scaledLocalPx(context, 4, 10);
      this.mid.y += (context.rand() - 0.5) * scaledLocalPx(context, 4, 10);
      const alpha = scaledLocalAlpha(context, 0.7, 0.95);
      this.arcColor = `rgba(63,231,255,${alpha})`;
    },
    { tags: ['electric'], weight: 1.1 }
  );

  blockEffect(
    45,
    'Contact Burn',
    0.55,
    10,
    function (ctx, hud, main, context, r) {
      const flash = Math.sin(this.progress * Math.PI);
      const alpha = scaledLocalAlpha(context, 0.65, 0.95) * flash;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(214,255,97,${alpha})`;
      this.corners.forEach(corner => {
        ctx.fillRect(corner.x - 3, corner.y - 3, 6, 6);
      });
      ctx.strokeStyle = `rgba(63,231,255,${alpha * 0.6})`;
      ctx.lineWidth = 2 + getLocalIntensity(context) * 0.6;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.3 + flash * 0.35;
      ctx.strokeStyle = 'rgba(63,231,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + r.w, r.y);
      ctx.lineTo(r.x + r.w, r.y + r.h);
      ctx.stroke();
      ctx.restore();
    },
    null,
    null,
    function () {
      const r = this.rect;
      this.corners = [
        { x: r.x + 4, y: r.y + 4 },
        { x: r.x + r.w - 4, y: r.y + 4 },
        { x: r.x + 4, y: r.y + r.h - 4 },
        { x: r.x + r.w - 4, y: r.y + r.h - 4 },
      ].filter(() => Math.random() > 0.3);
      if (this.corners.length < 2) this.corners.push({ x: r.x + r.w - 4, y: r.y + r.h - 4 });
    },
    { tags: ['electric'] }
  );

  blockEffect(
    46,
    'Short Circuit Outline',
    0.5,
    9,
    function (ctx, hud, main, context, r) {
      const pulses = 2 + Math.floor(context.rand() * 2);
      const base = scaledLocalAlpha(context, 0.65, 0.95);
      for (let i = 0; i < pulses; i++) {
        const phase = Math.sin((this.elapsed * 24 + i) * Math.PI * 0.5);
        if (phase > 0.15) {
          outlineFlashRect(
            ctx,
            r.x - i,
            r.y - i,
            r.w + i * 2,
            r.h + i * 2,
            `rgba(214,255,97,${base * phase})`,
            2 + i,
            'screen'
          );
        }
      }
    },
    null,
    null,
    null,
    { tags: ['electric'], weight: 1.2 }
  );

  blockEffect(
    47,
    'Voltage Ladder',
    0.65,
    11,
    function (ctx, hud, main, context, r) {
      const steps = 7;
      const idx = Math.floor(this.progress * steps);
      const segment = Math.max(12, r.w * 0.12);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `rgba(63,231,255,${scaledLocalAlpha(context, 0.65, 0.9)})`;
      ctx.lineWidth = 2 + getLocalIntensity(context) * 0.6;
      for (let i = 0; i < steps; i++) {
        if (Math.abs(i - idx) > 1) continue;
        const t = i / (steps - 1);
        const x = r.x + t * (r.w - segment);
        ctx.beginPath();
        ctx.moveTo(x, r.y);
        ctx.lineTo(x + segment, r.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r.x + r.w, r.y + t * (r.h - segment));
        ctx.lineTo(r.x + r.w, r.y + t * (r.h - segment) + segment);
        ctx.stroke();
      }
      ctx.restore();
    },
    null,
    null,
    null,
    { tags: ['electric'] }
  );

  blockEffect(
    48,
    'Spark Shower',
    0.55,
    9,
    function (ctx, hud, main, context, r) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      this.sparks.forEach(spark => {
        const alpha = spark.life * scaledLocalAlpha(context, 0.65, 0.95);
        ctx.fillStyle = `rgba(214,255,97,${alpha})`;
        ctx.fillRect(spark.x, spark.y, spark.size, spark.size);
        ctx.fillRect(spark.x - spark.size, spark.y, spark.size * 2, 1);
        ctx.fillRect(spark.x, spark.y - spark.size, 1, spark.size * 2);
      });
      ctx.restore();
    },
    function (dt) {
      this.sparks.forEach(spark => {
        spark.x += spark.vx * dt * 60;
        spark.y += spark.vy * dt * 60;
        spark.life = Math.max(0, spark.life - dt * 1.6);
      });
    },
    null,
    function (context) {
      const count = 6 + Math.floor(context.rand() * 14);
      this.sparks = [];
      for (let i = 0; i < count; i++) {
        this.sparks.push({
          x: this.rect.x + context.rand() * this.rect.w,
          y: this.rect.y + context.rand() * this.rect.h,
          vx: (context.rand() - 0.5) * scaledLocalPx(context, 6, 18),
          vy: (context.rand() - 0.5) * scaledLocalPx(context, 6, 18),
          size: 1 + Math.floor(context.rand() * 2),
          life: 0.8 + context.rand() * 0.4,
        });
      }
    },
    { tags: ['electric'], weight: 1.1 }
  );

  blockEffect(
    49,
    'Diagonal Slice Split',
    0.45,
    10,
    function (ctx, hud, main, context, r) {
      const temp = copyRectToCanvas(ctx, r.x, r.y, r.w, r.h);
      if (!temp) return;
      const t = Math.sin(this.progress * Math.PI);
      const offset = scaledLocalPx(context, 10, 22) * t;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + r.w, r.y);
      ctx.lineTo(r.x + r.w, r.y + r.h);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(temp, r.x + offset, r.y - offset);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x, r.y + r.h);
      ctx.lineTo(r.x + r.w, r.y + r.h);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(temp, r.x - offset, r.y + offset);
      ctx.restore();
    },
    null,
    null,
    null,
    { tags: ['deform'], weight: 1.05 }
  );

  blockEffect(
    50,
    'Shear Warp',
    0.6,
    11,
    function (ctx, hud, main, context, r) {
      const temp = copyRectToCanvas(ctx, r.x, r.y, r.w, r.h);
      if (!temp) return;
      const t = Math.sin(this.progress * Math.PI);
      const shear = (0.06 + getLocalIntensity(context) * 0.04) * t * this.shearSign;
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.translate(r.x, r.y);
      ctx.transform(1, shear, 0, 1, 0, 0);
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
    },
    null,
    null,
    function (context) {
      this.shearSign = context.rand() < 0.5 ? -1 : 1;
    },
    { tags: ['deform'] }
  );

  blockEffect(
    51,
    'Panel Slip',
    0.55,
    10,
    function (ctx, hud, main, context, r) {
      const t = Math.sin(this.progress * Math.PI);
      const dx = this.dx * t;
      const dy = this.dy * t;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x + dx, r.y + dy, r.w, r.h);
      ctx.globalAlpha = 0.35;
      ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x - dx * 0.35, r.y - dy * 0.35, r.w, r.h);
      ctx.restore();
    },
    null,
    null,
    function (context) {
      this.dx = scaledLocalPx(context, 6, 20) * (context.rand() < 0.5 ? -1 : 1);
      this.dy = scaledLocalPx(context, 4, 12) * (context.rand() < 0.5 ? -1 : 1);
    },
    { tags: ['deform'] }
  );

  blockEffect(
    52,
    'Clip Jump',
    0.4,
    9,
    function (ctx, hud, main, context, r) {
      const temp = copyRectToCanvas(ctx, r.x, r.y, r.w, r.h);
      if (!temp) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.clip.x, this.clip.y, this.clip.w, this.clip.h);
      ctx.clip();
      ctx.drawImage(
        temp,
        this.clip.x - r.x,
        this.clip.y - r.y,
        this.clip.w,
        this.clip.h,
        this.clip.x + this.shift.x,
        this.clip.y + this.shift.y,
        this.clip.w,
        this.clip.h
      );
      ctx.restore();
    },
    null,
    null,
    function (context) {
      const pad = Math.max(6, Math.min(this.rect.w, this.rect.h) * 0.1);
      const cw = Math.max(30, this.rect.w * (0.2 + context.rand() * 0.35));
      const ch = Math.max(20, this.rect.h * (0.2 + context.rand() * 0.35));
      this.clip = {
        x: this.rect.x + pad + context.rand() * (this.rect.w - cw - pad * 2),
        y: this.rect.y + pad + context.rand() * (this.rect.h - ch - pad * 2),
        w: cw,
        h: ch,
      };
      this.shift = {
        x: scaledLocalPx(context, 8, 24) * (context.rand() < 0.5 ? -1 : 1),
        y: scaledLocalPx(context, 4, 14) * (context.rand() < 0.5 ? -1 : 1),
      };
    },
    { tags: ['deform'], weight: 1.1 }
  );

  blockEffect(
    53,
    'Corner Pull',
    0.5,
    11,
    function (ctx, hud, main, context, r) {
      const temp = copyRectToCanvas(ctx, r.x, r.y, r.w, r.h);
      if (!temp) return;
      const t = Math.sin(this.progress * Math.PI);
      const dx = this.pull.x * t;
      const dy = this.pull.y * t;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.tri[0].x, this.tri[0].y);
      ctx.lineTo(this.tri[1].x, this.tri[1].y);
      ctx.lineTo(this.tri[2].x, this.tri[2].y);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(temp, r.x + dx, r.y + dy);
      ctx.restore();
    },
    null,
    null,
    function (context) {
      const r = this.rect;
      const corner = Math.floor(context.rand() * 4);
      const offset = scaledLocalPx(context, 8, 18);
      const signX = corner === 1 || corner === 3 ? 1 : -1;
      const signY = corner >= 2 ? 1 : -1;
      this.pull = { x: offset * signX, y: offset * signY };
      if (corner === 0) {
        this.tri = [
          { x: r.x, y: r.y },
          { x: r.x + r.w * 0.6, y: r.y },
          { x: r.x, y: r.y + r.h * 0.6 },
        ];
      } else if (corner === 1) {
        this.tri = [
          { x: r.x + r.w, y: r.y },
          { x: r.x + r.w * 0.4, y: r.y },
          { x: r.x + r.w, y: r.y + r.h * 0.6 },
        ];
      } else if (corner === 2) {
        this.tri = [
          { x: r.x, y: r.y + r.h },
          { x: r.x + r.w * 0.6, y: r.y + r.h },
          { x: r.x, y: r.y + r.h * 0.4 },
        ];
      } else {
        this.tri = [
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x + r.w * 0.4, y: r.y + r.h },
          { x: r.x + r.w, y: r.y + r.h * 0.4 },
        ];
      }
    },
    { tags: ['deform'] }
  );

  blockEffect(
    54,
    'Local Multi-Tear',
    0.6,
    10,
    function (ctx, hud, main, context, r) {
      const temp = copyRectToCanvas(ctx, r.x, r.y, r.w, r.h);
      if (!temp) return;
      this.slices.forEach(slice => {
        ctx.drawImage(
          temp,
          0,
          slice.y,
          r.w,
          slice.h,
          r.x + slice.dx,
          r.y + slice.y,
          r.w,
          slice.h
        );
      });
    },
    null,
    null,
    function (context) {
      const count = 2 + Math.floor(context.rand() * 5);
      this.slices = [];
      for (let i = 0; i < count; i++) {
        const h = Math.max(6, this.rect.h * (0.08 + context.rand() * 0.12));
        const y = context.rand() * (this.rect.h - h);
        this.slices.push({
          y,
          h,
          dx: scaledLocalPx(context, 12, 80) * (context.rand() < 0.5 ? -1 : 1),
        });
      }
    },
    { tags: ['signal'], weight: 1.1 }
  );

  blockEffect(
    55,
    'Burst Noise Window',
    0.35,
    8,
    function (ctx, hud, main, context, r) {
      const alpha = scaledLocalAlpha(context, 0.4, 0.75);
      noiseRect(ctx, this.window.x, this.window.y, this.window.w, this.window.h, alpha);
      outlineFlashRect(
        ctx,
        this.window.x,
        this.window.y,
        this.window.w,
        this.window.h,
        `rgba(63,231,255,${alpha})`,
        2,
        'screen'
      );
    },
    null,
    null,
    function (context) {
      const w = Math.max(24, this.rect.w * (0.2 + context.rand() * 0.35));
      const h = Math.max(20, this.rect.h * (0.15 + context.rand() * 0.35));
      this.window = {
        x: this.rect.x + context.rand() * (this.rect.w - w),
        y: this.rect.y + context.rand() * (this.rect.h - h),
        w,
        h,
      };
    },
    { tags: ['signal'] }
  );

  blockEffect(
    56,
    'Scanline Collapse Local',
    0.55,
    10,
    function (ctx, hud, main, context, r) {
      const temp = copyRectToCanvas(ctx, r.x, r.y, r.w, r.h);
      if (!temp) return;
      const t = Math.sin(this.progress * Math.PI);
      const shrink = 1 - t * 0.35;
      const offset = r.h * (1 - shrink) * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.drawImage(temp, r.x, r.y, r.w, r.h * shrink, r.x, r.y + offset, r.w, r.h * shrink);
      ctx.restore();
      scanlinesRect(ctx, r.x, r.y, r.w, r.h, 3, scaledLocalAlpha(context, 0.35, 0.65));
    },
    null,
    null,
    null,
    { tags: ['signal'] }
  );

  blockEffect(
    57,
    'Data Smear',
    0.35,
    9,
    function (ctx, hud, main, context, r) {
      const dir = this.dir;
      const t = Math.sin(this.progress * Math.PI);
      const dx = scaledLocalPx(context, 14, 40) * t * dir;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x + dx, r.y, r.w, r.h);
      ctx.globalAlpha = 0.3;
      ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x + dx * 1.8, r.y, r.w, r.h);
      ctx.restore();
    },
    null,
    null,
    function (context) {
      this.dir = context.rand() < 0.5 ? -1 : 1;
    },
    { tags: ['signal'], weight: 1.1 }
  );

  blockEffect(
    58,
    'Rolling Shutter',
    0.55,
    11,
    function (ctx, hud, main, context, r) {
      const bandH = Math.max(18, r.h * 0.22);
      const y = r.y + (r.h + bandH) * this.progress - bandH;
      const dx = scaledLocalPx(context, 12, 36) * (context.rand() < 0.5 ? -1 : 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, y, r.w, bandH);
      ctx.clip();
      ctx.drawImage(hud, r.x, r.y, r.w, r.h, r.x + dx, r.y, r.w, r.h);
      ctx.restore();
    },
    null,
    null,
    null,
    { tags: ['signal'] }
  );

  blockEffect(
    59,
    'Chromatic Fracture',
    0.45,
    10,
    function (ctx, hud, main, context, r) {
      if (!context.config.chromaticAberrationEnabled) return;
      ctx.save();
      ctx.beginPath();
      if (this.diagonal === 'tl') {
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + r.w, r.y);
        ctx.lineTo(r.x, r.y + r.h);
      } else {
        ctx.moveTo(r.x + r.w, r.y);
        ctx.lineTo(r.x + r.w, r.y + r.h);
        ctx.lineTo(r.x, r.y + r.h);
      }
      ctx.closePath();
      ctx.clip();
      rgbSplitRect(ctx, r.x, r.y, r.w, r.h, scaledLocalPx(context, 6, 18));
      ctx.restore();
    },
    null,
    null,
    function (context) {
      this.diagonal = context.rand() < 0.5 ? 'tl' : 'br';
    },
    { tags: ['color'] }
  );

  blockEffect(
    60,
    'Invert Flicker Tube',
    0.2,
    8,
    function (ctx, hud, main, context, r) {
      const phase = Math.sin(this.elapsed * 38);
      if (phase > 0.2) invertRect(ctx, r.x, r.y, r.w, r.h);
    },
    null,
    null,
    null,
    { tags: ['color'], weight: 1.1 }
  );

  blockEffect(
    61,
    'Posterize Pop',
    0.3,
    9,
    function (ctx, hud, main, context, r) {
      posterizeRect(ctx, r.x, r.y, r.w, r.h, 3);
      outlineFlashRect(
        ctx,
        r.x,
        r.y,
        r.w,
        r.h,
        `rgba(63,231,255,${scaledLocalAlpha(context, 0.6, 0.9)})`,
        2,
        'screen'
      );
    },
    null,
    null,
    null,
    { tags: ['color'] }
  );

  blockEffect(
    62,
    'Bloom Flash Fake',
    0.35,
    9,
    function (ctx, hud, main, context, r) {
      const alpha = scaledLocalAlpha(context, 0.65, 0.95);
      outlineFlashRect(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, `rgba(214,255,97,${alpha})`, 2, 'screen');
      outlineFlashRect(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, `rgba(63,231,255,${alpha * 0.6})`, 4, 'screen');
    },
    null,
    null,
    null,
    { tags: ['color'], weight: 1.1 }
  );

  blockEffect(
    63,
    'Color Channel Dropout',
    0.22,
    8,
    function (ctx, hud, main, context, r) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = this.maskColor;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    },
    null,
    null,
    function (context) {
      const pick = Math.floor(context.rand() * 3);
      this.maskColor = pick === 0 ? 'rgba(0,255,255,1)' : pick === 1 ? 'rgba(255,0,255,1)' : 'rgba(255,255,0,1)';
    },
    { tags: ['color'] }
  );

  blockEffect(
    64,
    'Baseline Wobble Local',
    0.6,
    10,
    function (ctx, hud, main, context, r) {
      const temp = copyRectToCanvas(ctx, r.x, r.y, r.w, r.h);
      if (!temp) return;
      const slice = Math.max(6, r.h * 0.08);
      for (let y = 0; y < r.h; y += slice) {
        const wobble = Math.sin((y / r.h) * Math.PI * 2 + this.elapsed * 14) * (2 + getLocalIntensity(context) * 2);
        ctx.drawImage(temp, 0, y, r.w, slice, r.x + wobble, r.y + y, r.w, slice);
      }
    },
    null,
    null,
    null,
    { tags: ['text'] }
  );

  blockEffect(
    65,
    'Digit Desync Local',
    0.45,
    9,
    function (ctx, hud, main, context, r) {
      const temp = copyRectToCanvas(ctx, r.x, r.y, r.w, r.h);
      if (!temp) return;
      this.columns.forEach(col => {
        ctx.drawImage(
          temp,
          col.x,
          0,
          col.w,
          r.h,
          r.x + col.x + col.dx,
          r.y,
          col.w,
          r.h
        );
      });
    },
    null,
    null,
    function (context) {
      const count = 4 + Math.floor(context.rand() * 4);
      this.columns = [];
      for (let i = 0; i < count; i++) {
        const w = Math.max(6, this.rect.w * (0.05 + context.rand() * 0.08));
        const x = context.rand() * (this.rect.w - w);
        this.columns.push({
          x,
          w,
          dx: scaledLocalPx(context, 6, 18) * (context.rand() < 0.5 ? -1 : 1),
        });
      }
    },
    { tags: ['text'] }
  );

  blockEffect(
    66,
    'Alien Burst Local',
    0.3,
    9,
    function (ctx, hud, main, context, r) {
      const symbols = context.symbolSet || [];
      if (!symbols.length) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(63,231,255,${scaledLocalAlpha(context, 0.6, 0.95)})`;
      ctx.font = `${Math.round(12 + getLocalIntensity(context) * 4)}px Orbitron, sans-serif`;
      ctx.textBaseline = 'middle';
      this.glyphs.forEach(g => {
        const ch = symbols[Math.floor(context.rand() * symbols.length)] || '#';
        ctx.fillText(ch, g.x, g.y);
      });
      ctx.restore();
    },
    null,
    null,
    function (context) {
      const count = 6 + Math.floor(context.rand() * 12);
      this.glyphs = [];
      for (let i = 0; i < count; i++) {
        this.glyphs.push({
          x: this.rect.x + context.rand() * this.rect.w,
          y: this.rect.y + context.rand() * this.rect.h,
        });
      }
    },
    { tags: ['text'], weight: 1.1 }
  );

  blockEffect(
    67,
    'Stutter Frame Local',
    0.5,
    11,
    function (ctx, hud, main, context, r) {
      if (!this.frozen) {
        const temp = document.createElement('canvas');
        temp.width = r.w;
        temp.height = r.h;
        temp.getContext('2d').drawImage(hud, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        this.frozen = temp;
      }
      if (this.progress < 0.55) {
        ctx.drawImage(this.frozen, r.x, r.y);
      } else {
        const dx = scaledLocalPx(context, 4, 12) * (context.rand() < 0.5 ? -1 : 1);
        ctx.drawImage(this.frozen, r.x + dx, r.y);
      }
    },
    null,
    function () {
      this.frozen = null;
    },
    null,
    { tags: ['text'] }
  );

  blockEffect(
    68,
    'Glitch Underline',
    0.4,
    9,
    function (ctx, hud, main, context, r) {
      const y = r.y + r.h - Math.max(12, r.h * 0.18);
      const segments = 6 + Math.floor(context.rand() * 6);
      const alpha = scaledLocalAlpha(context, 0.65, 0.95);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `rgba(141,252,79,${alpha})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < segments; i++) {
        const segW = r.w * (0.08 + context.rand() * 0.12);
        const x = r.x + context.rand() * (r.w - segW);
        const jitter = (context.rand() - 0.5) * scaledLocalPx(context, 4, 10);
        ctx.beginPath();
        ctx.moveTo(x, y + jitter);
        ctx.lineTo(x + segW, y + jitter);
        ctx.stroke();
      }
      ctx.restore();
    },
    null,
    null,
    null,
    { tags: ['text'] }
  );

  pairEffect(
    69,
    'Crosslink Arc',
    0.55,
    14,
    function (ctx, hud, main, context, a, b) {
      const x1 = a.x + a.w * 0.5;
      const y1 = a.y + a.h * 0.5;
      const x2 = b.x + b.w * 0.5;
      const y2 = b.y + b.h * 0.5;
      arcBetweenPoints(ctx, x1, y1, x2, y2, 10, scaledLocalPx(context, 6, 14), `rgba(63,231,255,0.9)`);
    },
    null,
    null,
    null,
    { tags: ['link', 'electric'], weight: 1.1 }
  );

  pairEffect(
    70,
    'Data Transfer',
    0.7,
    16,
    function (ctx, hud, main, context, a, b) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(214,255,97,${scaledLocalAlpha(context, 0.65, 0.95)})`;
      this.packets.forEach(p => {
        const x = a.x + a.w * 0.5 + (b.x + b.w * 0.5 - (a.x + a.w * 0.5)) * p.t;
        const y = a.y + a.h * 0.5 + (b.y + b.h * 0.5 - (a.y + a.h * 0.5)) * p.t;
        ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
      });
      ctx.restore();
    },
    function (dt) {
      this.packets.forEach(p => {
        p.t = (p.t + dt * p.speed) % 1;
      });
    },
    null,
    function (context) {
      const count = 5 + Math.floor(context.rand() * 6);
      this.packets = [];
      for (let i = 0; i < count; i++) {
        this.packets.push({
          t: context.rand(),
          speed: 0.6 + context.rand() * 0.8,
          size: 3 + Math.floor(context.rand() * 3),
        });
      }
    },
    { tags: ['link', 'signal'], weight: 1.1 }
  );

  pairEffect(
    71,
    'Sync Pulse',
    0.4,
    14,
    function (ctx, hud, main, context, a, b) {
      const alpha = scaledLocalAlpha(context, 0.65, 0.95) * Math.sin(this.progress * Math.PI);
      outlineFlashRect(ctx, a.x, a.y, a.w, a.h, `rgba(63,231,255,${alpha})`, 2, 'screen');
      outlineFlashRect(ctx, b.x, b.y, b.w, b.h, `rgba(63,231,255,${alpha})`, 2, 'screen');
    },
    null,
    null,
    null,
    { tags: ['link'] }
  );

  pairEffect(
    72,
    'Mirror Desync',
    0.6,
    16,
    function (ctx, hud, main, context, a, b) {
      if (!this.mirror) {
        const temp = document.createElement('canvas');
        temp.width = a.w;
        temp.height = a.h;
        temp.getContext('2d').drawImage(hud, a.x, a.y, a.w, a.h, 0, 0, a.w, a.h);
        this.mirror = temp;
      }
      if (!this.mirror) return;
      if (this.progress < 0.3) return;
      const dx = scaledLocalPx(context, 6, 14) * (context.rand() < 0.5 ? -1 : 1);
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(this.mirror, b.x + dx, b.y);
      ctx.restore();
    },
    null,
    function () {
      this.mirror = null;
    },
    null,
    { tags: ['link', 'deform'] }
  );

  pairEffect(
    73,
    'Arc Between Blocks',
    0.6,
    20,
    function (ctx, hud, main, context, a, b) {
      if (!this.path || this.path.length < 2) return;
      const audio = getElectricAudio(context);
      const { intensity } = getElectricConfig(context);
      const baseIntensity = getLocalIntensity(context);
      const colors = getElectricColors(context);
      const flicker = flickerValue(this.flickerPattern, this.progress);
      const audioBoost = (audio.peak ? 0.6 : 0) + audio.high * 0.55 + audio.transient * 0.45;
      const power = clamp(intensity * baseIntensity * (0.9 + audioBoost + flicker * 0.45), 0.6, 3.4);

      const alpha = clamp(0.55 + flicker * 0.5 + audioBoost * 0.2, 0.4, 1);
      drawLightning(ctx, this.path, {
        primary: colors.primary,
        secondary: colors.secondary,
        width: 2.4 + power * 1.6,
        alpha,
        intensity: power,
        flicker,
        time: this.elapsed,
        white: clamp((audio.peak ? 0.6 : 0.2) + flicker * 0.2, 0, 1),
      });

      if (this.secondaryPaths) {
        this.secondaryPaths.forEach(path => {
          if (!path || path.length < 2) return;
          drawLightning(ctx, path, {
            primary: colors.secondary,
            secondary: colors.primary,
            width: 1.4 + power * 0.8,
            alpha: clamp(alpha * 0.65, 0.3, 0.9),
            intensity: power * 0.7,
            flicker: flicker * 0.8,
            time: this.elapsed + 0.3,
            white: clamp(audio.peak ? 0.5 : 0.1, 0, 0.6),
          });
        });
      }

      if (flicker > 0.35) {
        const flashAlpha = clamp(0.55 + flicker * 0.4, 0.4, 0.95);
        outlineFlashRect(ctx, a.x, a.y, a.w, a.h, `rgba(63,231,255,${flashAlpha})`, 2.5, 'screen');
        outlineFlashRect(ctx, b.x, b.y, b.w, b.h, `rgba(214,255,97,${flashAlpha})`, 2.5, 'screen');
      }

      if (this.packets && this.packets.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        this.packets.forEach(packet => {
          const pos = samplePath(this.path, packet.t, this._packetPos);
          const ahead = samplePath(this.path, (packet.t + 0.02) % 1, this._packetAhead);
          if (!pos || !ahead) return;
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
          ctx.lineTo(ahead.x, ahead.y);
          ctx.lineWidth = packet.size;
          ctx.strokeStyle = `rgba(214,255,97,${packet.alpha})`;
          ctx.stroke();
        });
        ctx.restore();
      }

      if (flicker > 0.55 && context.rand() < 0.6) {
        const sparkSize = 12 + power * 4;
        drawElectricSparks(
          ctx,
          { x: this.pA.x - sparkSize, y: this.pA.y - sparkSize, w: sparkSize * 2, h: sparkSize * 2 },
          6 + Math.floor(power * 4),
          { color: `rgba(214,255,97,${clamp(0.5 + flicker * 0.4, 0.4, 0.95)})` }
        );
        drawElectricSparks(
          ctx,
          { x: this.pB.x - sparkSize, y: this.pB.y - sparkSize, w: sparkSize * 2, h: sparkSize * 2 },
          6 + Math.floor(power * 4),
          { color: `rgba(63,231,255,${clamp(0.5 + flicker * 0.4, 0.4, 0.95)})` }
        );
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
    },
    function (dt, context) {
      const audio = getElectricAudio(context);
      const audioBoost = (audio.peak ? 0.5 : 0) + audio.high * 0.4 + audio.transient * 0.3;
      this.pathTimer += dt;
      if (this.pathTimer >= this.pathInterval) {
        this.pathTimer = 0;
        this.seedBase = (this.seedBase + 11 + Math.floor(audio.transient * 6)) >>> 0;
        this.rebuild(context);
      }
      if (this.packets) {
        this.packets.forEach(packet => {
          packet.t = (packet.t + dt * packet.speed * (1 + audioBoost * 0.6)) % 1;
        });
      }
    },
    function () {
      this.path = null;
      this.secondaryPaths = null;
      this.flickerPattern = null;
    },
    function (context) {
      const maxDist = 1100 * getScale(context);
      const pair = pickNearbyBlockPair(context, maxDist);
      if (!pair) {
        this.rectA = null;
        this.rectB = null;
        return;
      }
      this.blockA = pair.a;
      this.blockB = pair.b;
      this.rectA = context.blocks[this.blockA]?.rect;
      this.rectB = context.blocks[this.blockB]?.rect;
      if (!this.rectA || !this.rectB) return;

      const audioInit = getElectricAudio(context);
      const { intensity } = getElectricConfig(context);

      this.duration = clamp(0.25 + context.rand() * 0.65, 0.25, 0.9);
      this.pA = edgePointToward(this.rectA, this.rectB);
      this.pB = edgePointToward(this.rectB, this.rectA);
      this.seedBase = (context.rand() * 0xffffffff) >>> 0;
      this.path = this.path || [];
      this.mainForks = this.mainForks || [];
      this.secondaryPaths = this.secondaryPaths || [];
      this.secondaryForks = this.secondaryForks || [];
      this.flickerPattern = makeFlickerPattern(context.rand, 2, 6);
      this.pathTimer = 0;
      this.pathInterval = 0.04 + context.rand() * 0.06;
      this._scratchA = this._scratchA || [];
      this._scratchB = this._scratchB || [];
      this._packetPos = this._packetPos || { x: 0, y: 0 };
      this._packetAhead = this._packetAhead || { x: 0, y: 0 };

      this.rebuild = ctx => {
        const audioNow = getElectricAudio(ctx);
        const audioBoost = (audioNow.peak ? 0.5 : 0) + audioNow.high * 0.4 + audioNow.transient * 0.3;
        const jag = 1 + audioBoost + intensity * 0.2;
        const jitter = scaledLocalPx(ctx, 6, 28) * jag;
        const segments = clamp(Math.round(18 + intensity * 8 + audioNow.high * 14), 12, 44);
        const forkChance = clamp(0.08 + audioNow.high * 0.15 + audioNow.transient * 0.12, 0.05, 0.2);
        buildLightningPath(this.pA, this.pB, {
          segments,
          jitter,
          forkChance,
          forkLength: 0.28 + audioNow.high * 0.12,
          seed: this.seedBase,
          out: this.path,
          forksOut: this.mainForks,
          scratchA: this._scratchA,
          scratchB: this._scratchB,
        });

        const secondaryCount = audioNow.peak ? 2 : audioNow.high > 0.55 ? 1 : 0;
        this.secondaryPaths.length = secondaryCount;
        this.secondaryForks.length = secondaryCount;
        for (let i = 0; i < secondaryCount; i++) {
          const t1 = 0.2 + ctx.rand() * 0.6;
          const t2 = Math.min(1, t1 + 0.15 + ctx.rand() * 0.25);
          const p1 = samplePath(this.path, t1, { x: 0, y: 0 });
          const p2 = samplePath(this.path, t2, { x: 0, y: 0 });
          if (!p1 || !p2) continue;
          const path = this.secondaryPaths[i] || [];
          const forkStore = this.secondaryForks[i] || [];
          buildLightningPath(p1, p2, {
            segments: Math.max(10, Math.round(segments * 0.6)),
            jitter: jitter * 0.7,
            forkChance: forkChance * 0.6,
            forkLength: 0.2 + audioNow.transient * 0.1,
            seed: this.seedBase + i * 101,
            out: path,
            forksOut: forkStore,
            scratchA: this._scratchA,
            scratchB: this._scratchB,
          });
          this.secondaryPaths[i] = path;
          this.secondaryForks[i] = forkStore;
        }
      };

      this.rebuild(context);

      const wantsPackets = audioInit.peak || audioInit.high > 0.6 || audioInit.transient > 0.45;
      if (wantsPackets) {
        const count = 3 + Math.floor(context.rand() * 8);
        this.packets = [];
        for (let i = 0; i < count; i++) {
          this.packets.push({
            t: context.rand(),
            speed: 0.6 + context.rand() * 0.8,
            size: 2 + context.rand() * 3,
            alpha: clamp(0.6 + context.rand() * 0.3, 0.5, 0.95),
          });
        }
      } else {
        this.packets = null;
      }
    },
    {
      tags: ['electric', 'electric-special', 'link', 'signal', 'spark', 'arc_between_blocks'],
      weight: 0.5,
      exclusive: true,
      cooldownKey: 'electricArcCooldown',
    }
  );

  blockEffect(
    74,
    "Jacob's Ladder (Local)",
    0.6,
    12,
    function (ctx, hud, main, context, r) {
      if (!this.path || this.path.length < 2) return;
      const audio = getElectricAudio(context);
      const { intensity } = getElectricConfig(context);
      const flicker = flickerValue(this.flickerPattern, this.progress);
      const audioBoost = (audio.peak ? 0.45 : 0) + audio.high * 0.35 + audio.transient * 0.3;
      const power = clamp(intensity * getLocalIntensity(context) * (0.9 + audioBoost + flicker * 0.4), 0.6, 2.8);
      const colors = getElectricColors(context);

      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();

      const headIdx = Math.floor(this.headT * (this.path.length - 1));
      const trail = Math.max(4, Math.round(this.path.length * 0.28));
      const startIdx = Math.max(0, headIdx - trail);
      buildSegmentPath(this.path, startIdx, headIdx, this.segmentPath);
      this.segmentPath.forks = null;
      drawLightning(ctx, this.segmentPath, {
        primary: colors.primary,
        secondary: colors.secondary,
        width: 2 + power * 1.4,
        alpha: clamp(0.45 + flicker * 0.4, 0.35, 0.9),
        intensity: power,
        flicker,
        time: this.elapsed + 0.5,
        white: clamp((audio.peak ? 0.55 : 0.15) + flicker * 0.25, 0, 1),
      });

      const head = samplePath(this.path, this.headT, this._headPos);
      if (head) {
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(255,255,255,${clamp(0.6 + flicker * 0.4, 0.5, 1)})`;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 3 + power * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (flicker > 0.55 && context.rand() < 0.6) {
        const edgePad = Math.max(6, r.w * 0.04);
        const edgeRect = {
          x: r.x + edgePad,
          y: r.y + edgePad,
          w: r.w - edgePad * 2,
          h: r.h - edgePad * 2,
        };
        drawElectricSparks(ctx, edgeRect, 5 + Math.floor(power * 4), {
          color: `rgba(214,255,97,${clamp(0.4 + flicker * 0.4, 0.35, 0.95)})`,
        });
      }

      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
    },
    function (dt, context) {
      const audio = getElectricAudio(context);
      const { ladderSpeed } = getElectricConfig(context);
      const audioBoost = (audio.peak ? 0.4 : 0) + audio.high * 0.3 + audio.transient * 0.25;
      const speed = this.speed * ladderSpeed * (1 + audioBoost);
      this.headT = clamp(this.headT + dt * speed, 0, 1.05);

      this.stepTimer += dt;
      if (this.stepTimer >= this.stepInterval) {
        this.stepTimer = 0;
        this.seedBase = (this.seedBase + 17 + Math.floor(audio.transient * 6)) >>> 0;
        this.rebuild(context);
      }
    },
    function () {
      this.path = null;
      this.segmentPath = null;
    },
    function (context) {
      const preferIds = new Set(['network', 'system', 'nowPlaying']);
      const block = pickPreferredBlock(context, preferIds);
      if (!block) {
        this.rect = null;
        return;
      }
      this.block = block;
      this.rect = context.blocks[block]?.rect;
      if (!this.rect) return;

      const audioInit = getElectricAudio(context);
      const audioBoost = (audioInit.peak ? 0.4 : 0) + audioInit.high * 0.35 + audioInit.transient * 0.25;
      const { ladderSpeed } = getElectricConfig(context);

      this.duration = clamp(0.28 + context.rand() * 0.6, 0.25, 0.9);
      this.variant = context.rand() < 0.34 ? 'horizontal' : context.rand() < 0.67 ? 'vertical' : 'outline';
      this.seedBase = (context.rand() * 0xffffffff) >>> 0;
      this.path = this.path || [];
      this.pathForks = this.pathForks || [];
      this.segmentPath = this.segmentPath || [];
      this.outlineSegments = this.outlineSegments || [];
      this.flickerPattern = makeFlickerPattern(context.rand, 2, 6);
      this._scratchA = this._scratchA || [];
      this._scratchB = this._scratchB || [];
      this._headPos = this._headPos || { x: 0, y: 0 };

      this.headT = 0;
      this.speed = (0.85 + context.rand() * 0.6) / Math.max(0.2, this.duration) * (1 + audioBoost * 0.3);
      this.stepInterval = clamp((0.02 + context.rand() * 0.04) / (ladderSpeed * (1 + audioBoost * 0.4)), 0.02, 0.06);
      this.stepTimer = 0;

      this.rebuild = ctx => {
        const audioNow = getElectricAudio(ctx);
        const jitter = scaledLocalPx(ctx, 6, 26) * (1 + (audioNow.peak ? 0.4 : 0) + audioNow.high * 0.35);
        const forkChance = clamp(0.08 + audioNow.high * 0.12 + audioNow.transient * 0.1, 0.05, 0.2);
        if (this.variant === 'outline') {
          const perTrail = 0.3;
          const headT = clamp(this.headT, 0, 1);
          const tailT = Math.max(0, headT - perTrail);
          const anchors = [];
          const steps = 4;
          for (let i = 0; i <= steps; i++) {
            const t = tailT + (headT - tailT) * (i / steps);
            anchors.push(pointOnPerimeter(this.rect, t));
          }
          this.path.length = 0;
          this.outlineSegments.length = anchors.length - 1;
          for (let i = 0; i < anchors.length - 1; i++) {
            const seg = this.outlineSegments[i] || [];
            buildLightningPath(anchors[i], anchors[i + 1], {
              segments: 10,
              jitter: jitter * 0.65,
              forkChance: forkChance * 0.5,
              forkLength: 0.25,
              seed: this.seedBase + i * 31,
              out: seg,
              forksOut: null,
              scratchA: this._scratchA,
              scratchB: this._scratchB,
            });
            this.outlineSegments[i] = seg;
            if (seg.length) {
              if (this.path.length) seg.shift();
              this.path.push(...seg);
            }
          }
          this.path.forks = null;
          return;
        }

        const pad = Math.max(6, this.rect.w * 0.03);
        const padY = Math.max(6, this.rect.h * 0.03);
        let p0 = null;
        let p1 = null;
        if (this.variant === 'horizontal') {
          const y = this.rect.y + padY + ctx.rand() * (this.rect.h - padY * 2);
          p0 = { x: this.rect.x + pad, y };
          p1 = { x: this.rect.x + this.rect.w - pad, y: y + (ctx.rand() - 0.5) * this.rect.h * 0.2 };
        } else {
          const x = this.rect.x + pad + ctx.rand() * (this.rect.w - pad * 2);
          p0 = { x, y: this.rect.y + padY };
          p1 = { x: x + (ctx.rand() - 0.5) * this.rect.w * 0.2, y: this.rect.y + this.rect.h - padY };
        }
        buildLightningPath(p0, p1, {
          segments: clamp(Math.round(16 + audioNow.high * 12), 12, 38),
          jitter,
          forkChance,
          forkLength: 0.3,
          seed: this.seedBase,
          out: this.path,
          forksOut: this.pathForks,
          scratchA: this._scratchA,
          scratchB: this._scratchB,
        });
      };

      this.rebuild(context);
    },
    { tags: ['electric', 'electric-special', 'signal', 'spark', 'jacobs_ladder_block'], weight: 1.25 }
  );

  textEffect(
    25,
    'Text Scramble Mild',
    0.75,
    8,
    function (context) {
      this.scramblers = this.targets.map(
        (el, idx) =>
          new ScrambleAnimator(this.originals[idx] ?? el.textContent, {
            mode: 'mild',
            symbols: context.symbolSet,
            strengthMultiplier: context.symbolStrength || 1,
          })
      );
      this.scramblers.forEach(s => s.activate('mild', 0.75));
    },
    function (dt) {
      this.targets.forEach((el, idx) => {
        el.textContent = this.scramblers[idx].update(dt);
      });
    }
  );

  textEffect(
    26,
    'Text Scramble Aggressive',
    0.9,
    10,
    function (context) {
      this.scramblers = this.targets.map(
        (el, idx) =>
          new ScrambleAnimator(this.originals[idx] ?? el.textContent, {
            mode: 'aggressive',
            symbols: context.symbolSet,
            strengthMultiplier: context.symbolStrength || 1,
          })
      );
      this.scramblers.forEach(s => s.activate('aggressive', 0.85));
    },
    function (dt) {
      this.targets.forEach((el, idx) => {
        el.textContent = this.scramblers[idx].update(dt);
      });
    }
  );

  textEffect(
    27,
    'Baseline Drift',
    0.7,
    8,
    function () {
      this.baseTransforms = this.targets.map(el => el.style.transform || '');
      this.driftPhases = this.targets.map(() => Math.random() * Math.PI * 2);
    },
    function (dt, context) {
      const intensity = getIntensity(context);
      this.targets.forEach((el, idx) => {
        const phase = this.driftPhases[idx] || 0;
        const drift = Math.sin(this.elapsed * 14 + phase) * (2.5 + intensity * 1.6);
        const base = this.baseTransforms[idx] || '';
        el.style.transform = base ? `${base} translateY(${drift.toFixed(2)}px)` : `translateY(${drift.toFixed(2)}px)`;
      });
    },
    function () {
      this.targets.forEach((el, idx) => {
        el.style.transform = this.baseTransforms?.[idx] || '';
      });
      this.baseTransforms = null;
      this.driftPhases = null;
    }
  );

  textEffect(
    28,
    'Glyph Substitution Wave',
    0.9,
    10,
    function (context) {
      this.symbols = context.symbolSet;
      const multiplier = context.symbolStrength ?? 1;
      this.strength = Math.max(0.2, Math.min(0.95, 0.35 + 0.35 * multiplier * (0.7 + getIntensity(context) * 0.2)));
    },
    function (dt, context) {
      this.targets.forEach((el, idx) => {
        const base = this.originals?.[idx] ?? el.textContent;
        const len = base.length;
        if (!len) return;
        const center = (this.progress * 1.3 - 0.15) * len;
        const width = Math.max(1, Math.floor(len * 0.35));
        const symbols = this.symbols;
        const next = base.split('').map((ch, i) => {
          if (keepChars.test(ch)) return ch;
          const dist = Math.abs(i - center);
          const local = Math.max(0, 1 - dist / width);
          if (Math.random() < local * this.strength) {
            const pick = Math.floor(context.rand() * symbols.length);
            return symbols[pick] || ch;
          }
          return ch;
        });
        el.textContent = next.join('');
      });
    }
  );

  textEffect(
    29,
    'Numeric Desync',
    0.7,
    10,
    function () {
      this.baseShadows = this.targets.map(el => el.style.textShadow || '');
      this.baseSpacing = this.targets.map(el => el.style.letterSpacing || '');
    },
    function (dt, context) {
      const intensity = getIntensity(context);
      const digits = '0123456789';
      this.targets.forEach((el, idx) => {
        const base = this.originals?.[idx] ?? el.textContent;
        const swapped = base.replace(/\d/g, d => {
          if (context.rand() < 0.55) {
            return digits[Math.floor(context.rand() * digits.length)];
          }
          return d;
        });
        const offset = (context.rand() - 0.5) * 3.6 * intensity;
        el.textContent = swapped;
        el.style.letterSpacing = `${offset.toFixed(2)}px`;
        el.style.textShadow = `${offset.toFixed(1)}px 0 rgba(63,231,255,0.6), ${(-offset).toFixed(
          1
        )}px 0 rgba(141,252,79,0.5)`;
      });
    },
    function () {
      this.targets.forEach((el, idx) => {
        el.style.textShadow = this.baseShadows?.[idx] || '';
        el.style.letterSpacing = this.baseSpacing?.[idx] || '';
      });
      this.baseShadows = null;
      this.baseSpacing = null;
    }
  );

  textEffect(
    30,
    'Underflow/Overflow Flash',
    0.55,
    8,
    function () {
      this.baseColors = this.targets.map(el => el.style.color || '');
      this.baseShadows = this.targets.map(el => el.style.textShadow || '');
    },
    function (dt, context) {
      const flash = Math.sin(this.progress * Math.PI);
      const intensity = getIntensity(context);
      const glow = (0.4 + flash * 0.55) * intensity;
      this.targets.forEach((el, idx) => {
        el.style.color = flash > 0.5 ? 'rgba(214,255,97,0.95)' : 'rgba(63,231,255,0.9)';
        el.style.textShadow = `0 0 ${Math.round(10 * glow)}px rgba(63,231,255,${0.45 * glow})`;
      });
    },
    function () {
      this.targets.forEach((el, idx) => {
        el.style.color = this.baseColors?.[idx] || '';
        el.style.textShadow = this.baseShadows?.[idx] || '';
      });
      this.baseColors = null;
      this.baseShadows = null;
    }
  );

  screenEffect(31, 'Full Chromatic Sweep', 0.5, 18, function (ctx, hud, main, context) {
    if (!context.config.chromaticAberrationEnabled) return;
    rgbSplitScreen(ctx, scaledPx(context, 6, 14));
  });

  screenEffect(32, 'Full Invert Blink', 0.3, 18, function (ctx) {
    invertScreen(ctx);
  });

  screenEffect(33, 'Scanline Noise Burst', 0.55, 16, function (ctx, hud, main, context) {
    scanlinesRect(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, 2, scaledAlpha(context, 0.25, 0.55));
    noiseRect(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, scaledAlpha(context, 0.25, 0.55));
  });

  screenEffect(34, 'Global Horizontal Tear', 0.5, 16, function (ctx, hud, main, context) {
    horizontalTearScreen(ctx, scaledPx(context, 20, 60));
  });

  screenEffect(35, 'V-Sync Roll', 0.55, 18, function (ctx, hud, main, context) {
    displacementWaveRect(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, scaledPx(context, 6, 14), 10);
  });

  screenEffect(36, 'Global Dim/Flare', 0.45, 16, function (ctx, hud, main, context) {
    ctx.save();
    ctx.fillStyle = 'rgba(4,7,10,0.55)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(63,231,255,${scaledAlpha(context, 0.25, 0.55)})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  });

  screenEffect(37, 'CRT Degauss Pulse', 0.55, 20, function (ctx, hud, main, context) {
    ctx.save();
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.strokeStyle = `rgba(141,252,79,${scaledAlpha(context, 0.3, 0.6)})`;
    ctx.lineWidth = 3 + getIntensity(context) * 0.4;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  screenEffect(38, 'Spark Rain', 0.5, 16, function (ctx, hud, main, context) {
    ctx.save();
    ctx.fillStyle = `rgba(141,252,79,${scaledAlpha(context, 0.45, 0.8)})`;
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * ctx.canvas.width;
      const y = Math.random() * ctx.canvas.height;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  });

  screenEffect(
    42,
    'Hard Refresh Sweep',
    0.28,
    22,
    function (ctx, hud, main, context) {
      const transform = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      const scale = transform.a || 1;
      const width = ctx.canvas.width / scale;
      const height = ctx.canvas.height / scale;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
      ctx.drawImage(hud, 0, 0);
      const sweepX = width * this.progress;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = scaledAlpha(context, 0.35, 0.65);
      ctx.fillStyle = 'rgba(63,231,255,0.6)';
      ctx.fillRect(sweepX - 50, 0, 100, height);
      ctx.strokeStyle = `rgba(214,255,97,${scaledAlpha(context, 0.6, 0.85)})`;
      ctx.lineWidth = 3 + getIntensity(context) * 0.8;
      ctx.beginPath();
      ctx.moveTo(sweepX, 0);
      ctx.lineTo(sweepX, height);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.restore();
    },
    0.55
  );

  screenEffect(
    43,
    'Context Sanitizer',
    0.22,
    45,
    function (ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.restore();
    },
    0.2
  );

  bigEffect(
    39,
    'NO SIGNAL',
    0.9,
    30,
    function (ctx, hud, main, context) {
      renderNoSignal(ctx, ctx.canvas.width, ctx.canvas.height, this.progress);
    },
    function () {
      showOverlay('NO SIGNAL', 'RECONNECTING', 'rgba(141,252,79,0.95)');
    },
    function () {
      updateOverlay(this.progress);
    },
    function () {
      hideOverlay();
    }
  );

  bigEffect(
    40,
    'REBOOT SEQUENCE',
    1.25,
    35,
    function (ctx, hud, main, context) {
      renderRebootSequence(ctx, ctx.canvas.width, ctx.canvas.height, context.blocks, this.progress);
    },
    function () {
      showOverlay('REBOOT SEQUENCE', 'INITIALIZING HUD', 'rgba(63,231,255,0.95)');
    },
    function () {
      updateOverlay(this.progress);
    },
    function () {
      hideOverlay();
    }
  );

  bigEffect(
    41,
    'POWER SURGE',
    0.8,
    35,
    function (ctx, hud, main, context) {
      renderPowerSurge(ctx, ctx.canvas.width, ctx.canvas.height, this.progress);
      if (context.config.chromaticAberrationEnabled) {
        rgbSplitScreen(ctx, scaledPx(context, 8, 16));
      }
      invertScreen(ctx);
    },
    function () {
      showOverlay('POWER SURGE', 'VOLTAGE SPIKE', 'rgba(214,255,97,0.95)');
    },
    function () {
      updateOverlay(this.progress);
    },
    function () {
      hideOverlay();
    }
  );

  return defs;
}
