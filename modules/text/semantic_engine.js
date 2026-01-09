import { clamp, lerp } from '../utils.js';
import { loadState, saveState } from '../utils/persistence.js';
import { DEFAULT_SYMBOL_SET } from '../glitch/text_scramble.js';

const STORAGE_KEY = 'semantic_memory_v1';
const MIN_WORDS = 3;
const MAX_WORDS = 12;
const MIN_CHARS = 20;
const MAX_CHARS = 120;

const ALIEN_SYMBOLS = DEFAULT_SYMBOL_SET;

const EN_PACK = {
  systemNouns: [
    'signal', 'data', 'memory', 'process', 'cache', 'link', 'node', 'buffer', 'thread', 'bus', 'core', 'module',
    'pipeline', 'channel', 'lattice', 'register', 'kernel', 'daemon', 'interface', 'sensor', 'matrix', 'grid',
    'oscillator', 'clock', 'rail', 'port', 'sector', 'packet', 'handshake', 'vector', 'gateway', 'flux', 'queue',
    'scheduler', 'interrupt', 'topology', 'circuit', 'network', 'log', 'trace', 'routine', 'instruction', 'stack',
    'heap', 'pointer', 'address', 'allocator', 'driver', 'microcode', 'array', 'frame', 'session', 'profile',
    'protocol', 'decoder', 'encoder', 'stream', 'fiber', 'junction', 'relay', 'transceiver', 'cluster', 'loop',
    'phase', 'state', 'context', 'ledger', 'cacheline', 'slot', 'tunnel', 'bridge', 'mesh', 'ring', 'controller',
    'supply', 'index', 'checksum', 'sampler', 'fallback', 'fuse', 'payload', 'shard', 'viewport', 'schema',
    'carrier', 'sequence', 'band', 'hash', 'busline', 'panel', 'overlay', 'gate', 'aperture', 'coupler',
    'backplane', 'coolant', 'thermal', 'monitor', 'probe', 'sensorium', 'railway', 'throttle', 'daemonset',
    'watchdog', 'handshake', 'latency', 'jitter', 'bias', 'drift', 'resonator', 'splice', 'compression',
    'decompiler', 'arbiter', 'arbiter', 'watcher', 'pacer', 'limiter',
  ],
  verbs: [
    'drifting', 'choking', 'retrying', 'pretending', 'recalculating', 'stalling', 'buffering', 'throttling',
    'bleeding', 'resetting', 'stuttering', 'misreporting', 'saturating', 'misaligning', 'skipping', 'looping',
    'fading', 'replaying', 'scraping', 'crawling', 'coasting', 'smoothing', 'smearing', 'overheating',
    'limiting', 'failing', 'restarting', 'sidelining', 'dropping', 'spiking', 'flattening', 'compressing',
    'expanding', 'renormalizing', 'patching', 'rekeying', 'ignoring', 'queueing', 'fragmenting', 'corrupting',
    'blinking', 'detuning', 'unraveling', 'resyncing', 'reframing', 'suspending', 'bootstrapping', 'rerouting',
    'timing', 'tremoring', 'stitching', 'evaporating', 'freezing', 'holding', 'venting', 'sampling', 'hashing',
    'diagnosing', 'idling', 'rattling', 'compromising', 'replaying', 'leaking', 'ghosting', 'stalling',
  ],
  adjectives: [
    'unstable', 'tired', 'partial', 'noisy', 'obsolete', 'fragmented', 'nominal', 'overheated', 'brittle',
    'sluggish', 'misaligned', 'stale', 'hollow', 'blurred', 'delayed', 'intermittent', 'muted', 'overclocked',
    'underfed', 'saturated', 'skewed', 'drifty', 'offset', 'faulty', 'nervous', 'suspect', 'questionable',
    'spiky', 'flat', 'degraded', 'limping', 'compressed', 'volatile', 'dense', 'hazy', 'reduced', 'erratic',
    'detuned', 'silent', 'overdue', 'bent', 'thinned', 'shadowed', 'lopsided', 'thin', 'strained', 'tarnished',
    'delicate', 'fraying', 'bored', 'sticky', 'vague', 'threadbare', 'understated', 'overspecified', 'leaky',
  ],
  sarcasmMarkers: [
    'apparently', 'again', 'as expected', 'of course', 'sure', 'naturally', 'fine', 'great', 'wonderful',
    'just perfect', 'how novel', 'if you say so', 'clearly', 'obviously', 'what a surprise', 'predictably',
  ],
  connectives: [
    'still', 'anyway', 'meanwhile', 'somehow', 'for now', 'in theory', 'in practice', 'at least', 'probably',
    'for once', 'so it goes', 'if it holds', 'as if', 'for the record', 'on paper', 'for a moment',
    'against better judgment', 'without drama', 'with reluctance', 'in the meantime', 'in passing',
  ],
  brokenTokens: ['///', '...', '--', '??', '##', '!!', '::', '==', '~~'],
  prefixes: ['meta-', 'sub-', 'ultra-', 'pseudo-', 'nano-', 'micro-', 'hyper-', 'inter-', 'intra-', 'proto-'],
  suffixes: ['-core', '-node', '-mesh', '-loop', '-gate', '-layer', '-grid', '-array', '-vector', '-stack'],
  entities: [
    'signal lattice', 'data queue', 'memory bank', 'process line', 'cache layer', 'link tunnel', 'node mesh',
    'buffer stack', 'thread pool', 'control bus', 'core stack', 'module bay', 'latency floor', 'thermal rail',
    'sensor grid', 'matrix gate', 'protocol seam', 'decoder ring', 'stream relay', 'voltage rail',
  ],
  comments: [
    'nothing is actually on fire. yet.',
    'still pretending this is stable.',
    'this again. fine.',
    'data looks fine. suspiciously fine.',
    'recalculating. for the third time.',
    'you call this nominal.',
    'quiet. not peaceful.',
    'the numbers are polite. the system is not.',
    'signal holds. barely.',
    'if it breaks, at least it will be honest.',
    'yes, the logs are still here.',
    'no, i am not impressed.',
    'i will pretend this is intentional.',
    'all right. keep breathing.',
  ],
  idleFragments: [
    'waiting. quietly.',
    'no input. minimal thought.',
    'idle, not asleep.',
    'resting the circuits.',
    'holding pattern.',
  ],
  statusByState: {
    STABLE: ['stable enough', 'baseline aligned', 'signal nominal', 'no alarms yet'],
    ACTIVE: ['activity rising', 'feeds engaged', 'signal under load', 'inputs active'],
    OVERLOAD: ['load choking', 'saturation detected', 'thermal drift rising', 'limits protesting'],
    DEGRADED: ['degraded integrity', 'noise bleeding', 'structure compromised', 'errors accepted'],
    RECOVERY: ['rebuilding state', 'stabilizing slowly', 'recovering', 'realigning'],
    IDLE: ['idle', 'waiting', 'low activity', 'quiet but awake'],
    ANOMALY: ['anomaly detected', 'unexpected state', 'sensor conflict', 'logic mismatch'],
  },
  eventPhrases: {
    cpuSpike: ['cpu spike. very subtle.', 'core heat rising. again.', 'cpu says no. politely.'],
    gpuSpike: ['gpu spike. predictable.', 'render path spiking.', 'gpu heat climbing. noted.'],
    netDrop: ['network drop. expected.', 'link went quiet.', 'packet loss. delightful.'],
    netRestore: ['link restored. for now.', 'network returned. suspiciously.', 'throughput back online.'],
    diskAnomaly: ['disk anomaly. grinding softly.', 'storage jitter detected.', 'disk load is... busy.'],
    weatherChange: ['weather flipped again.', 'atmosphere updated. reluctantly.', 'forecast changed. no surprise.'],
    trackChange: ['track changed. mood adjusted.', 'audio shift detected.', 'another track. okay.'],
    endpointOffline: ['local endpoint offline.', 'sensor feed lost.', 'hardware feed missing.'],
    endpointOnline: ['endpoint online.', 'sensor feed restored.', 'hardware feed back.'],
    glitchEvent: ['glitch noted.', 'display fidelity compromised.', 'signal integrity degraded.'],
    recovery: ['systems reassembled.', 'recovery in progress.', 'stability resuming.'],
  },
  userEventPhrases: {
    wake: ['attention acquired.', 'back already.', 'awake now.'],
    firstClickAfterIdle: ['first click after silence. noted.', 'oh, you are back. fine.', 'input resumed. reluctantly.'],
    rapidClicks: ['yes, i felt that.', 'stop poking.', 'inputs received. all of them.'],
    hoverText: ['reading the internal log, are we.', 'eyes on the diagnostics.', 'hovering does not fix it.'],
    longIdle: ['idle thoughts only.', 'still here. barely.', 'long silence. noted.'],
  },
  templates: [
    { template: '{STATUS}. {COMMENT}', weight: 1.2 },
    { template: '{MARKOV_PHRASE}, {COMMENT}', weight: 1.1 },
    { template: '{COMMENT}. {MARKOV_PHRASE}', weight: 1.0 },
    { template: '{SYSTEM_ENTITY} is {ADJECTIVE}. {COMMENT}', weight: 1.0 },
    { template: '{SYSTEM_ENTITY} {VERB}. {COMMENT}', weight: 1.0 },
    { template: '{SARCASM} {STATUS}.', weight: 0.9 },
    { template: '{EVENT_PHRASE}. {COMMENT}', weight: 1.2 },
    { template: '{MARKOV_PHRASE}. {PAST_REFERENCE}', weight: 0.7 },
    { template: '{ALIEN_FRAGMENT} {MARKOV_PHRASE}', weight: 0.6 },
    { template: '{CONNECTIVE}, {STATUS}.', weight: 0.8 },
  ],
  corpusTemplates: [
    '{STATUS}. {CONNECTIVE}.',
    '{SYSTEM_ENTITY} {VERB}.',
    '{SYSTEM_ENTITY} is {ADJECTIVE}.',
    '{SARCASM} {SYSTEM_ENTITY} {VERB}.',
    '{CONNECTIVE} {SYSTEM_ENTITY} {VERB}.',
    '{STATUS}. {COMMENT}',
    '{SYSTEM_ENTITY} remains {ADJECTIVE}.',
    '{MARKOV_PHRASE}.',
    '{CONNECTIVE}, {STATUS}.',
  ],
  seedSentences: [
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
  ],
};

const RU_PACK = {
  systemNouns: [
    'сигнал', 'данные', 'память', 'процесс', 'кэш', 'связь', 'узел', 'буфер', 'поток', 'шина', 'ядро', 'модуль',
    'канал', 'решетка', 'регистр', 'интерфейс', 'сенсор', 'матрица', 'сетка', 'осциллятор', 'таймер', 'порт',
    'пакет', 'вектор', 'шлюз', 'очередь', 'контур', 'топология', 'схема', 'сеть', 'лог', 'след', 'рутина',
    'команда', 'стек', 'куча', 'адрес', 'драйвер', 'микрокод', 'кластер', 'контроллер', 'реле', 'регулятор',
    'контекст', 'состояние', 'профиль', 'протокол', 'слот', 'переход', 'шунт', 'петля', 'сшивка', 'датчик',
    'трасса', 'мост', 'сборка', 'шинаданных', 'ядро-цикл', 'каркас', 'узелок', 'вилка', 'разъем',
  ],
  verbs: [
    'дрейфует', 'задыхается', 'пересчитывается', 'буксует', 'тормозит', 'плавает', 'пульсирует', 'отваливается',
    'срывается', 'зависает', 'забивается', 'подтекает', 'притворяется', 'откатывается', 'перезапускается',
    'дробится', 'размывается', 'проваливается', 'засоряется', 'перегревается', 'компрессируется',
    'разрежается', 'смазывается', 'глохнет', 'съезжает', 'дребезжит', 'перескакивает', 'срывается', 'мерцает',
  ],
  adjectives: [
    'нестабильный', 'усталый', 'частичный', 'шумный', 'устаревший', 'фрагментированный', 'номинальный',
    'перегретый', 'ломкий', 'вязкий', 'смещенный', 'тусклый', 'нервный', 'подозрительный', 'дрожащий',
    'разреженный', 'потертый', 'сбитый', 'глухой', 'плавающий', 'хрупкий', 'задыхающийся', 'перекошенный',
  ],
  sarcasmMarkers: [
    'конечно', 'как всегда', 'опять', 'ну да', 'разумеется', 'естественно', 'прекрасно', 'великолепно',
    'очень вовремя', 'как удобно', 'очевидно',
  ],
  connectives: [
    'между тем', 'впрочем', 'в любом случае', 'так или иначе', 'пока', 'пожалуй', 'если что', 'в теории',
    'на практике', 'как ни странно', 'по привычке', 'в целом',
  ],
  brokenTokens: ['///', '...', '--', '??', '##', '!!', '::', '==', '~~'],
  prefixes: ['псевдо-', 'квази-', 'сверх-', 'ультра-', 'нано-', 'микро-', 'мета-', 'гипер-', 'суб-', 'интер-'],
  suffixes: ['-ядро', '-узел', '-контур', '-канал', '-слой', '-матрица', '-шина', '-модуль', '-трасса'],
  entities: [
    'решетка сигнала', 'поток данных', 'банк памяти', 'контур связи', 'слой кэша', 'узловая сетка',
    'буферный стек', 'пул потоков', 'контрольная шина', 'матрица датчиков', 'контур протокола',
  ],
  comments: [
    'ничего не горит. пока.',
    'всё стабильно. если верить цифрам.',
    'опять это. ладно.',
    'данные выглядят хорошо. слишком хорошо.',
    'пересчитываю. третий раз.',
    'тихо. не спокойно.',
    'сигнал держится. еле-еле.',
    'я сделаю вид, что это нормально.',
    'числа вежливые. система нет.',
  ],
  idleFragments: [
    'ожидание. тихо.',
    'входов нет. мыслей мало.',
    'idle, не сон.',
    'держу контур.',
    'режим ожидания.',
  ],
  statusByState: {
    STABLE: ['стабильно', 'база выровнена', 'сигнал номинален', 'без тревоги'],
    ACTIVE: ['активность растет', 'входы активны', 'контуры в работе', 'нагрузка живая'],
    OVERLOAD: ['перегруз', 'сжатие пределов', 'нагрев растет', 'лимиты против'],
    DEGRADED: ['деградация', 'шум просачивается', 'структура ослабла', 'ошибки допущены'],
    RECOVERY: ['восстанавливаю', 'собираю заново', 'стабилизируюсь', 'выравниваю'],
    IDLE: ['ожидание', 'низкая активность', 'тишина', 'сон наготове'],
    ANOMALY: ['аномалия', 'сбой состояния', 'конфликт датчиков', 'логика спорит'],
  },
  eventPhrases: {
    cpuSpike: ['скачок cpu. мило.', 'ядра жарятся. снова.', 'cpu вздохнул. громко.'],
    gpuSpike: ['скачок gpu. ожидаемо.', 'рендер кипит.', 'gpu греется. отметил.'],
    netDrop: ['сеть упала. как мило.', 'линк замолчал.', 'пакеты исчезли.'],
    netRestore: ['линк вернулся. пока.', 'сеть восстановлена. подозрительно.', 'трафик снова жив.'],
    diskAnomaly: ['аномалия диска. тихий скрежет.', 'диск занят. слишком.', 'хранилище дернулось.'],
    weatherChange: ['погода сменилась. опять.', 'атмосфера обновилась.', 'прогноз передумал.'],
    trackChange: ['трек сменился. настроение тоже.', 'аудио изменилось.', 'другая дорожка. ладно.'],
    endpointOffline: ['локальный endpoint оффлайн.', 'канал датчиков потерян.', 'железо молчит.'],
    endpointOnline: ['endpoint вернулся.', 'датчики снова на связи.', 'железо онлайн.'],
    glitchEvent: ['глитч принят.', 'целостность нарушена.', 'сигнал искажен.'],
    recovery: ['собираю систему.', 'восстановление идет.', 'стабильность возвращается.'],
  },
  userEventPhrases: {
    wake: ['внимание получено.', 'снова здесь.', 'вернулся. ладно.'],
    firstClickAfterIdle: ['первый клик после тишины. отмечено.', 'о, ты снова тут.', 'ввод возобновлен.'],
    rapidClicks: ['да, я это чувствую.', 'хватит щелкать.', 'вводов достаточно.'],
    hoverText: ['читаешь внутренний лог.', 'взгляд в диагностику.', 'наведение не лечит.'],
    longIdle: ['мысли в режиме ожидания.', 'тишина затянулась.', 'долгий простой. отмечено.'],
  },
  templates: [
    { template: '{STATUS}. {COMMENT}', weight: 1.2 },
    { template: '{MARKOV_PHRASE}, {COMMENT}', weight: 1.1 },
    { template: '{COMMENT}. {MARKOV_PHRASE}', weight: 1.0 },
    { template: '{SYSTEM_ENTITY} — {ADJECTIVE}. {COMMENT}', weight: 1.0 },
    { template: '{SYSTEM_ENTITY} {VERB}. {COMMENT}', weight: 1.0 },
    { template: '{SARCASM} {STATUS}.', weight: 0.9 },
    { template: '{EVENT_PHRASE}. {COMMENT}', weight: 1.2 },
    { template: '{MARKOV_PHRASE}. {PAST_REFERENCE}', weight: 0.7 },
    { template: '{ALIEN_FRAGMENT} {MARKOV_PHRASE}', weight: 0.6 },
    { template: '{CONNECTIVE}, {STATUS}.', weight: 0.8 },
  ],
  corpusTemplates: [
    '{STATUS}. {CONNECTIVE}.',
    '{SYSTEM_ENTITY} {VERB}.',
    '{SYSTEM_ENTITY} — {ADJECTIVE}.',
    '{SARCASM} {SYSTEM_ENTITY} {VERB}.',
    '{CONNECTIVE} {SYSTEM_ENTITY} {VERB}.',
    '{STATUS}. {COMMENT}',
    '{SYSTEM_ENTITY} остается {ADJECTIVE}.',
    '{MARKOV_PHRASE}.',
    '{CONNECTIVE}, {STATUS}.',
  ],
  seedSentences: [
    'ничего не горит. пока.',
    'данные выглядят хорошо. слишком хорошо.',
    'пересчитываю. третий раз.',
    'сигнал держится. еле-еле.',
    'тихо. не спокойно.',
    'я сделаю вид, что это нормально.',
    'числа вежливые. система нет.',
    'всё стабильно. если верить цифрам.',
  ],
};

const LANGUAGE_PACKS = {
  'en-US': EN_PACK,
  'ru-RU': RU_PACK,
};

const PAST_REFERENCES = {
  'en-US': ['still the same', 'nothing changed', 'as mentioned earlier'],
  'ru-RU': ['всё как было', 'ничего не изменилось', 'как уже говорилось'],
};

const DEFAULT_CONFIG = {
  enabled: true,
  frequency: 1,
  verbosity: 0.9,
  sarcasm: 0.7,
  degradationStrength: 0.6,
  languageProfile: 'engineering',
  idleMode: true,
  language: 'en-US',
};

export class MarkovModel {
  constructor(order = 2) {
    this.order = order;
    this.transitions = new Map();
    this.starts = [];
  }

  train(sentences = []) {
    this.transitions.clear();
    this.starts = [];
    sentences.forEach(sentence => {
      const words = tokenize(sentence);
      if (!words.length) return;
      this.starts.push(words[0]);
      const tokens = ['<s>', ...words, '</s>'];
      for (let i = 0; i < tokens.length - 1; i++) {
        const key = tokens[i].toLowerCase();
        const next = tokens[i + 1].toLowerCase();
        if (!this.transitions.has(key)) {
          this.transitions.set(key, new Map());
        }
        const map = this.transitions.get(key);
        map.set(next, (map.get(next) || 0) + 1);
      }
    });
  }

  generate({ minWords = MIN_WORDS, maxWords = MAX_WORDS, maxChars = MAX_CHARS } = {}) {
    if (!this.transitions.size || !this.starts.length) return '';
    let word = this._pick(this.starts);
    const output = [];
    const seen = new Map();
    while (output.length < maxWords && output.join(' ').length < maxChars) {
      if (word === '</s>') {
        if (output.length >= minWords) break;
        word = this._pick(this.starts);
        continue;
      }
      output.push(word);
      seen.set(word, (seen.get(word) || 0) + 1);
      if (seen.get(word) > 3) break;
      const next = this._next(word);
      if (!next) break;
      word = next;
    }
    return output.join(' ');
  }

  _next(word) {
    const map = this.transitions.get(word.toLowerCase());
    if (!map) return null;
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [key, count] of map.entries()) {
      r -= count;
      if (r <= 0) return key;
    }
    return null;
  }

  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

export class TemplateEngine {
  constructor(pack) {
    this.pack = pack;
  }

  render(context, slots) {
    const template = this._pickTemplate(context);
    if (!template) return '';
    const raw = template.template.replace(/\{([A-Z_]+)\}/g, (_, key) => {
      const fn = slots[key];
      return fn ? fn() : '';
    });
    return normalizeSentence(raw);
  }

  _pickTemplate(context) {
    const templates = this.pack.templates || [];
    if (!templates.length) return null;
    const weights = templates.map(entry => {
      const base = entry.weight || 1;
      const state = context.systemState || 'STABLE';
      const stateBoost = entry.states?.[state] ?? 1;
      const hasEvent = context.eventActive;
      const hasEventSlot = entry.template.includes('{EVENT_PHRASE}');
      let eventBoost = 1;
      if (hasEvent && hasEventSlot) eventBoost = 1.6;
      if (hasEvent && !hasEventSlot) eventBoost = 0.7;
      return base * stateBoost * eventBoost;
    });
    return weightedPick(templates, weights);
  }
}

export class PhraseMemory {
  constructor(key, limit = 30) {
    this.key = key;
    this.limit = limit;
    this.items = [];
    this._load();
  }

  add(text) {
    if (!text) return;
    this.items.unshift(text);
    this.items = this.items.slice(0, this.limit);
    this._save();
  }

  isTooSimilar(text) {
    if (!text) return true;
    const tokens = tokenize(text);
    if (!tokens.length) return true;
    const last = this.items[0];
    if (last) {
      const lastTokens = tokenize(last);
      const head = tokens.slice(0, 3).join(' ');
      const lastHead = lastTokens.slice(0, 3).join(' ');
      if (head && head === lastHead) return true;
    }
    return this.items.some(item => similarity(tokens, tokenize(item)) > 0.62);
  }

  getReference(language) {
    if (!this.items.length || Math.random() > 0.15) return '';
    const pool = PAST_REFERENCES[language] || PAST_REFERENCES['en-US'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _load() {
    const stored = loadState(this.key, null);
    if (Array.isArray(stored)) this.items = stored.slice(0, this.limit);
  }

  _save() {
    saveState(this.key, this.items);
  }
}

export class DegradationController {
  constructor(strength = 0.6) {
    this.strength = clamp(strength, 0, 1);
    this.level = 0;
  }

  setStrength(value) {
    this.strength = clamp(value, 0, 1);
  }

  update(dt, context) {
    const systemState = context.systemState || 'STABLE';
    const glitch = context.glitchState || {};
    let target = this.strength * 0.2;
    if (glitch.activeGlitches && glitch.activeGlitches.length) target += 0.25;
    if (glitch.recentBigEvent) target += 0.35;
    if (systemState === 'OVERLOAD' || systemState === 'DEGRADED' || systemState === 'ANOMALY') target += 0.2;
    if (systemState === 'RECOVERY') target -= 0.15;
    if (context.audioState?.peak) target += 0.08;
    this.level = lerp(this.level, clamp(target, 0, 1), clamp(dt * 0.4, 0.05, 0.35));
    return this.level;
  }

  apply(text, context) {
    if (!text) return text;
    let level = this.level;
    if (context?.languageProfile === 'broken') level = clamp(level + 0.2, 0, 1);
    if (context?.languageProfile === 'alien-heavy') level = clamp(level + 0.35, 0, 1);
    if (level <= 0.05) return text;
    const tokens = text.split(/\s+/);
    let output = tokens;
    if (level > 0.2 && output.length > 4) {
      const keep = Math.max(3, Math.floor(output.length * (1 - level * 0.4)));
      output = output.slice(0, keep);
    }
    output = output.map(token => {
      if (Math.random() < level * 0.18) return pickAlienFragment(2);
      return token;
    });
    let result = output.join(' ');
    if (level > 0.35 && Math.random() < level) {
      result = result.replace(/[.,]/g, '');
    }
    if (level > 0.45 && Math.random() < level) {
      result = truncateWithEllipsis(result);
    }
    return result.trim();
  }

  getDisplayState() {
    return {
      level: this.level,
      jitter: clamp(this.level * 4, 0, 4),
      flicker: clamp(this.level * 0.6, 0, 0.6),
    };
  }
}

export class ToneController {
  constructor(pack, config) {
    this.pack = pack;
    this.config = config;
  }

  updateConfig(config) {
    this.config = config;
  }

  pickStatus(systemState) {
    const list = this.pack.statusByState?.[systemState] || this.pack.statusByState?.STABLE || [];
    return pick(list);
  }

  pickComment(context) {
    const base = this.pack.comments || [];
    const idle = context.userInputEvents?.idle && this.config.idleMode;
    if (idle) {
      const idlePool = this.pack.idleFragments || base;
      return pick(idlePool);
    }
    const sarcasmChance = clamp(this.config.sarcasm || 0.6, 0, 1);
    if (Math.random() < sarcasmChance * 0.25) {
      return `${pick(this.pack.sarcasmMarkers)}.`;
    }
    return pick(base);
  }

  pickEntity() {
    const pool = this.pack.entities || this.pack.systemNouns || [];
    return pick(pool);
  }

  pickVerb() {
    return pick(this.pack.verbs || []);
  }

  pickAdjective() {
    return pick(this.pack.adjectives || []);
  }

  pickSarcasm() {
    const sarcasmChance = clamp(this.config.sarcasm || 0.6, 0, 1);
    if (Math.random() > sarcasmChance) return '';
    return pick(this.pack.sarcasmMarkers || []);
  }

  pickConnective() {
    return pick(this.pack.connectives || []);
  }

  pickAlienFragment(profile) {
    if (profile === 'alien-heavy' || (profile === 'broken' && Math.random() < 0.5)) {
      return pickAlienFragment(3);
    }
    if (Math.random() < 0.2) return pickAlienFragment(2);
    return '';
  }
}

export class SemanticEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.language = normalizeLanguage(this.config.language);
    this.pack = LANGUAGE_PACKS[this.language] || EN_PACK;
    this.lexicon = buildLexicon(this.pack);
    this.markov = new MarkovModel(2);
    this.templateEngine = new TemplateEngine(this.pack);
    this.tone = new ToneController(this.pack, this.config);
    this.degradation = new DegradationController(this.config.degradationStrength);
    this.memory = new PhraseMemory(`${STORAGE_KEY}_${this.language}`, 40);
    this.nextAt = this._nextInterval(0.5);
    this.elapsed = 0;
    this._train();
  }

  setConfig(next = {}) {
    Object.assign(this.config, next);
    this.tone.updateConfig(this.config);
    this.degradation.setStrength(this.config.degradationStrength);
    const nextLang = normalizeLanguage(this.config.language || this.language);
    if (nextLang !== this.language) {
      this.setLanguage(nextLang);
    }
  }

  setLanguage(language) {
    this.language = normalizeLanguage(language);
    this.pack = LANGUAGE_PACKS[this.language] || EN_PACK;
    this.lexicon = buildLexicon(this.pack);
    this.templateEngine = new TemplateEngine(this.pack);
    this.tone = new ToneController(this.pack, this.config);
    this.memory = new PhraseMemory(`${STORAGE_KEY}_${this.language}`, 40);
    this._train();
  }

  update(dt, context) {
    if (!this.config.enabled) return null;
    this.elapsed += dt;
    const level = this.degradation.update(dt, context);
    const inputEvents = context.userInputEvents || {};
    const eventBoost =
      inputEvents.hoverText || inputEvents.firstClickAfterIdle || inputEvents.rapidClicks || inputEvents.wake;
    if (eventBoost && this.elapsed > 2 && Math.random() < 0.4) {
      this.elapsed = Math.max(this.elapsed, this.nextAt);
    }
    if (this.elapsed < this.nextAt) return null;
    const text = this._generate(context, level);
    this.elapsed = 0;
    this.nextAt = this._nextInterval(context.entropyLevel ?? 0.4, context);
    return text;
  }

  getDisplayState() {
    return this.degradation.getDisplayState();
  }

  _train() {
    const corpus = buildCorpus(this.pack, this.lexicon, 260);
    this.markov.train(corpus);
  }

  _generate(context, degradationLevel) {
    const attempts = 6;
    for (let i = 0; i < attempts; i++) {
      const phrase = this._buildPhrase(context, degradationLevel);
      if (!phrase) continue;
      if (phrase.length < MIN_CHARS || phrase.length > MAX_CHARS) continue;
      if (this.memory.isTooSimilar(phrase)) continue;
      this.memory.add(phrase);
      return phrase;
    }
    return null;
  }

  _buildPhrase(context, degradationLevel) {
    if (context.glitchState?.recentBigEvent && Math.random() < 0.25) {
      const fragments = [];
      const count = 6 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        fragments.push(pickAlienFragment(3 + (i % 2)));
      }
      return fragments.join(' ');
    }
    const markovPhrase = this._buildMarkovPhrase();
    const systemEventPhrase = pickEventPhrase(context.systemEvents, this.pack.eventPhrases);
    const userEventPhrase = pickEventPhrase(context.userInputEvents, this.pack.userEventPhrases);
    const events = systemEventPhrase || userEventPhrase;
    const past = this.memory.getReference(this.language);
    const profile = this.config.languageProfile;
    const slots = {
      STATUS: () => this.tone.pickStatus(context.systemState),
      COMMENT: () => this.tone.pickComment(context),
      SYSTEM_ENTITY: () => this.tone.pickEntity(),
      ADJECTIVE: () => this.tone.pickAdjective(),
      VERB: () => this.tone.pickVerb(),
      CONNECTIVE: () => this.tone.pickConnective(),
      SARCASM: () => this.tone.pickSarcasm(),
      MARKOV_PHRASE: () => markovPhrase,
      EVENT_PHRASE: () => events || this.tone.pickComment(context),
      PAST_REFERENCE: () => past || this.tone.pickComment(context),
      ALIEN_FRAGMENT: () => this.tone.pickAlienFragment(profile),
    };
    const templateContext = { ...context, eventActive: !!events };
    let sentence = this.templateEngine.render(templateContext, slots);
    if (!sentence) return null;
    if (this.config.verbosity > 0.9 && Math.random() < 0.35) {
      sentence = `${sentence} ${this._buildMarkovPhrase()}`.trim();
    }
    if (events && Math.random() < 0.35) {
      sentence = `${events}. ${sentence}`.trim();
    }
    sentence = enforceLength(sentence);
    sentence = this.degradation.apply(sentence, { ...context, languageProfile: profile });
    sentence = finalizeSentence(sentence, this.language, this.config.languageProfile, degradationLevel);
    return sentence;
  }

  _buildMarkovPhrase() {
    const phrase = this.markov.generate({ minWords: MIN_WORDS, maxWords: MAX_WORDS, maxChars: MAX_CHARS });
    return phrase ? capitalize(phrase) : '';
  }

  _nextInterval(entropy = 0.4, context = {}) {
    const freq = clamp(this.config.frequency, 0.4, 2.2);
    const baseMin = 8 / freq;
    const baseMax = 25 / freq;
    let min = baseMin;
    let max = baseMax;
    if (context.behaviorMemory?.engagement > 0.6) {
      min *= 0.85;
      max *= 0.9;
    }
    if (entropy > 0.7) {
      min *= 0.75;
      max *= 0.8;
    }
    if (context.systemState === 'IDLE' && this.config.idleMode) {
      min *= 1.4;
      max *= 1.6;
    }
    if (context.systemState === 'OVERLOAD') {
      min *= 0.8;
      max *= 0.9;
    }
    return randRange(min, max);
  }
}

function buildLexicon(pack) {
  const tokens = new Set();
  const base = [
    ...(pack.systemNouns || []),
    ...(pack.verbs || []),
    ...(pack.adjectives || []),
    ...(pack.connectives || []),
    ...(pack.sarcasmMarkers || []),
    ...(pack.brokenTokens || []),
    ...(pack.entities || []),
    ...(pack.comments || []),
    ...Object.values(pack.statusByState || {}).flat(),
  ];
  base.forEach(word => tokens.add(word));

  const target = 2200;
  const prefixes = pack.prefixes || [];
  const suffixes = pack.suffixes || [];
  const nouns = pack.systemNouns || [];

  for (const prefix of prefixes) {
    for (const noun of nouns) {
      if (tokens.size >= target) break;
      tokens.add(`${prefix}${noun}`);
    }
    if (tokens.size >= target) break;
  }
  for (const noun of nouns) {
    for (const suffix of suffixes) {
      if (tokens.size >= target) break;
      tokens.add(`${noun}${suffix}`);
    }
    if (tokens.size >= target) break;
  }
  if (tokens.size < target) {
    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        if (tokens.size >= target) break;
        tokens.add(`${prefix}${suffix}`);
      }
      if (tokens.size >= target) break;
    }
  }
  if (tokens.size < target) {
    const fillers = ['phase', 'cycle', 'loop', 'node', 'path', 'flux', 'grid'];
    for (let i = 0; i < 200 && tokens.size < target; i++) {
      tokens.add(`${pick(fillers)}-${i}`);
    }
  }
  return Array.from(tokens);
}

function buildCorpus(pack, lexicon, count = 260) {
  const sentences = [];
  const templates = pack.corpusTemplates || [];
  const words = {
    STATUS: () => pick(Object.values(pack.statusByState || {}).flat()),
    CONNECTIVE: () => pick(pack.connectives || []),
    SYSTEM_ENTITY: () => pick(pack.entities || pack.systemNouns || []),
    VERB: () => pick(pack.verbs || []),
    ADJECTIVE: () => pick(pack.adjectives || []),
    COMMENT: () => pick(pack.comments || []),
    SARCASM: () => pick(pack.sarcasmMarkers || []),
    MARKOV_PHRASE: () => pick(lexicon),
  };
  const seed = pack.seedSentences || [];
  seed.forEach(line => sentences.push(line));
  for (let i = 0; i < count; i++) {
    const tpl = templates[i % templates.length] || '{STATUS}.';
    const line = tpl.replace(/\{([A-Z_]+)\}/g, (_, key) => words[key]?.() || '');
    sentences.push(normalizeSentence(line));
  }
  return sentences;
}

function pickEventPhrase(events, eventPhrases) {
  if (!events || !eventPhrases) return '';
  const keys = Object.keys(events).filter(key => events[key] && eventPhrases[key]);
  if (!keys.length) return '';
  const key = keys[Math.floor(Math.random() * keys.length)];
  const pool = eventPhrases[key];
  return pool ? pick(pool) : '';
}

function finalizeSentence(text, language, profile, degradationLevel) {
  if (!text) return text;
  let result = text.replace(/\s+/g, ' ').trim();
  if (!result) return result;
  if (!/[.!?]$/.test(result) && degradationLevel < 0.55) {
    result = `${result}.`;
  }
  if (profile === 'alien-heavy' && Math.random() < 0.35) {
    result = `${pickAlienFragment(3)} ${result}`;
  }
  return splitLines(result);
}

function enforceLength(text) {
  if (!text) return text;
  let result = text.trim();
  if (result.length > MAX_CHARS) {
    result = result.slice(0, MAX_CHARS);
    result = result.replace(/[^\w)]+$/, '');
  }
  return result;
}

function normalizeSentence(text) {
  if (!text) return '';
  let result = text.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();
  result = result.replace(/\s+,/g, ',').replace(/\s+;/g, ';');
  return capitalize(result);
}

function splitLines(text) {
  if (text.length <= 60) return text;
  const mid = Math.floor(text.length / 2);
  let split = text.lastIndexOf(' ', mid);
  if (split < 0 || text.length - split > 80) split = text.indexOf(' ', mid);
  if (split > 0) {
    return `${text.slice(0, split)}\n${text.slice(split + 1)}`;
  }
  return text;
}

function truncateWithEllipsis(text) {
  const cut = Math.max(MIN_CHARS, Math.floor(text.length * 0.7));
  return `${text.slice(0, cut).trim()}...`;
}

function similarity(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let intersection = 0;
  a.forEach(token => {
    if (b.has(token)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, '')
    .split(/\s+/)
    .filter(Boolean);
}

function pick(list) {
  if (!list || !list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}

function weightedPick(list, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[0];
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function normalizeLanguage(language) {
  if (language && language.toLowerCase().startsWith('ru')) return 'ru-RU';
  return 'en-US';
}

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pickAlienFragment(size = 2) {
  if (!ALIEN_SYMBOLS || !ALIEN_SYMBOLS.length) return '';
  let fragment = '';
  for (let i = 0; i < size; i++) {
    fragment += ALIEN_SYMBOLS[Math.floor(Math.random() * ALIEN_SYMBOLS.length)];
  }
  return fragment;
}
