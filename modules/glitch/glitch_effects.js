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
  diagonalFractureSplit,
  AfterimageBuffer,
} from './fx_primitives.js';
import { ScrambleAnimator, scrambleText } from './text_scramble.js';
import { renderNoSignal, renderRebootSequence, renderPowerSurge, showOverlay, updateOverlay, hideOverlay } from './screen_events.js';

export function createEffectDefinitions() {
  const defs = [];
  const noop = () => {};
  const keepChars = /[\s\-:/,.%]/;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const getIntensity = context => context.intensityScale || 1;
  const getScale = context => context.viewportScale || 1;
  const scaledPx = (context, min, max) => (min + context.rand() * (max - min)) * getScale(context) * getIntensity(context);
  const scaledAlpha = (context, min, max) => {
    const base = min + context.rand() * (max - min);
    const scaled = base * (0.7 + getIntensity(context) * 0.25);
    return clamp(scaled, min, max);
  };

  const blockEffect = (id, name, duration, cooldown, renderFn, updateFn, cleanupFn, triggerFn) =>
    defs.push({
      id,
      name,
      category: 'block',
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

  const textEffect = (id, name, duration, cooldown, triggerFn, updateFn, cleanupFn) =>
    defs.push({
      id,
      name,
      category: 'text',
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

  const screenEffect = (id, name, duration, cooldown, renderFn) =>
    defs.push({
      id,
      name,
      category: 'screen',
      duration,
      cooldown,
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

  blockEffect(1, 'Block Inversion Flicker', 0.55, 8, function (ctx, hud, main, context, r) {
    const rate = 20 + getIntensity(context) * 6;
    if (Math.sin(this.elapsed * rate) > -0.1) invertRect(ctx, r.x, r.y, r.w, r.h);
  });

  blockEffect(2, 'Diagonal Fracture', 0.7, 10, (ctx, hud, main, context, r) => {
    diagonalFractureSplit(ctx, r.x, r.y, r.w, r.h, scaledPx(context, 12, 26));
  });

  blockEffect(3, 'RGB Misalign Snap', 0.6, 8, (ctx, hud, main, context, r) => {
    rgbSplitRect(ctx, r.x, r.y, r.w, r.h, scaledPx(context, 4, 14));
  });

  blockEffect(4, 'Horizontal Signal Tear', 0.6, 8, (ctx, hud, main, context, r) => {
    horizontalTearRect(ctx, r.x, r.y, r.w, r.h, scaledPx(context, 10, 60));
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
    const alpha = scaledAlpha(context, 0.5, 0.85);
    outlineFlashRect(ctx, r.x, r.y, r.w, r.h, `rgba(214,255,97,${alpha})`, Math.max(3, 3 + getIntensity(context) * 0.6));
  });

  blockEffect(7, 'Micro Jitter Shake', 0.55, 7, (ctx, hud, main, context, r) => {
    jitterTransformRect(ctx, r.x, r.y, r.w, r.h, scaledPx(context, 2, 6));
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
    rgbSplitRect(ctx, r.x, r.y, r.w, r.h, scaledPx(context, 6, 14));
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
