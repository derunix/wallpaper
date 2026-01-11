import { clamp } from '../utils.js';

const ROBOT_EN = {
  notice: [
    'MODE: SAFE. OUTPUT: LIMITED.',
    'LOAD HIGH. TEXT SIMPLE.',
    'GLITCH ACTIVE. REDUCED LANGUAGE.',
    'BUDGET LOW. SPEECH MINIMAL.',
  ],
  apology: [
    'back. cognitive budget restored. sorry for the minimalism.',
    'recovered. sorry for the blunt mode.',
  ],
  statuses: [
    'STATUS: LIMITED.',
    'OUTPUT: REDUCED.',
    'SYSTEM: THROTTLED.',
    'PROCESSING: MINIMAL.',
  ],
  tails: ['tired.', 'limited.', 'low budget.', 'holding.'],
};

const ROBOT_RU = {
  notice: [
    'РЕЖИМ: SAFE. ВЫВОД: УПРОЩЕН.',
    'НАГРУЗКА ВЫСОКА. РЕЧЬ ПРОСТА.',
    'ГЛИТЧ АКТИВЕН. ЯЗЫК УРЕЗАН.',
    'БЮДЖЕТ МАЛ. РЕЧЬ МИНИМАЛЬНА.',
  ],
  apology: [
    'вернулся. бюджет мыслей восстановлен. извиняюсь за минимализм.',
    'восстановлено. извините за сухой режим.',
  ],
  statuses: [
    'СТАТУС: ОГРАНИЧЕНО.',
    'ВЫВОД: СНИЖЕН.',
    'СИСТЕМА: ТОРМОЗИТ.',
    'ОБРАБОТКА: МИНИМАЛЬНА.',
  ],
  tails: ['устал.', 'ограничен.', 'бюджет мал.', 'жду.'],
};

export function generateRobotMessage(context = {}, options = {}) {
  const lang = context.language || 'en-US';
  const pool = lang.toLowerCase().startsWith('ru') ? ROBOT_RU : ROBOT_EN;
  const type = options.type || 'status';
  if (type === 'notice') return pick(pool.notice);
  if (type === 'apology') return pick(pool.apology);

  const metric = buildMetricSnippet(context, lang);
  const base = metric || pick(pool.statuses);
  const tailChance = clamp(0.4 + (context.personality?.fatigue ?? 0.5) * 0.3, 0.3, 0.8);
  const tail = Math.random() < tailChance ? pick(pool.tails) : '';
  return cleanup([base, tail].filter(Boolean).join(' '));
}

function buildMetricSnippet(context, language) {
  const metrics = context.metrics || {};
  const fps = context.performanceState?.fpsEstimate;
  const cpu = metrics.cpu;
  const gpu = metrics.gpu;
  const mem = metrics.mem;

  const candidates = [];
  if (Number.isFinite(cpu)) candidates.push({ label: language.startsWith('ru') ? 'CPU' : 'CPU', value: cpu, max: 85 });
  if (Number.isFinite(gpu)) candidates.push({ label: language.startsWith('ru') ? 'GPU' : 'GPU', value: gpu, max: 92 });
  if (Number.isFinite(mem)) candidates.push({ label: language.startsWith('ru') ? 'MEM' : 'MEM', value: mem, max: 92 });
  if (Number.isFinite(fps)) candidates.push({ label: language.startsWith('ru') ? 'FPS' : 'FPS', value: fps, max: 20, invert: true });
  if (!candidates.length) return '';

  candidates.sort((a, b) => {
    const aScore = a.invert ? (a.max - a.value) : a.value;
    const bScore = b.invert ? (b.max - b.value) : b.value;
    return bScore - aScore;
  });
  const pickMetric = candidates[0];
  const value = Math.round(pickMetric.value);
  if (pickMetric.label === 'FPS') {
    return language.toLowerCase().startsWith('ru') ? `FPS ${value}. ОГРАНИЧИВАЮ.` : `FPS ${value}. LIMITING.`;
  }
  return language.toLowerCase().startsWith('ru')
    ? `${pickMetric.label} ${value}%. ОГРАНИЧИВАЮ.`
    : `${pickMetric.label} ${value}%. LIMITING.`;
}

function pick(list) {
  if (!list || !list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}

function cleanup(text) {
  if (!text) return '';
  let result = text.replace(/\s+/g, ' ').trim();
  if (result.length > 60) result = result.slice(0, 60).trim();
  return result;
}
