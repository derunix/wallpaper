import { Scheduler } from './scheduler.js';
import { GlitchManager } from '../glitch/glitch_manager.js';
import { normalizeText } from '../text/semantic_engine.js';

/**
 * Run minimal self-checks and log results.
 */
export async function runSelfChecks(options = {}) {
  const logger = options.logger || console;
  const results = [];
  results.push(checkNormalizeText());
  results.push(await checkSchedulerBackoff());
  results.push(checkGlitchSpawnPolicy());
  if (options.semanticEngine) {
    results.push(checkTextModeHysteresis(options.semanticEngine));
  }
  const failed = results.filter(item => !item.ok && !item.skip);
  if (failed.length) {
    logger.warn('[self-check] failures:', failed.map(item => item.name));
  } else {
    logger.log('[self-check] ok');
  }
  return results;
}

function checkNormalizeText() {
  const name = 'normalizeText';
  const output = normalizeText('  hello   world . ');
  const ok = output === 'Hello world.';
  return { name, ok };
}

async function checkSchedulerBackoff() {
  const name = 'schedulerBackoff';
  let now = 0;
  const scheduler = new Scheduler({ now: () => now });
  scheduler.addTask('test', {
    intervalMs: 500,
    handler: () => Promise.reject(new Error('fail')),
  });
  now = 1000;
  scheduler.update(now);
  await Promise.resolve();
  const state = scheduler.getTaskState('test');
  const ok = !!state && state.failures >= 1 && state.nextAt > now + 500;
  return { name, ok };
}

function checkGlitchSpawnPolicy() {
  const name = 'glitchSpawnPolicy';
  const blocks = {
    a: { rect: { x: 0, y: 0, w: 100, h: 100 }, importance: 1 },
    b: { rect: { x: 200, y: 0, w: 100, h: 100 }, importance: 1 },
  };
  const manager = new GlitchManager(
    { maxSimultaneousGlitches: 1, maxSimultaneousLocal: 1, localGlitchesEnabled: true },
    blocks
  );
  manager.setBlocks(blocks, {}, []);
  const now = performance.now();
  let spawned = false;
  for (let i = 0; i < 3; i++) {
    spawned = manager._triggerLocalEffects(now + i * 5, {}, { manual: true }) || spawned;
  }
  const ok = !spawned || manager.active.length <= 1;
  return { name, ok, skip: !spawned };
}

function checkTextModeHysteresis(engine) {
  const name = 'textModeHysteresis';
  if (!engine || !engine.modeState || !engine._computeMode) return { name, ok: true, skip: true };
  const now = performance.now();
  const prev = { ...engine.modeState };
  engine.modeState.mode = 'SMART';
  engine.modeState.holdUntil = now + 5000;
  const context = {
    systemState: 'OVERLOAD',
    entropyLevel: 0.9,
    audioState: { energy: 0.9, transient: 0.9, peak: true },
    glitchState: { activeCount: 3, glitchIntensity: 1.6, bigEventActive: true },
    performanceState: { fpsEstimate: 12, lastFrameDeltaMs: 120 },
    metrics: { cpu: 95, gpu: 95, mem: 96 },
  };
  const mode = engine._computeMode(context, now, 0.016);
  Object.assign(engine.modeState, prev);
  const ok = mode === 'SMART';
  return { name, ok };
}
