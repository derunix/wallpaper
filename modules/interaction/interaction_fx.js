import { DEFAULT_SYMBOL_SET } from '../glitch/text_scramble.js';

const DEFAULT_MENU_ITEMS = [
  { id: 'grid', label: 'TOGGLE GRID' },
  { id: 'glitch', label: 'TOGGLE GLITCHES' },
  { id: 'diag', label: 'TOGGLE DIAGNOSTICS' },
  { id: 'reset', label: 'RESET LAYOUT' },
];

const DEFAULT_TOOLTIP = 'INTERACTION ACTIVE';
const DEFAULT_PIN_LABEL = 'PIN';

const BIG_EVENTS = [
  { id: 'calibration', min: 0.6, max: 1.2 },
  { id: 'dataRealign', min: 0.5, max: 0.9 },
  { id: 'linkResync', min: 0.4, max: 0.8 },
  { id: 'audioResync', min: 0.4, max: 0.9 },
  { id: 'selfTest', min: 0.7, max: 1.4 },
  { id: 'refreshSweep', min: 0.5, max: 1.0 },
];

const randRange = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export class InteractionFX {
  constructor(bus, options = {}) {
    this.bus = bus;
    this.config = {
      interactivityEnabled: true,
      hoverEffectsEnabled: true,
      clickEffectsEnabled: true,
      cursorTrailEnabled: true,
      parallaxEnabled: true,
      interactiveControlsEnabled: true,
      hiddenGesturesEnabled: true,
      tooltipsEnabled: false,
      uiResponsiveness: 1,
      tooltipText: DEFAULT_TOOLTIP,
      pinLabel: DEFAULT_PIN_LABEL,
      menuItems: DEFAULT_MENU_ITEMS,
      symbolSet: DEFAULT_SYMBOL_SET,
      textScale: 1,
      eventLabels: {},
      ...options,
    };
    this.blocks = {};
    this.blockElements = {};
    this.hovered = null;
    this.hoverAlpha = 0;
    this.hoverInterest = 0;
    this.edgeProximity = 0;
    this.hoverScan = null;
    this.hoverHold = 0;
    this.hoverHoldTriggered = false;
    this.holdTime = 0;
    this.holdBlock = null;
    this.holdTriggered = false;
    this.suppressClickUntil = 0;
    this.trail = [];
    this.pings = [];
    this.ripples = [];
    this.waveRipples = [];
    this.symbols = [];
    this.sparks = [];
    this.focusZoom = [];
    this.clickBurst = [];
    this.motionSamples = [];
    this.motionBlock = null;
    this.pinned = new Set();
    this.detailLevel = {};
    this.parallax = { x: 0, y: 0 };
    this.contextMenu = null;
    this.bigEvents = [];
    this.nextBigEventAt = performance.now() + randRange(24000, 52000);
    this.lastBigEventAt = 0;
  }

  setConfig(next = {}) {
    Object.assign(this.config, next);
  }

  setBlocks(blocks, blockElements = {}) {
    this.blocks = blocks;
    this.blockElements = blockElements;
  }

  triggerPulse(blockId, intensity = 1) {
    const rect = this.blocks[blockId]?.rect;
    if (!rect) return;
    this.pings.push({ rect, life: 0.5, dash: 0, intensity });
  }

  update(dt, input, hit, audioState) {
    if (!this.config.interactivityEnabled || !input.focused) {
      this.hoverAlpha = 0;
      this.trail = [];
      return;
    }

    const now = performance.now();
    const responsive = clamp(this.config.uiResponsiveness || 1, 0.5, 2);
    const dtScaled = dt * responsive;
    const speed = Math.hypot(input.velocity.x, input.velocity.y);

    if (this.config.parallaxEnabled) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      this.parallax.x = ((input.pos.x - centerX) / centerX) * 3;
      this.parallax.y = ((input.pos.y - centerY) / centerY) * 3;
    } else {
      this.parallax.x = 0;
      this.parallax.y = 0;
    }

    if (hit.isInside) {
      if (this.hovered !== hit.hoveredBlockId) {
        this.hovered = hit.hoveredBlockId;
        this.hoverScan = { progress: 0 };
      }
      this.edgeProximity = hit.edgeProximity || 0;
      const interest = this.blocks[hit.hoveredBlockId]?.interest || 0;
      this.hoverInterest = interest;
      this.hoverAlpha = Math.min(1, this.hoverAlpha + dtScaled * (5 + interest * 5));
    } else {
      this.hoverAlpha = Math.max(0, this.hoverAlpha - dtScaled * 6);
      this.hovered = null;
      this.hoverInterest = 0;
      this.edgeProximity = 0;
    }

    if (this.config.hiddenGesturesEnabled) {
      this._updateHoverHold(dtScaled, hit);
      this._updateHold(dtScaled, input, hit);
      this._trackCircularGesture(hit, input, now);
    } else {
      this.hoverHold = 0;
      this.hoverHoldTriggered = false;
      this.holdTime = 0;
      this.holdBlock = null;
      this.holdTriggered = false;
      this.motionSamples = [];
    }

    if (hit.isInside && hit.hoveredBlockId === 'waveform' && speed > 200) {
      this.waveRipples.push({
        x: input.pos.x,
        y: input.pos.y,
        r: 0,
        life: 0.5,
      });
    }

    if (this.hoverScan) {
      this.hoverScan.progress += dtScaled * 1.8;
      if (this.hoverScan.progress >= 1) this.hoverScan = null;
    }

    if (this.config.cursorTrailEnabled) {
      this.trail.unshift({ x: input.pos.x, y: input.pos.y, life: 0.3 });
      this.trail = this.trail.filter(p => (p.life -= dtScaled) > 0).slice(0, 6);
    }

    if (speed > 900 / responsive && this.sparks.length < 6) {
      this.sparks.push({
        x: input.pos.x,
        y: input.pos.y,
        life: 0.25,
      });
    }
    this.sparks = this.sparks.filter(s => (s.life -= dtScaled) > 0);

    if (this.config.clickEffectsEnabled) {
      const click = input.click;
      if (click) {
        if (this.contextMenu) {
          this._handleMenuClick(click);
        } else {
          this._handleClick(click, hit, audioState);
        }
      }
      const dbl = input.doubleClick;
      if (dbl) {
        this._handleDoubleClick(dbl, hit);
      }
    }

    if (this.config.interactiveControlsEnabled && input.wheel) {
      this._handleWheel(input.wheel, hit);
    }

    this._updateBigEvents(dtScaled, now, audioState);
    this._updateEffects(dtScaled);
  }

  _handleClick(click, hit, audioState) {
    if (performance.now() < this.suppressClickUntil) return;
    if (click.button === 2) {
      this._openContextMenu(click.x, click.y);
      return;
    }
    if (click.shiftKey) {
      this.bus.emit('glitch:manual');
      this._triggerBigEvent('calibration', true);
      return;
    }
    if (!hit.isInside) return;
    const rect = this.blocks[hit.hoveredBlockId]?.rect;
    if (!rect) return;

    if (this.config.hiddenGesturesEnabled) {
      const now = performance.now();
      this.clickBurst.push(now);
      this.clickBurst = this.clickBurst.filter(t => now - t < 800);
      if (this.clickBurst.length >= 4) {
        this.bus.emit('diagnostic:flash', { blockId: hit.hoveredBlockId });
        this.clickBurst = [];
      }
    }

    this.pings.push({ rect, life: 0.6, dash: 0 });
    this.ripples.push({ x: click.x, y: click.y, r: 0, life: 0.6, rect });
    this.focusZoom.push({ rect, life: 0.25 });

    const symbols = this.config.symbolSet || DEFAULT_SYMBOL_SET;
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor(Math.random() * symbols.length);
      this.symbols.push({
        char: symbols[idx],
        x: click.x,
        y: click.y,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        life: 0.7,
      });
    }

    if (audioState?.peak && Math.random() < 0.15) {
      this._triggerBigEvent('audioResync');
    }
  }

  _handleDoubleClick(click, hit) {
    if (!hit.isInside) return;
    const id = hit.hoveredBlockId;
    this._toggleDetail(id, true);
  }

  _toggleDetail(id, emitEvent = false) {
    const panel = this.blockElements[id];
    if (!panel) return;
    const next = this.detailLevel[id] === 'compact' ? 'detailed' : 'compact';
    this.detailLevel[id] = next;
    panel.classList.toggle('compact', next === 'compact');
    if (emitEvent) this._triggerBigEvent('selfTest', true);
  }

  _handleWheel(delta, hit) {
    if (!hit.isInside) return;
    const id = hit.hoveredBlockId;
    if (id === 'calendar') {
      this.bus.emit('calendar:scroll', { delta });
    }
    if (id === 'waveform') {
      this.bus.emit('audio:sensitivity', { delta });
    }
  }

  _handleMenuClick(click) {
    const menu = this.contextMenu;
    if (!menu) return;
    const scale = this.config.textScale || 1;
    const x = click.x;
    const y = click.y;
    const w = 180 * scale;
    const row = 22 * scale;
    const h = menu.items.length * row + 16 * scale;
    const inside = x >= menu.x && x <= menu.x + w && y >= menu.y && y <= menu.y + h;
    if (!inside) {
      this.contextMenu = null;
      return;
    }
    const index = Math.floor((y - menu.y - 12 * scale) / (row - 4 * scale));
    const item = menu.items[index];
    if (item) {
      this.bus.emit('menu:select', item);
      this.contextMenu = null;
    }
  }

  _openContextMenu(x, y) {
    if (!this.config.interactiveControlsEnabled) return;
    const items = this.config.menuItems || DEFAULT_MENU_ITEMS;
    this.contextMenu = {
      x,
      y,
      items,
      life: 1.2,
    };
    this.bus.emit('menu:open', this.contextMenu);
  }

  _updateHoverHold(dt, hit) {
    if (!hit.isInside) {
      this.hoverHold = 0;
      this.hoverHoldTriggered = false;
      return;
    }
    if (this.hovered !== hit.hoveredBlockId) {
      this.hoverHold = 0;
      this.hoverHoldTriggered = false;
      return;
    }
    this.hoverHold += dt;
    if (this.hoverHold > 2.4 && !this.hoverHoldTriggered) {
      this.hoverHoldTriggered = true;
      this._toggleDetail(hit.hoveredBlockId);
      this.bus.emit('gesture:hidden', { blockId: hit.hoveredBlockId });
    }
  }

  _updateHold(dt, input, hit) {
    if (!input.isDown || !hit.isInside) {
      this.holdTime = 0;
      this.holdBlock = null;
      this.holdTriggered = false;
      return;
    }
    const id = hit.hoveredBlockId;
    if (this.holdBlock !== id) {
      this.holdBlock = id;
      this.holdTime = 0;
      this.holdTriggered = false;
    }
    this.holdTime += dt;
    if (this.holdTime > 0.55 && !this.holdTriggered) {
      this.holdTriggered = true;
      this.suppressClickUntil = performance.now() + 280;
      this._togglePin(id);
    }
  }

  _togglePin(id) {
    if (!id) return;
    if (this.pinned.has(id)) {
      this.pinned.delete(id);
    } else {
      this.pinned.add(id);
    }
    this.bus.emit('block:pin', { blockId: id, pinned: this.pinned.has(id) });
  }

  _trackCircularGesture(hit, input, now) {
    if (!hit.isInside) {
      this.motionSamples = [];
      this.motionBlock = null;
      return;
    }
    const rect = this.blocks[hit.hoveredBlockId]?.rect;
    if (!rect) return;
    if (this.motionBlock !== hit.hoveredBlockId) {
      this.motionBlock = hit.hoveredBlockId;
      this.motionSamples = [];
    }
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const dx = input.pos.x - cx;
    const dy = input.pos.y - cy;
    const radius = Math.hypot(dx, dy);
    const minRadius = Math.min(rect.w, rect.h) * 0.18;
    if (radius < minRadius) return;
    const angle = Math.atan2(dy, dx);
    this.motionSamples.push({ angle, t: now });
    this.motionSamples = this.motionSamples.filter(s => now - s.t < 1200);
    if (this.motionSamples.length < 8) return;
    let total = 0;
    for (let i = 1; i < this.motionSamples.length; i++) {
      let delta = this.motionSamples[i].angle - this.motionSamples[i - 1].angle;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      total += delta;
    }
    if (Math.abs(total) > Math.PI * 1.8) {
      this.motionSamples = [];
      this.hoverScan = { progress: 0 };
      this.bus.emit('gesture:circle', { blockId: hit.hoveredBlockId });
      this._triggerBigEvent('refreshSweep', true);
    }
  }

  _updateBigEvents(dt, now, audioState) {
    if (!this.bigEvents.length) {
      if (now >= this.nextBigEventAt) {
        this._triggerBigEvent();
        this._scheduleNextEvent(now);
      } else if (audioState?.peak && Math.random() < 0.08 && now - this.lastBigEventAt > 15000) {
        this._triggerBigEvent('audioResync');
        this._scheduleNextEvent(now);
      }
    }

    this.bigEvents.forEach(event => {
      event.life -= dt;
      event.progress = clamp(1 - event.life / event.ttl, 0, 1);
    });
    this.bigEvents = this.bigEvents.filter(event => event.life > 0);
  }

  _scheduleNextEvent(now) {
    this.nextBigEventAt = now + randRange(25000, 60000);
  }

  _triggerBigEvent(id, force = false) {
    if (this.bigEvents.length && !force) return;
    if (this.bigEvents.length && force) this.bigEvents = [];
    const def = id ? BIG_EVENTS.find(event => event.id === id) : BIG_EVENTS[Math.floor(Math.random() * BIG_EVENTS.length)];
    if (!def) return;
    const ttl = randRange(def.min, def.max);
    this.bigEvents.push({ id: def.id, ttl, life: ttl, progress: 0 });
    this.lastBigEventAt = performance.now();
    const label = this.config.eventLabels?.[def.id];
    if (label) this.bus.emit('message', { text: label, ttl: 1.0 });
  }

  _updateEffects(dt) {
    this.pings.forEach(p => {
      p.life -= dt;
      p.dash += dt * 120;
    });
    this.pings = this.pings.filter(p => p.life > 0);

    this.ripples.forEach(r => {
      r.life -= dt;
      r.r += dt * 120;
    });
    this.ripples = this.ripples.filter(r => r.life > 0);

    this.waveRipples.forEach(r => {
      r.life -= dt;
      r.r += dt * 90;
    });
    this.waveRipples = this.waveRipples.filter(r => r.life > 0);

    this.symbols.forEach(s => {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    });
    this.symbols = this.symbols.filter(s => s.life > 0);

    this.focusZoom.forEach(f => {
      f.life -= dt;
    });
    this.focusZoom = this.focusZoom.filter(f => f.life > 0);

    if (this.contextMenu) {
      this.contextMenu.life -= dt;
      if (this.contextMenu.life <= 0) this.contextMenu = null;
    }
  }

  render(ctx, hudCanvas) {
    if (!this.config.interactivityEnabled) return;
    if (this.hovered && this.config.hoverEffectsEnabled) {
      this._renderHover(ctx);
    }
    if (this.config.cursorTrailEnabled) this._renderTrail(ctx);
    if (this.config.clickEffectsEnabled) this._renderClicks(ctx, hudCanvas);
    this._renderWaveRipples(ctx);
    this._renderSparks(ctx);
    this._renderContextMenu(ctx);
    this._renderBigEvents(ctx);
  }

  _renderHover(ctx) {
    const rect = this.blocks[this.hovered]?.rect;
    if (!rect) return;
    const interest = this.hoverInterest || 0;
    const alpha = this.hoverAlpha * (0.75 + interest * 0.45);
    const scale = this.config.textScale || 1;
    ctx.save();
    ctx.strokeStyle = `rgba(141,252,79,${0.7 * alpha})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = `rgba(63,231,255,${0.5 * alpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = `rgba(63,231,255,${0.4 * alpha})`;
    ctx.lineWidth = 2;
    const tick = 12;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + tick);
    ctx.lineTo(rect.x, rect.y);
    ctx.lineTo(rect.x + tick, rect.y);
    ctx.moveTo(rect.x + rect.w - tick, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y + tick);
    ctx.moveTo(rect.x + rect.w, rect.y + rect.h - tick);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w - tick, rect.y + rect.h);
    ctx.moveTo(rect.x + tick, rect.y + rect.h);
    ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.lineTo(rect.x, rect.y + rect.h - tick);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = `rgba(63,231,255,${0.2 * alpha})`;
    ctx.lineWidth = 1;
    for (let x = rect.x + 10; x < rect.x + rect.w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, rect.y + 10);
      ctx.lineTo(x, rect.y + rect.h - 10);
      ctx.stroke();
    }
    ctx.restore();

    if (this.edgeProximity > 0.6) {
      ctx.save();
      ctx.strokeStyle = `rgba(214,255,97,${this.edgeProximity * 0.6})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
      ctx.restore();
    }

    if (this.hoverScan) {
      const y = rect.y + rect.h * this.hoverScan.progress;
      ctx.save();
      ctx.strokeStyle = 'rgba(63,231,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.w, y);
      ctx.stroke();
      ctx.restore();
    }

    if (this.config.tooltipsEnabled) {
      ctx.save();
      ctx.fillStyle = 'rgba(63,231,255,0.6)';
      ctx.font = `${Math.round(12 * scale)}px Orbitron, sans-serif`;
      ctx.fillText(this.config.tooltipText || DEFAULT_TOOLTIP, rect.x + 12, rect.y + 16);
      ctx.restore();
    }

    if (this.pinned.has(this.hovered)) {
      ctx.save();
      ctx.fillStyle = 'rgba(141,252,79,0.8)';
      ctx.font = `700 ${Math.round(12 * scale)}px Orbitron, sans-serif`;
      ctx.fillText(this.config.pinLabel || DEFAULT_PIN_LABEL, rect.x + rect.w - 36, rect.y + 16);
      ctx.restore();
    }
  }

  _renderTrail(ctx) {
    if (!this.trail.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(63,231,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.trail.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  _renderClicks(ctx, hudCanvas) {
    this.pings.forEach(p => {
      ctx.save();
      const intensity = p.intensity ?? 1;
      ctx.strokeStyle = `rgba(141,252,79,${0.5 + 0.3 * intensity})`;
      ctx.lineWidth = 2 + intensity * 2;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -p.dash;
      ctx.strokeRect(p.rect.x, p.rect.y, p.rect.w, p.rect.h);
      ctx.restore();
    });

    this.ripples.forEach(r => {
      ctx.save();
      ctx.strokeStyle = 'rgba(63,231,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y - r.r);
      ctx.lineTo(r.x + r.r, r.y);
      ctx.lineTo(r.x, r.y + r.r);
      ctx.lineTo(r.x - r.r, r.y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });

    const scale = this.config.textScale || 1;
    this.symbols.forEach(s => {
      ctx.save();
      ctx.fillStyle = `rgba(141,252,79,${Math.max(0, s.life / 0.7)})`;
      ctx.font = `${Math.round(14 * scale)}px Orbitron, sans-serif`;
      ctx.fillText(s.char, s.x, s.y);
      ctx.restore();
    });

    this.focusZoom.forEach(f => {
      const scale = 1 + Math.sin((f.life / 0.25) * Math.PI) * 0.02;
      const rect = f.rect;
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.scale(scale, scale);
      ctx.drawImage(hudCanvas, rect.x, rect.y, rect.w, rect.h, -rect.w / 2, -rect.h / 2, rect.w, rect.h);
      ctx.restore();
    });
  }

  _renderWaveRipples(ctx) {
    if (!this.waveRipples.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(63,231,255,0.4)';
    ctx.lineWidth = 1;
    this.waveRipples.forEach(r => {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  _renderSparks(ctx) {
    this.sparks.forEach(s => {
      ctx.save();
      ctx.strokeStyle = `rgba(63,231,255,${s.life / 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - 4, s.y);
      ctx.lineTo(s.x + 4, s.y);
      ctx.moveTo(s.x, s.y - 4);
      ctx.lineTo(s.x, s.y + 4);
      ctx.stroke();
      ctx.restore();
    });
  }

  _renderContextMenu(ctx) {
    if (!this.contextMenu) return;
    const menu = this.contextMenu;
    const scale = this.config.textScale || 1;
    ctx.save();
    ctx.fillStyle = 'rgba(4,7,10,0.85)';
    ctx.strokeStyle = 'rgba(63,231,255,0.6)';
    ctx.lineWidth = 2;
    const w = 180 * scale;
    const row = 22 * scale;
    const h = menu.items.length * row + 16 * scale;
    ctx.fillRect(menu.x, menu.y, w, h);
    ctx.strokeRect(menu.x, menu.y, w, h);
    ctx.fillStyle = 'rgba(141,252,79,0.8)';
    ctx.font = `${Math.round(12 * scale)}px Orbitron, sans-serif`;
    menu.items.forEach((item, idx) => {
      ctx.fillText(item.label, menu.x + 10 * scale, menu.y + 20 * scale + idx * (row - 4 * scale));
    });
    ctx.restore();
  }

  _renderBigEvents(ctx) {
    if (!this.bigEvents.length) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.bigEvents.forEach(event => {
      switch (event.id) {
        case 'calibration':
          this._renderCalibration(ctx, width, height, event.progress);
          break;
        case 'dataRealign':
          this._renderDataRealign(ctx, event.progress);
          break;
        case 'linkResync':
          this._renderLinkResync(ctx, width, height, event.progress);
          break;
        case 'audioResync':
          this._renderAudioResync(ctx, event.progress);
          break;
        case 'selfTest':
          this._renderSelfTest(ctx, event.progress);
          break;
        case 'refreshSweep':
          this._renderRefreshSweep(ctx, width, height, event.progress);
          break;
        default:
          break;
      }
    });
  }

  _renderCalibration(ctx, width, height, progress) {
    const alpha = Math.sin(progress * Math.PI);
    ctx.save();
    ctx.globalAlpha = 0.45 * alpha;
    ctx.strokeStyle = 'rgba(63,231,255,0.6)';
    ctx.lineWidth = 1;
    const stepX = width / 10;
    const stepY = height / 8;
    for (let x = 0; x <= width; x += stepX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += stepY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.7 * alpha;
    ctx.strokeStyle = 'rgba(141,252,79,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.restore();
  }

  _renderDataRealign(ctx, progress) {
    const offset = Math.sin(progress * Math.PI) * 10;
    const rects = Object.values(this.blocks)
      .map(b => b?.rect)
      .filter(Boolean);
    if (!rects.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(63,231,255,0.6)';
    ctx.lineWidth = 2;
    rects.forEach((rect, idx) => {
      const dir = idx % 4;
      const dx = dir === 0 ? offset : dir === 1 ? -offset : 0;
      const dy = dir === 2 ? offset : dir === 3 ? -offset : 0;
      ctx.strokeRect(rect.x + dx, rect.y + dy, rect.w, rect.h);
    });
    ctx.restore();
  }

  _renderLinkResync(ctx, width, height, progress) {
    const w = 280;
    const h = 120;
    const x = width / 2 - w / 2;
    const y = height / 2 - h / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(4,7,10,0.8)';
    ctx.strokeStyle = 'rgba(63,231,255,0.7)';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(141,252,79,0.8)';
    ctx.font = `700 ${Math.round(16 * (this.config.textScale || 1))}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = this.config.eventLabels?.linkResync || 'LINK RESYNC';
    ctx.fillText(label, x + w / 2, y + 36);
    ctx.fillStyle = 'rgba(63,231,255,0.6)';
    ctx.fillRect(x + 24, y + h - 30, (w - 48) * progress, 6);
    ctx.restore();
  }

  _renderAudioResync(ctx, progress) {
    const rect = this.blocks.waveform?.rect;
    if (!rect) return;
    const alpha = Math.sin(progress * Math.PI);
    const mid = rect.y + rect.h / 2;
    const amp = rect.h * 0.4 * alpha;
    ctx.save();
    ctx.strokeStyle = `rgba(63,231,255,${0.6 * alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x, mid);
    ctx.lineTo(rect.x + rect.w, mid);
    ctx.stroke();
    ctx.strokeStyle = `rgba(141,252,79,${0.7 * alpha})`;
    ctx.beginPath();
    ctx.moveTo(rect.x, mid - amp);
    ctx.lineTo(rect.x + rect.w, mid + amp);
    ctx.stroke();
    ctx.restore();
  }

  _renderSelfTest(ctx, progress) {
    const entries = Object.entries(this.blocks).filter(([, b]) => b?.rect);
    if (!entries.length) return;
    const idx = Math.floor(progress * entries.length);
    ctx.save();
    entries.forEach(([key, block], i) => {
      if (i > idx) return;
      const alpha = i === idx ? 0.8 : 0.4;
      ctx.strokeStyle = `rgba(141,252,79,${alpha})`;
      ctx.lineWidth = i === idx ? 3 : 1.5;
      ctx.strokeRect(block.rect.x, block.rect.y, block.rect.w, block.rect.h);
    });
    ctx.restore();
  }

  _renderRefreshSweep(ctx, width, height, progress) {
    const x = width * progress;
    ctx.save();
    ctx.fillStyle = 'rgba(63,231,255,0.08)';
    ctx.fillRect(x - 30, 0, 60, height);
    ctx.strokeStyle = 'rgba(141,252,79,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.restore();
  }

  getParallax() {
    return this.parallax;
  }
}
