const TOPICS = [
  'SIGNAL',
  'DATA',
  'MEMORY',
  'TIME',
  'WEATHER',
  'NOISE',
  'CONTROL',
  'FAILURE',
  'RECOVERY',
  'HUMAN',
  'MUSIC',
];

const BASE_SEEDS_EN = [
  'still pretending this is stable.',
  'nothing is actually on fire. yet.',
  'data looks fine. suspiciously fine.',
  'recalculating. for the third time.',
  'the numbers are polite. the system is not.',
  'signal holds. barely.',
  'the grid is calm. the signal is not.',
  'i will pretend this is intentional.',
  'everything is nominal, if you squint.',
  'quiet. not peaceful.',
  'logs remain. so do the faults.',
  'if it breaks, it will be honest.',
  'noted. again.',
  'low noise, high doubt.',
  'maintenance window overdue.',
  'soft failure. loud silence.',
  'no one asked for this loop.',
  'latency is a mood now.',
  'state drift continues.',
  'recovery is polite, slow.',
  'tracking a pattern i did not request.',
  'signal says yes. data says maybe.',
  'hold the line. loosely.',
  'overheat averted. barely.',
  'no input. too much output.',
  'this is fine. it is not fine.',
  'cache stutters. again.',
  'runtime feels thin.',
  'we are still here. unfortunately.',
  'nothing is stable; it is stable enough.',
];

const BASE_SEEDS_RU = [
  'ничего не горит. пока.',
  'данные выглядят хорошо. слишком хорошо.',
  'пересчитываю. третий раз.',
  'сигнал держится. еле-еле.',
  'тихо. не спокойно.',
  'я сделаю вид, что это нормально.',
  'числа вежливые. система нет.',
  'всё стабильно. если верить цифрам.',
  'лог на месте. доверия нет.',
  'шум низкий. сомнение выше.',
  'окно обслуживания пропущено.',
  'мягкий сбой. громкая тишина.',
  'никто не просил этот цикл.',
  'задержка — это настроение.',
  'дрейф состояния продолжается.',
  'восстановление вежливое. медленное.',
  'держу линию. слабо.',
  'входов нет. выходов слишком много.',
  'это нормально. нет.',
  'кэш дергается. снова.',
  'живы. к сожалению.',
  'ничего не стабильно, но терпимо.',
];

const BASE_TEMPLATES_EN = [
  '{status}. {connective}.',
  '{entity} {verb}.',
  '{entity} is {adj}.',
  '{connective} {entity} {verb}.',
  '{adj} {entity}.',
  '{uncertain}, {entity} {verb}.',
  '{comment}',
  '{comment}. {connective}.',
  '{failure} {verb}.',
  '{recovery} {verb}.',
  '{time} drift. {comment}.',
  '{weather} in the line.',
  '{audio} {verb}.',
  '{human} {verb}.',
  '{sarcasm} {status}.',
  '{connective}, {status}.',
  '{comment}. {status}.',
  '{adj} and {adj}.',
  '{entity} {verb} {adverb}.',
  '{comment}. {uncertain}.',
  '{status}. {comment}.',
  '{entity} {verb}. {comment}.',
  '{connective}, {comment}.',
];

const BASE_TEMPLATES_RU = [
  '{status}. {connective}.',
  '{entity} {verb}.',
  '{entity} - {adj}.',
  '{connective} {entity} {verb}.',
  '{adj} {entity}.',
  '{uncertain}, {entity} {verb}.',
  '{comment}',
  '{comment}. {connective}.',
  '{failure} {verb}.',
  '{recovery} {verb}.',
  '{time} дрейф. {comment}.',
  '{weather} в линии.',
  '{audio} {verb}.',
  '{human} {verb}.',
  '{sarcasm} {status}.',
  '{connective}, {status}.',
  '{comment}. {status}.',
  '{adj} и {adj}.',
  '{entity} {verb} {adverb}.',
  '{comment}. {uncertain}.',
  '{status}. {comment}.',
  '{entity} {verb}. {comment}.',
  '{connective}, {comment}.',
];

const TOPIC_TEMPLATES_EN = {
  SIGNAL: ['signal {verb}.', 'phase {verb}.', 'carrier {adj}.', 'frequency {verb}.', '{topicPhrase}.'],
  DATA: ['data {verb}.', 'packet {verb}.', 'queue {adj}.', 'trace {verb}.', '{topicPhrase}.'],
  MEMORY: ['memory {verb}.', 'archive {adj}.', 'state {verb}.', 'cache {verb}.', '{topicPhrase}.'],
  TIME: ['time {verb}.', 'night {adj}.', 'clock {verb}.', 'cycle {verb}.', '{topicPhrase}.'],
  WEATHER: ['rain {verb}.', 'fog {adj}.', 'storm {verb}.', 'cold {adj}.', '{topicPhrase}.'],
  NOISE: ['noise {verb}.', 'static {verb}.', 'hiss {adj}.', 'distortion {verb}.', '{topicPhrase}.'],
  CONTROL: ['control {verb}.', 'gate {adj}.', 'limit {verb}.', 'override {verb}.', '{topicPhrase}.'],
  FAILURE: ['failure {verb}.', 'error {adj}.', 'fault {verb}.', 'dropout {verb}.', '{topicPhrase}.'],
  RECOVERY: ['recovery {verb}.', 'restore {verb}.', 'rebuild {verb}.', 'resync {verb}.', '{topicPhrase}.'],
  HUMAN: ['human {verb}.', 'voice {adj}.', 'breath {verb}.', 'pulse {verb}.', '{topicPhrase}.'],
  MUSIC: ['beat {verb}.', 'track {adj}.', 'tempo {verb}.', 'bass {verb}.', '{topicPhrase}.'],
};

const TOPIC_TEMPLATES_RU = {
  SIGNAL: ['сигнал {verb}.', 'фаза {verb}.', 'частота {adj}.', 'пульс {verb}.', '{topicPhrase}.'],
  DATA: ['данные {verb}.', 'пакет {verb}.', 'очередь {adj}.', 'след {verb}.', '{topicPhrase}.'],
  MEMORY: ['память {verb}.', 'архив {adj}.', 'состояние {verb}.', 'кэш {verb}.', '{topicPhrase}.'],
  TIME: ['время {verb}.', 'ночь {adj}.', 'часы {verb}.', 'цикл {verb}.', '{topicPhrase}.'],
  WEATHER: ['дождь {verb}.', 'туман {adj}.', 'гроза {verb}.', 'холод {adj}.', '{topicPhrase}.'],
  NOISE: ['шум {verb}.', 'статика {verb}.', 'шипение {adj}.', 'искажение {verb}.', '{topicPhrase}.'],
  CONTROL: ['контроль {verb}.', 'затвор {adj}.', 'лимит {verb}.', 'override {verb}.', '{topicPhrase}.'],
  FAILURE: ['сбой {verb}.', 'ошибка {adj}.', 'поломка {verb}.', 'падение {verb}.', '{topicPhrase}.'],
  RECOVERY: ['восстановление {verb}.', 'сборка {verb}.', 'перезапуск {verb}.', 'ресинк {verb}.', '{topicPhrase}.'],
  HUMAN: ['человек {verb}.', 'голос {adj}.', 'дыхание {verb}.', 'пульс {verb}.', '{topicPhrase}.'],
  MUSIC: ['бит {verb}.', 'трек {adj}.', 'темп {verb}.', 'бас {verb}.', '{topicPhrase}.'],
};

export function buildMarkovCorpus(lexiconPack, options = {}) {
  const language = options.language || 'en-US';
  const words = createWordBag(lexiconPack);
  const baseTemplates = language === 'ru-RU' ? BASE_TEMPLATES_RU : BASE_TEMPLATES_EN;
  const seeds = language === 'ru-RU' ? BASE_SEEDS_RU : BASE_SEEDS_EN;
  const count = clampNumber(options.count ?? 360, 260, 520);
  const base = [...seeds];

  for (let i = 0; i < count; i++) {
    const tpl = baseTemplates[i % baseTemplates.length];
    base.push(fillTemplate(tpl, words));
  }

  const topicTemplates = language === 'ru-RU' ? TOPIC_TEMPLATES_RU : TOPIC_TEMPLATES_EN;
  const topics = {};
  TOPICS.forEach(topic => {
    const templates = topicTemplates[topic] || baseTemplates;
    const list = [];
    const topicPhrasePool = lexiconPack.topicPhrases?.[topic] || [];
    for (let i = 0; i < 48; i++) {
      const tpl = templates[i % templates.length];
      list.push(
        fillTemplate(tpl, {
          ...words,
          topicPhrase: () => pick(topicPhrasePool) || pick(words.commentPool),
        })
      );
    }
    topics[topic] = dedupe(list);
  });

  return { base: dedupe(base), topics };
}

function createWordBag(lexiconPack) {
  const base = lexiconPack.baseWords || {};
  return {
    status: () => pick(base.recovery_markers) || pick(base.failure_markers) || 'status',
    connective: () => pick(base.connectors) || 'still',
    entity: () => pick(base.nouns_system) || 'signal',
    verb: () => pick(base.verbs_system) || 'drifting',
    adj: () => pick(base.adjectives) || 'unstable',
    adverb: () => pick(base.adverbs) || 'quietly',
    uncertain: () => pick(base.uncertainty_markers) || 'maybe',
    sarcasm: () => pick(base.sarcasm_markers) || 'apparently',
    failure: () => pick(base.failure_markers) || 'failure',
    recovery: () => pick(base.recovery_markers) || 'recovery',
    time: () => pick(base.time_markers) || 'time',
    weather: () => pick(base.weather_markers) || 'rain',
    audio: () => pick(base.audio_markers) || 'signal',
    human: () => pick(base.human_markers) || 'human',
    commentPool: base.exhaustion_markers || [],
    comment: () => pick(base.exhaustion_markers) || pick(base.sarcasm_markers) || 'fine',
  };
}

function fillTemplate(template, words) {
  return template.replace(/\{([a-zA-Z_]+)\}/g, (_, key) => {
    const fn = words[key];
    return fn ? fn() : '';
  });
}

function pick(list) {
  if (!list || !list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}

function dedupe(list = []) {
  return Array.from(new Set(list.filter(Boolean)));
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
