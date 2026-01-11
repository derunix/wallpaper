export class DiagnosticsMode {
  constructor(bus, overlayEl) {
    this.bus = bus;
    this.overlayEl = overlayEl;
    this.enabled = false;
    this.lastToggleAt = 0;
    this.mode = { showInput: false, showGlitch: false, showMood: false, showTextAI: false, showPerf: false };
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled && this.overlayEl) this.overlayEl.hidden = true;
  }

  setMode(mode = {}) {
    Object.assign(this.mode, mode);
  }

  toggle() {
    this.setEnabled(!this.enabled);
  }

  update(info = {}) {
    if (!this.enabled || !this.overlayEl) return;
    const lines = [];
    if (this.mode.showInput) {
      lines.push(`HOVER: ${info.hoveredBlock || '--'}`);
      lines.push(`MOUSE SPD: ${info.mouseSpeed?.toFixed(1) || 0}`);
    }
    if (this.mode.showGlitch) {
      lines.push(`GLITCH: ${info.activeGlitches?.join(',') || '--'}`);
      lines.push(`NEXT: ${info.nextGlitch?.toFixed(1) || '--'}s`);
      lines.push(`AUDIO: ${info.audio?.energy?.toFixed(2) || 0} PEAK:${info.audio?.peak ? '1' : '0'}`);
    }
    if (this.mode.showMood) {
      const mood = info.mood || {};
      const features = mood.features || {};
      lines.push(`MOOD: ${mood.moodClass || '--'} ${(mood.confidence ?? 0).toFixed(2)}`);
      lines.push(
        `ENERGY: ${(features.energy ?? 0).toFixed(2)} CHAOS: ${(features.chaos ?? 0).toFixed(2)} TRANS: ${(
          features.transient ?? 0
        ).toFixed(2)}`
      );
    }
    if (this.mode.showTextAI) {
      const textAI = info.textAI || {};
      const since = textAI.lastEmittedAt ? (performance.now() - textAI.lastEmittedAt) / 1000 : 0;
      lines.push(`TEXT: ${textAI.mode || '--'} ${textAI.lastIntent || '--'}`);
      if (textAI.lastText) {
        const clean = String(textAI.lastText).replace(/\s+/g, ' ').trim();
        lines.push(`TEXT_LAST: ${clean.slice(0, 64)}`);
      }
      if (since) lines.push(`TEXT_AGE: ${since.toFixed(1)}s`);
    }
    if (this.mode.showPerf) {
      const perf = info.profiler || {};
      const sections = perf.sections || {};
      if (perf.frameAvg !== undefined) {
        lines.push(
          `FRAME AVG/P95/W: ${perf.frameAvg.toFixed(1)} ${perf.frameP95.toFixed(1)} ${perf.frameWorst.toFixed(1)}ms`
        );
      }
      if (sections.update) {
        lines.push(
          `CPU ms: upd ${sections.update.avg.toFixed(1)} hud ${sections.renderHUD.avg.toFixed(1)} fx ${sections.renderFX.avg.toFixed(1)}`
        );
        lines.push(
          `AI/W/P: text ${sections.textGen.avg.toFixed(1)} w ${sections.weather.avg.toFixed(1)} p ${sections.perf.avg.toFixed(1)}`
        );
      }
      const counters = perf.counters || {};
      if (counters.activeEffects !== undefined) {
        lines.push(
          `COUNTS: fx ${counters.activeEffects || 0} timers ${counters.activeTimers || 0} fetch ${counters.activeFetches || 0} log ${counters.logSize || 0}`
        );
      }
      const alloc = info.allocations || {};
      if (alloc.textCandidates !== undefined) {
        lines.push(
          `ALLOC: text ${alloc.textCandidates || 0} glitch ${alloc.glitchSpawns || 0} ctx ${alloc.glitchContext || 0}`
        );
      }
    }
    if (this.mode.showInput || this.mode.showGlitch || this.mode.showMood || this.mode.showTextAI) {
      if (info.frameCount !== undefined) {
        lines.push(`FRAME: ${info.frameCount}`);
      }
      lines.push(`FPS: ${info.fps || 0}`);
      const watchdog = info.watchdog || {};
      if (watchdog.lastFrameMs !== undefined) {
        lines.push(`DT: ${watchdog.lastFrameMs.toFixed(1)}ms`);
      }
      if (watchdog.status) {
        const since = watchdog.sinceOk !== undefined ? ` ${watchdog.sinceOk.toFixed(1)}s` : '';
        lines.push(`WATCHDOG: ${watchdog.status}${since}`);
      }
      if (watchdog.softResets !== undefined) {
        lines.push(`RESETS: ${watchdog.softResets}`);
      }
      if (watchdog.lastResetReason) {
        lines.push(`RESET_LAST: ${watchdog.lastResetReason}`);
      }
    }
    if (!lines.length) {
      this.overlayEl.hidden = true;
      return;
    }
    this.overlayEl.textContent = lines.join('\n');
    this.overlayEl.hidden = false;
  }

  render(ctx, blocks, hoveredBlock) {
    if (!this.enabled || !hoveredBlock || !blocks[hoveredBlock]) return;
    const rect = blocks[hoveredBlock].rect;
    if (!rect) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(63,231,255,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}
