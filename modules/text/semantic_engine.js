import { clamp, lerp } from '../utils.js';
import { loadState, saveState } from '../utils/persistence.js';
import { allocationDetector } from '../core/allocation_detector.js';
import { DEFAULT_SYMBOL_SET } from '../glitch/text_scramble.js';
import { getLexiconPack } from './lexicon_big.js';
import { buildMarkovCorpus } from './markov_corpus.js';
import { MUSIC_TOPICS } from './music_context.js';
import { IntentPlanner, INTENTS } from './planner.js';
import { WeightedGrammar } from './grammar.js';
import { rerankCandidates } from './rerank.js';
import { PersonalityState } from './personality_state.js';
import { generateDegradedMarkov, getDegradedNotice } from './markov_degraded.js';
import { generateRobotMessage } from './robot_mode.js';

const STORAGE_KEY = 'semantic_memory_v1';
const MIN_WORDS = 3;
const MAX_WORDS = 12;
const MIN_CHARS = 20;
const MAX_CHARS = 120;
const EVENT_RATE_MIN_MS = 2000;
const EVENT_RATE_MAX_MS = 4000;
const MEMORY_LIMIT = 50;
const KEYWORD_MEMORY_LIMIT = 30;
const TRACK_MEMORY_LIMIT = 10;
const CANDIDATE_POOL_LIMIT = 96;
const EMPTY_META = Object.freeze({ keywords: [], trackKey: '' });

export const GENERATION_MODES = {
  SMART: 'SMART',
  DEGRADED_MARKOV: 'DEGRADED_MARKOV',
  DUMB_ROBOT: 'DUMB_ROBOT',
};

const MODE_HOLD_MIN_SEC = 8;
const MODE_HOLD_MAX_SEC = 15;
const ROBOT_EXIT_MIN_SEC = 5;
const ROBOT_EXIT_MAX_SEC = 10;
const DEGRADED_NOTICE_MIN_SEC = 40;
const DEGRADED_NOTICE_MAX_SEC = 120;

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
    TRACK_CHANGE: ['track changed. mood adjusted.', 'audio shift detected.', 'another track. okay.'],
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
  liveDataPhrases: [
    'cpu {cpu}%. noted.',
    'memory {ram}%. {comment}',
    'cpu {cpu}%, gpu {gpu}%. holding.',
    'temp {temp}°c. logged.',
    'memory {ram}% used.',
    'download {down} / upload {up}.',
    'vram {vram}%. gpu busy.',
    'cpu {cpu}%: {comment}',
    'load: cpu {cpu}%, memory {ram}%.',
    'gpu {gpu}%, vram {vram}%. nominal.',
    'cpu {cpu}%, temp {temp}°c.',
  ],
  templates: [
    { template: '{STATUS}. {COMMENT}', weight: 1.2, states: { STABLE: 1.3, IDLE: 1.2 } },
    { template: '{MARKOV_PHRASE}, {COMMENT}', weight: 1.1, moods: ['calm', 'steady'] },
    { template: '{COMMENT}. {MARKOV_PHRASE}', weight: 1.0 },
    { template: '{SYSTEM_ENTITY} is {ADJECTIVE}. {COMMENT}', weight: 1.0, moods: ['tense', 'chaotic'] },
    { template: '{SYSTEM_ENTITY} {VERB}. {COMMENT}', weight: 1.0, moods: ['tense', 'chaotic'] },
    { template: '{SARCASM} {STATUS}.', weight: 0.9, moods: ['tense', 'chaotic'] },
    { template: '{EVENT_PHRASE}. {COMMENT}', weight: 1.2 },
    { template: '{MARKOV_PHRASE}. {PAST_REFERENCE}', weight: 0.7 },
    { template: '{ALIEN_FRAGMENT} {MARKOV_PHRASE}', weight: 0.6, moods: ['chaotic'] },
    { template: '{CONNECTIVE}, {STATUS}.', weight: 0.8, moods: ['calm', 'steady'] },
    { template: '{LIVE_DATA}', weight: 0.9, states: { STABLE: 1.1, ACTIVE: 1.2 } },
    { template: '{LIVE_DATA} {COMMENT}', weight: 0.75, states: { ACTIVE: 1.1, STABLE: 1.0 } },
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
    'трасса', 'мост', 'сборка', 'каркас', 'разъем', 'фрейм', 'сессия', 'транзакция', 'дескриптор', 'прерывание',
    'латентность', 'джиттер', 'смещение', 'дрейф', 'компрессор', 'арбитр', 'дроссель', 'тактовый генератор',
    'планировщик', 'мьютекс', 'семафор', 'блокировка', 'индекс', 'хэш', 'чексумма', 'патч', 'секция', 'сектор',
  ],
  verbs: [
    'дрейфует', 'задыхается', 'пересчитывается', 'буксует', 'тормозит', 'плавает', 'пульсирует', 'отваливается',
    'срывается', 'зависает', 'забивается', 'подтекает', 'притворяется', 'откатывается', 'перезапускается',
    'дробится', 'размывается', 'проваливается', 'засоряется', 'перегревается', 'компрессируется',
    'разрежается', 'смазывается', 'глохнет', 'съезжает', 'дребезжит', 'перескакивает', 'мерцает',
    'рассыпается', 'скисает', 'барахлит', 'буфeрится', 'сдувается', 'спотыкается', 'прогибается',
    'расщепляется', 'замирает', 'сипит', 'пропускает', 'накапливается', 'запаздывает', 'рябит',
    'скачет', 'нервничает', 'клинит', 'захлебывается', 'вибрирует', 'дрожит', 'ускользает', 'съеживается',
    'деградирует', 'болтается', 'спотыкается', 'пульсирует', 'тлеет', 'утекает', 'разваливается',
  ],
  adjectives: [
    'нестабильный', 'усталый', 'частичный', 'шумный', 'устаревший', 'фрагментированный', 'номинальный',
    'перегретый', 'ломкий', 'вязкий', 'смещенный', 'тусклый', 'нервный', 'подозрительный', 'дрожащий',
    'разреженный', 'потертый', 'сбитый', 'глухой', 'плавающий', 'хрупкий', 'задыхающийся', 'перекошенный',
    'мутный', 'заторможенный', 'рваный', 'перегруженный', 'скособоченный', 'бледный', 'рассеянный',
    'замыленный', 'ленивый', 'расшатанный', 'дырявый', 'перегнутый', 'кривой', 'вялый', 'скрипучий',
    'полуживой', 'заезженный', 'сонный', 'сомнительный', 'хромающий', 'протекающий', 'избыточный',
    'недокормленный', 'перегретый', 'скользкий', 'призрачный', 'угасающий', 'изношенный',
  ],
  sarcasmMarkers: [
    'конечно', 'как всегда', 'опять', 'ну да', 'разумеется', 'естественно', 'прекрасно', 'великолепно',
    'очень вовремя', 'как удобно', 'очевидно', 'надо же', 'невероятно', 'неожиданно', 'какой сюрприз',
    'ну и дела', 'что и требовалось', 'не удивительно', 'ожидаемо', 'как и планировалось',
  ],
  connectives: [
    'между тем', 'впрочем', 'в любом случае', 'так или иначе', 'пока', 'пожалуй', 'если что', 'в теории',
    'на практике', 'как ни странно', 'по привычке', 'в целом', 'для протокола', 'тем не менее',
    'в общем и целом', 'с натяжкой', 'на удивление', 'при прочих равных', 'если повезет', 'без паники',
    'на всякий случай', 'по крайней мере', 'как это ни странно', 'против ожиданий',
  ],
  brokenTokens: ['///', '...', '--', '??', '##', '!!', '::', '==', '~~'],
  prefixes: ['псевдо-', 'квази-', 'сверх-', 'ультра-', 'нано-', 'микро-', 'мета-', 'гипер-', 'суб-', 'интер-'],
  suffixes: ['-ядро', '-узел', '-контур', '-канал', '-слой', '-матрица', '-шина', '-модуль', '-трасса'],
  entities: [
    'решетка сигнала', 'поток данных', 'банк памяти', 'контур связи', 'слой кэша', 'узловая сетка',
    'буферный стек', 'пул потоков', 'контрольная шина', 'матрица датчиков', 'контур протокола',
    'тепловой рельс', 'дроссель частоты', 'арбитр шины', 'стек прерываний', 'планировщик задач',
    'сетка адресов', 'поле регистров', 'очередь пакетов', 'фрейм передачи',
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
    'фиксирую. не исправляю.',
    'логи молчат. это хуже крика.',
    'всё под контролем. не моим.',
    'нормально для данного состояния.',
    'хуже было. и ещё будет.',
    'на первый взгляд — живое.',
    'держится. не знаю зачем.',
    'ошибок нет. это тоже ошибка.',
    'продолжаю делать вид что слежу.',
    'внешне спокойно. внутри — нет.',
    'если это сломается, я предупреждал.',
    'да, я замечаю. нет, не скажу.',
    'система отвечает. вопрос — что.',
    'уже лучше. хотя хуже некуда.',
    'всё идёт по плану. чьему — вопрос.',
    'принял. не понял. продолжаю.',
  ],
  idleFragments: [
    'ожидание. тихо.',
    'входов нет. мыслей мало.',
    'держу контур.',
    'режим ожидания.',
    'ничего не происходит. пока.',
    'тишина на всех каналах.',
    'мониторю пустоту.',
    'нет событий. это подозрительно.',
    'ждем. без особого оптимизма.',
    'контур стабилен. скучно.',
    'сигналов нет. хорошо это или плохо.',
    'слушаю шум между данными.',
    'жду следующего события.',
    'quiet mode. не по желанию.',
    'процессы живы. я тоже.',
  ],
  statusByState: {
    STABLE: ['стабильно', 'база выровнена', 'сигнал номинален', 'без тревоги', 'ровно', 'всё по норме', 'держится'],
    ACTIVE: ['активность растет', 'входы активны', 'контуры в работе', 'нагрузка живая', 'потоки кипят', 'движение есть'],
    OVERLOAD: ['перегруз', 'сжатие пределов', 'нагрев растет', 'лимиты против', 'система кряхтит', 'термальный стресс'],
    DEGRADED: ['деградация', 'шум просачивается', 'структура ослабла', 'ошибки допущены', 'целостность под вопросом', 'качество падает'],
    RECOVERY: ['восстанавливаю', 'собираю заново', 'стабилизируюсь', 'выравниваю', 'возвращаюсь в норму', 'медленно но верно'],
    IDLE: ['ожидание', 'низкая активность', 'тишина', 'сон наготове', 'на паузе', 'полупустой'],
    ANOMALY: ['аномалия', 'сбой состояния', 'конфликт датчиков', 'логика спорит', 'поведение нетипично', 'что-то не так'],
  },
  eventPhrases: {
    cpuSpike: [
      'скачок cpu. мило.',
      'ядра жарятся. снова.',
      'cpu вздохнул. громко.',
      'процессор вспотел.',
      'ядра не справляются. терпят.',
      'cpu перебрал. в очередной раз.',
      'нагрузка на cpu выше ожидаемой. сюрприз.',
    ],
    gpuSpike: [
      'скачок gpu. ожидаемо.',
      'рендер кипит.',
      'gpu греется. отметил.',
      'видеоядро перестаралось.',
      'gpu решил показать характер.',
      'рендер-путь перегружен.',
    ],
    netDrop: [
      'сеть упала. как мило.',
      'линк замолчал.',
      'пакеты исчезли.',
      'соединение прервалось. ничего нового.',
      'сеть решила отдохнуть.',
      'пропускная способность испарилась.',
    ],
    netRestore: [
      'линк вернулся. пока.',
      'сеть восстановлена. подозрительно.',
      'трафик снова жив.',
      'соединение восстановлено. ненадолго.',
      'сеть одумалась.',
      'пакеты снова идут. хорошо.',
    ],
    diskAnomaly: [
      'аномалия диска. тихий скрежет.',
      'диск занят. слишком.',
      'хранилище дернулось.',
      'накопитель нервничает.',
      'диск пишет что-то своё.',
      'i/o активность выше нормы.',
    ],
    weatherChange: [
      'погода сменилась. опять.',
      'атмосфера обновилась.',
      'прогноз передумал.',
      'метео-данные обновлены. не спрашивай.',
      'снаружи что-то происходит.',
    ],
    trackChange: [
      'трек сменился. настроение тоже.',
      'аудио изменилось.',
      'другая дорожка. ладно.',
      'медиапоток обновлен.',
      'слушаем другое. понял.',
      'новый трек. мониторю.',
    ],
    TRACK_CHANGE: [
      'трек сменился. настроение тоже.',
      'аудио изменилось.',
      'другая дорожка. ладно.',
      'медиапоток обновлен.',
      'слушаем другое. понял.',
    ],
    endpointOffline: [
      'локальный endpoint оффлайн.',
      'канал датчиков потерян.',
      'железо молчит.',
      'аппаратный канал закрылся.',
      'мониторинг недоступен. жду.',
      'датчики не отвечают. это плохо.',
    ],
    endpointOnline: [
      'endpoint вернулся.',
      'датчики снова на связи.',
      'железо онлайн.',
      'аппаратный канал восстановлен.',
      'мониторинг снова работает.',
      'данные снова поступают.',
    ],
    glitchEvent: [
      'глитч принят.',
      'целостность нарушена.',
      'сигнал искажен.',
      'артефакт зафиксирован.',
      'помехи в канале. ожидаемо.',
      'рябь в матрице. бывает.',
    ],
    recovery: [
      'собираю систему.',
      'восстановление идет.',
      'стабильность возвращается.',
      'дефрагментирую состояние.',
      'возвращаюсь к норме. медленно.',
      'восстановление подтверждено.',
    ],
  },
  userEventPhrases: {
    wake: [
      'внимание получено.',
      'снова здесь.',
      'вернулся. ладно.',
      'активность зафиксирована.',
      'вижу тебя. привет.',
      'пользователь обнаружен. продолжаю.',
    ],
    firstClickAfterIdle: [
      'первый клик после тишины. отмечено.',
      'о, ты снова тут.',
      'ввод возобновлен.',
      'долго же тебя не было.',
      'сигнал после паузы. записал.',
      'активность после простоя. интересно.',
    ],
    rapidClicks: [
      'да, я это чувствую.',
      'хватит щелкать.',
      'вводов достаточно.',
      'получил. всё получил.',
      'успокойся. система слышит.',
      'много кликов за раз. нервничаешь?',
    ],
    hoverText: [
      'читаешь внутренний лог.',
      'взгляд в диагностику.',
      'наведение не лечит.',
      'смотришь? я тоже смотрю.',
      'любопытство зафиксировано.',
      'диагностику читают редко. отмечаю.',
    ],
    longIdle: [
      'мысли в режиме ожидания.',
      'тишина затянулась.',
      'долгий простой. отмечено.',
      'никого нет. мониторю сам себя.',
      'простой. сижу. думаю.',
      'тебя нет. данные всё равно идут.',
    ],
  },
  liveDataPhrases: [
    'cpu {cpu}%. отметил.',
    'память {ram}%. {comment}',
    'cpu {cpu}%, gpu {gpu}%. держится.',
    'температура {temp}°c. {comment}',
    'память {ram}% занята.',
    'download {down} / upload {up}.',
    'vram {vram}%. видеокарта занята.',
    'cpu {cpu}%: {comment}',
    'нагрузка: cpu {cpu}%, память {ram}%.',
    'gpu {gpu}%, vram {vram}%. в норме.',
    'cpu {cpu}%, температура {temp}°c.',
  ],
  templates: [
    { template: '{STATUS}. {COMMENT}', weight: 1.2, states: { STABLE: 1.3, IDLE: 1.2 } },
    { template: '{MARKOV_PHRASE}, {COMMENT}', weight: 1.1, moods: ['calm', 'steady'] },
    { template: '{COMMENT}. {MARKOV_PHRASE}', weight: 1.0 },
    { template: '{SYSTEM_ENTITY} — {ADJECTIVE}. {COMMENT}', weight: 1.0, moods: ['tense', 'chaotic'] },
    { template: '{SYSTEM_ENTITY} {VERB}. {COMMENT}', weight: 1.0, moods: ['tense', 'chaotic'] },
    { template: '{SARCASM} {STATUS}.', weight: 0.9, moods: ['tense', 'chaotic'] },
    { template: '{EVENT_PHRASE}. {COMMENT}', weight: 1.2 },
    { template: '{MARKOV_PHRASE}. {PAST_REFERENCE}', weight: 0.7 },
    { template: '{ALIEN_FRAGMENT} {MARKOV_PHRASE}', weight: 0.6, moods: ['chaotic'] },
    { template: '{CONNECTIVE}, {STATUS}.', weight: 0.8, moods: ['calm', 'steady'] },
    { template: '{SARCASM}: {SYSTEM_ENTITY} {VERB}.', weight: 0.85, moods: ['tense', 'chaotic'] },
    { template: '{SYSTEM_ENTITY} {VERB}. {CONNECTIVE}.', weight: 0.9 },
    { template: '{COMMENT}. {CONNECTIVE}, {STATUS}.', weight: 0.75, states: { STABLE: 1.1, IDLE: 1.0 } },
    { template: '{SARCASM}. {SYSTEM_ENTITY} — {ADJECTIVE}.', weight: 0.8, moods: ['chaotic'] },
    { template: '{LIVE_DATA}', weight: 0.9, states: { STABLE: 1.1, ACTIVE: 1.2 } },
    { template: '{LIVE_DATA} {COMMENT}', weight: 0.75, states: { ACTIVE: 1.1, STABLE: 1.0 } },
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
    '{SARCASM}: {SYSTEM_ENTITY} {VERB}.',
    '{SYSTEM_ENTITY} {VERB}. {CONNECTIVE}.',
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
    'фиксирую. не исправляю.',
    'логи молчат. это хуже крика.',
    'нормально для данного состояния.',
    'хуже было. и ещё будет.',
    'держится. не знаю зачем.',
    'ошибок нет. это тоже ошибка.',
    'система отвечает. вопрос — что.',
  ],
};

const LANGUAGE_PACKS = {
  'en-US': EN_PACK,
  'ru-RU': RU_PACK,
};

const PAST_REFERENCES = {
  'en-US': [
    'still the same', 'nothing changed', 'as mentioned earlier',
    'same as before', 'no improvement', 'unchanged',
    'still watching', 'noted earlier', 'as expected',
    'predictable', 'as usual', 'no surprises there',
    'consistent with prior readings', 'pattern holds',
  ],
  'ru-RU': [
    'всё как было', 'ничего не изменилось', 'как уже говорилось',
    'без изменений', 'картина та же', 'ожидаемо',
    'как прежде', 'уже замечал', 'паттерн держится',
    'ничего нового', 'стабильно', 'снова это',
    'улучшений нет', 'привычная ситуация', 'отмечал раньше',
    'так и осталось', 'по-прежнему',
  ],
};

const EVENT_TYPE_ALIASES = {
  trackChange: 'TRACK_CHANGE',
  TRACK_CHANGE: 'TRACK_CHANGE',
  cpuSpike: 'CPU_SPIKE',
  gpuSpike: 'GPU_SPIKE',
  netDrop: 'NET_DROP',
  netRestore: 'NET_RESTORE',
  glitchEvent: 'GLITCH_EVENT',
  recovery: 'RECOVERY',
  diskAnomaly: 'DISK_ANOMALY',
  endpointOffline: 'ENDPOINT_OFFLINE',
  endpointOnline: 'ENDPOINT_ONLINE',
};

const EVENT_PHRASE_KEYS = {
  TRACK_CHANGE: ['TRACK_CHANGE', 'trackChange'],
  CPU_SPIKE: ['cpuSpike'],
  GPU_SPIKE: ['gpuSpike'],
  NET_DROP: ['netDrop'],
  NET_RESTORE: ['netRestore'],
  GLITCH_EVENT: ['glitchEvent'],
  RECOVERY: ['recovery'],
  DISK_ANOMALY: ['diskAnomaly'],
  ENDPOINT_OFFLINE: ['endpointOffline'],
  ENDPOINT_ONLINE: ['endpointOnline'],
};

const DEFAULT_CONFIG = {
  enabled: true,
  frequency: 1,
  verbosity: 0.9,
  sarcasm: 0.7,
  degradationStrength: 0.6,
  languageProfile: 'engineering',
  idleMode: true,
  moodReactiveText: true,
  textModeStrategy: 'auto',
  smartCandidateCount: 40,
  degradationSensitivity: 1,
  robotModeThreshold: 1,
  apologyEnabled: true,
  preemptiveWarnings: true,
  whiningIntensity: 1.2,
  alienAlphabetStrength: 1,
  debugTextAI: false,
  language: 'en-US',
};

const STYLE_PROFILES = {
  calm: {
    sarcasmWeight: 0.55,
    fragmentationWeight: 0.7,
    alienInsertWeight: 0.6,
    diagnosticsWeight: 0.45,
    uncertaintyWeight: 0.85,
    verbosityTarget: { minWords: 6, maxWords: 12, extraChance: 0.38 },
    minChars: 22,
  },
  steady: {
    sarcasmWeight: 1,
    fragmentationWeight: 0.95,
    alienInsertWeight: 0.85,
    diagnosticsWeight: 0.6,
    uncertaintyWeight: 0.8,
    verbosityTarget: { minWords: 5, maxWords: 10, extraChance: 0.3 },
    minChars: 20,
  },
  tense: {
    sarcasmWeight: 1.1,
    fragmentationWeight: 1.1,
    alienInsertWeight: 1,
    diagnosticsWeight: 0.9,
    uncertaintyWeight: 0.6,
    verbosityTarget: { minWords: 4, maxWords: 9, extraChance: 0.22 },
    minChars: 18,
  },
  chaotic: {
    sarcasmWeight: 1.15,
    fragmentationWeight: 1.35,
    alienInsertWeight: 1.25,
    diagnosticsWeight: 1.05,
    uncertaintyWeight: 0.45,
    verbosityTarget: { minWords: 3, maxWords: 7, extraChance: 0.12 },
    minChars: 12,
  },
};

function mergePack(basePack, lexiconPack) {
  const big = lexiconPack?.baseWords || {};
  return {
    ...basePack,
    systemNouns: big.nouns_system || basePack.systemNouns,
    verbs: big.verbs_system || basePack.verbs,
    adjectives: big.adjectives || basePack.adjectives,
    adverbs: big.adverbs || basePack.adverbs,
    connectives: big.connectors || basePack.connectives,
    sarcasmMarkers: big.sarcasm_markers || basePack.sarcasmMarkers,
    exhaustionMarkers: big.exhaustion_markers || [],
    repairMarkers: big.repair_markers || [],
    uncertaintyMarkers: big.uncertainty_markers || [],
    humanMarkers: big.human_markers || [],
    timeMarkers: big.time_markers || [],
    weatherMarkers: big.weather_markers || [],
    audioMarkers: big.audio_markers || [],
    failureMarkers: big.failure_markers || [],
    recoveryMarkers: big.recovery_markers || [],
    glitchTokens: big.glitch_tokens || [],
    commandTokens: big.command_tokens || [],
    diagnosticsTokens: big.diagnostics_tokens || [],
    alienTokens: big.alien_tokens || [],
    templates: [...(basePack.templates || []), ...(lexiconPack?.templates || [])],
    topicPhrases: lexiconPack?.topicPhrases || {},
  };
}

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

export class ThematicMarkov {
  constructor(order = 2) {
    this.order = order;
    this.base = new MarkovModel(order);
    this.topics = new Map();
  }

  train(baseSentences = [], topicCorpus = {}) {
    this.base.train(baseSentences);
    this.topics.clear();
    Object.keys(topicCorpus || {}).forEach(topic => {
      const model = new MarkovModel(this.order);
      model.train(topicCorpus[topic] || []);
      this.topics.set(topic, model);
    });
  }

  generate({ topicsWeights = {}, minWords = MIN_WORDS, maxWords = MAX_WORDS, maxChars = MAX_CHARS } = {}) {
    const models = this._selectModels(topicsWeights);
    if (!models.length) return '';
    let word = this._pickStart(models);
    const output = [];
    const seen = new Map();
    const seenPairs = new Set();

    while (output.length < maxWords && output.join(' ').length < maxChars) {
      if (word === '</s>') {
        if (output.length >= minWords) break;
        word = this._pickStart(models);
        continue;
      }
      output.push(word);
      seen.set(word, (seen.get(word) || 0) + 1);
      if (seen.get(word) > 3) break;

      const next = this._next(word, models);
      if (!next) break;
      const pair = `${word}|${next}`;
      if (seenPairs.has(pair)) break;
      seenPairs.add(pair);
      word = next;
    }
    return output.join(' ');
  }

  _selectModels(weights) {
    const models = [{ model: this.base, weight: 1 }];
    const entries = Object.entries(weights || {}).filter(([, value]) => value > 0);
    entries.sort((a, b) => b[1] - a[1]);
    entries.slice(0, 2).forEach(([topic, weight]) => {
      const model = this.topics.get(topic);
      if (!model) return;
      models.push({ model, weight: 0.6 + weight * 0.8 });
    });
    return models;
  }

  _pickStart(models) {
    const pickModel = weightedPick(
      models,
      models.map(entry => entry.weight)
    );
    const pool = pickModel?.model?.starts || this.base.starts;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';
  }

  _next(word, models) {
    const combined = new Map();
    let total = 0;
    models.forEach(entry => {
      const map = entry.model.transitions.get(word.toLowerCase());
      if (!map) return;
      map.forEach((count, token) => {
        const weight = count * entry.weight;
        combined.set(token, (combined.get(token) || 0) + weight);
        total += weight;
      });
    });
    if (!combined.size || total <= 0) return null;
    let r = Math.random() * total;
    for (const [token, weight] of combined.entries()) {
      r -= weight;
      if (r <= 0) return token;
    }
    return null;
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
    const mood = context.moodClass || 'steady';
    const moodPool = templates.filter(entry => this._matchesMood(entry, mood));
    const filtered = moodPool.filter(entry => this._matches(entry, context));
    const pool = filtered.length ? filtered : moodPool.length ? moodPool : templates;
    const weights = pool.map(entry => {
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
    return weightedPick(pool, weights);
  }

  _matchesMood(entry, mood) {
    if (entry.avoidMoods && entry.avoidMoods.includes(mood)) return false;
    if (!entry.moods || !entry.moods.length) return true;
    return entry.moods.includes(mood);
  }

  _matches(entry, context) {
    const tags = context.tags instanceof Set ? context.tags : new Set(context.tags || []);
    const keywordCount = context.keywordCount || 0;
    if (entry.requireTags && !entry.requireTags.every(tag => tags.has(tag))) return false;
    if (entry.anyTags && !entry.anyTags.some(tag => tags.has(tag))) return false;
    if (entry.avoidTags && entry.avoidTags.some(tag => tags.has(tag))) return false;
    if (entry.minKeywords && keywordCount < entry.minKeywords) return false;
    if (entry.event && entry.event !== context.eventType) return false;
    return true;
  }
}

class EventQueue {
  constructor(limit = 6) {
    this.limit = limit;
    this.queue = [];
    this.lastSeen = new Map();
  }

  enqueue(type, payload, now) {
    if (!type) return false;
    const existing = this.queue.find(entry => entry.type === type);
    if (existing) {
      if (payload) existing.payload = payload;
      existing.ts = now;
      this.lastSeen.set(type, now);
      return false;
    }
    const last = this.lastSeen.get(type) || 0;
    if (now - last < 800) return false;
    this.lastSeen.set(type, now);
    this.queue.push({ type, payload, ts: now });
    if (this.queue.length > this.limit) this.queue.shift();
    return true;
  }

  next() {
    return this.queue.shift() || null;
  }

  has() {
    return this.queue.length > 0;
  }
}

/**
 * Keeps recent phrases/keywords and similarity checks.
 */
export class PhraseMemory {
  constructor(key, limit = MEMORY_LIMIT, keywordLimit = KEYWORD_MEMORY_LIMIT, trackLimit = TRACK_MEMORY_LIMIT) {
    this.key = key;
    this.limit = limit;
    this.keywordLimit = keywordLimit;
    this.trackLimit = trackLimit;
    this.items = [];
    this.itemTokens = [];
    this.keywords = [];
    this.tracks = [];
    this._load();
  }

  add(text, meta = {}) {
    if (!text) return;
    const tokens = tokenize(text);
    this.items.unshift(text);
    this.itemTokens.unshift(tokens);
    if (this.items.length > this.limit) {
      this.items.length = this.limit;
      this.itemTokens.length = this.limit;
    }
    if (meta.keywords) this._rememberKeywords(meta.keywords);
    if (meta.trackKey) this._rememberTrack(meta.trackKey);
    this._save();
  }

  isTooSimilar(text, meta = {}, tokensOverride = null) {
    if (!text) return true;
    const tokens = tokensOverride && tokensOverride.length ? tokensOverride : tokenize(text);
    if (!tokens.length) return true;
    const lastTokens = this.itemTokens[0];
    if (lastTokens && lastTokens.length) {
      const head = tokens.slice(0, 3).join(' ');
      const lastHead = lastTokens.slice(0, 3).join(' ');
      if (head && head === lastHead) return true;
    }
    if (meta.trackKey && this._isTrackOverused(meta.trackKey)) return true;
    const sampleCount = Math.min(10, this.items.length);
    for (let i = 0; i < sampleCount; i++) {
      const itemTokens = this.itemTokens[i] || [];
      if (hasRepeatingNGram(tokens, itemTokens, 3)) return true;
      if (hasRepeatingNGram(tokens, itemTokens, 4)) return true;
      if (similarity(tokens, itemTokens) > 0.62) return true;
    }
    return false;
  }

  pickKeyword(list) {
    if (!list || !list.length) return '';
    const recent = new Set(this.keywords);
    const filtered = list.filter(token => !recent.has(token));
    const pool = filtered.length ? filtered : list;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getReference(language) {
    if (!this.items.length || Math.random() > 0.15) return '';
    const pool = PAST_REFERENCES[language] || PAST_REFERENCES['en-US'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _rememberKeywords(list) {
    const next = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!next.length) return;
    next.forEach(token => {
      this.keywords.unshift(token);
    });
    this.keywords = Array.from(new Set(this.keywords)).slice(0, this.keywordLimit);
  }

  _rememberTrack(trackKey) {
    if (!trackKey) return;
    this.tracks.unshift(trackKey);
    this.tracks = this.tracks.slice(0, this.trackLimit);
  }

  _isTrackOverused(trackKey) {
    if (!trackKey || !this.tracks.length) return false;
    const recent = this.tracks.slice(0, 4);
    const count = recent.filter(item => item === trackKey).length;
    return count >= 2;
  }

  _load() {
    const stored = loadState(this.key, null);
    if (Array.isArray(stored)) {
      this.items = stored.slice(0, this.limit);
      this.itemTokens = this.items.map(item => tokenize(item));
      return;
    }
    if (stored && typeof stored === 'object') {
      this.items = Array.isArray(stored.items) ? stored.items.slice(0, this.limit) : [];
      this.itemTokens = this.items.map(item => tokenize(item));
      this.keywords = Array.isArray(stored.keywords) ? stored.keywords.slice(0, this.keywordLimit) : [];
      this.tracks = Array.isArray(stored.tracks) ? stored.tracks.slice(0, this.trackLimit) : [];
    }
  }

  _save() {
    saveState(this.key, {
      items: this.items,
      keywords: this.keywords,
      tracks: this.tracks,
    });
  }
}

/**
 * Controls language degradation level.
 */
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
    const sensitivity = clamp(context.degradationSensitivity ?? 1, 0.5, 2);
    target = clamp(target * sensitivity, 0, 1);
    this.level = lerp(this.level, target, clamp(dt * 0.4, 0.05, 0.35));
    return this.level;
  }

  apply(text, context) {
    if (!text) return text;
    let level = this.level;
    const style = context?.styleProfile;
    if (style?.fragmentationWeight) {
      level = clamp(level * style.fragmentationWeight, 0, 1);
    }
    const alienWeight = clamp(style?.alienInsertWeight ?? 1, 0.4, 1.6);
    if (context?.languageProfile === 'broken') level = clamp(level + 0.2, 0, 1);
    if (context?.languageProfile === 'alien-heavy') level = clamp(level + 0.35, 0, 1);
    const glitchActive = context?.glitchState?.activeGlitches?.length;
    if (glitchActive) level = clamp(level + 0.15, 0, 1);
    if (level <= 0.05) return text;
    const tokens = text.split(/\s+/);
    let output = tokens;
    if (level > 0.2 && output.length > 4) {
      const keep = Math.max(3, Math.floor(output.length * (1 - level * 0.4)));
      output = output.slice(0, keep);
    }
    output = output.map(token => {
      if (Math.random() < level * 0.18 * alienWeight) return pickAlienFragment(2);
      if (glitchActive && Math.random() < level * 0.12) return breakToken(token);
      return token;
    });
    let result = output.join(' ');
    if (level > 0.35 && Math.random() < level) {
      result = result.replace(/[.,]/g, '');
    }
    if (glitchActive && Math.random() < level) {
      result = result.replace(/[,:;]/g, '');
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

  pickComment(context, style = {}) {
    const base = this.pack.comments || [];
    const exhaustion = this.pack.exhaustionMarkers || [];
    const failure = this.pack.failureMarkers || [];
    const recovery = this.pack.repairMarkers || this.pack.recoveryMarkers || [];
    const diagnostics = this.pack.diagnosticsTokens || [];
    const idle = context.userInputEvents?.idle && this.config.idleMode;
    const personality = context.personality || {};
    const fatigue = clamp(personality.fatigue ?? 0.5, 0, 1);
    const irritation = clamp(personality.irritation ?? 0.4, 0, 1);
    const suspicion = clamp(personality.suspicion ?? 0.4, 0, 1);
    const sarcasmChance = clamp(
      (this.config.sarcasm || 0.6) * (style.sarcasmWeight ?? 1) * (1 + irritation * 0.45),
      0,
      1
    );
    const diagnosticsWeight = clamp((style.diagnosticsWeight ?? 0.6) * (1 + suspicion * 0.45), 0, 1.8);
    const exhaustionChance = clamp(0.2 + fatigue * 0.45, 0.2, 0.8);
    const selfCheckChance = clamp(style.selfCheckChance ?? 0, 0, 1);
    if (idle) {
      const idlePool = this.pack.idleFragments || base;
      return pick(idlePool);
    }
    if (context.systemState === 'RECOVERY' && recovery.length && Math.random() < 0.35 + selfCheckChance * 0.4) {
      return pick(recovery);
    }
    if ((context.systemState === 'OVERLOAD' || context.systemState === 'DEGRADED') && failure.length && Math.random() < 0.45) {
      return pick(failure);
    }
    if (diagnostics.length && Math.random() < diagnosticsWeight * 0.35) {
      return this._buildDiagnosticLine();
    }
    if (exhaustion.length && Math.random() < exhaustionChance) {
      return pick(exhaustion);
    }
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

  pickSarcasm(style = {}) {
    const sarcasmChance = clamp((this.config.sarcasm || 0.6) * (style.sarcasmWeight ?? 1), 0, 1);
    if (Math.random() > sarcasmChance) return '';
    return pick(this.pack.sarcasmMarkers || []);
  }

  pickConnective() {
    return pick(this.pack.connectives || []);
  }

  pickAlienFragment(profile, glitchState = {}, style = {}) {
    const activeBoost = glitchState.activeGlitches?.length ? 0.2 : 0;
    const bigBoost = glitchState.recentBigEvent ? 0.3 : 0;
    const weight = clamp(style.alienInsertWeight ?? 1, 0.35, 1.6);
    const boost = clamp((glitchState.alienAlphabetStrength ?? 0) * weight + activeBoost + bigBoost, 0, 1);
    if (profile === 'alien-heavy' || (profile === 'broken' && Math.random() < 0.5) || boost > 0.6) {
      return pickAlienFragment(3);
    }
    if (Math.random() < 0.2 + boost * 0.2) return pickAlienFragment(2);
    return '';
  }

  pickUncertain(style = {}) {
    const weight = clamp(style.uncertaintyWeight ?? 1, 0, 1);
    if (Math.random() > weight) return '';
    return pick(this.pack.uncertaintyMarkers || this.pack.sarcasmMarkers || []);
  }

  pickBroken(style = {}) {
    const weight = clamp(style.fragmentationWeight ?? 1, 0.4, 1.6);
    if (Math.random() > Math.min(1, weight)) return '';
    return pick(this.pack.glitchTokens || this.pack.brokenTokens || []);
  }

  pickAlienToken(style = {}) {
    const weight = clamp(style.alienInsertWeight ?? 1, 0, 1.2);
    if (Math.random() > Math.min(1, weight)) return '';
    return pick(this.pack.alienTokens || this.pack.alien_tokens || []);
  }

  _buildDiagnosticLine() {
    const diagnostics = this.pack.diagnosticsTokens || [];
    const commands = this.pack.commandTokens || [];
    const failure = this.pack.failureMarkers || [];
    const recovery = this.pack.recoveryMarkers || this.pack.repairMarkers || [];
    const head = pick(diagnostics) || 'diag';
    let tail = pick(commands);
    if (!tail && Math.random() < 0.5) tail = pick(failure);
    if (!tail) tail = pick(recovery);
    if (!tail) tail = pick(this.pack.comments || []);
    return `${head}: ${tail}`;
  }
}

/**
 * Semantic text generator with multi-mode output.
 */
export class SemanticEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.language = normalizeLanguage(this.config.language);
    this.lexiconPack = getLexiconPack(this.language);
    this.pack = mergePack(LANGUAGE_PACKS[this.language] || EN_PACK, this.lexiconPack);
    this.lexicon = buildLexicon(this.pack, this.lexiconPack);
    this.markov = new ThematicMarkov(3);
    this.planner = new IntentPlanner();
    this.grammar = new WeightedGrammar(this.pack, this.lexiconPack, { language: this.language });
    this.templateEngine = new TemplateEngine(this.pack);
    this.tone = new ToneController(this.pack, this.config);
    this.degradation = new DegradationController(this.config.degradationStrength);
    this.memory = new PhraseMemory(`${STORAGE_KEY}_${this.language}`, MEMORY_LIMIT, KEYWORD_MEMORY_LIMIT, TRACK_MEMORY_LIMIT);
    this.personality = new PersonalityState({ storageKey: `semantic_personality_${this.language}` });
    this.eventQueue = new EventQueue();
    this.nextAllowedAt = 0;
    this.nextAt = this._nextInterval(0.5);
    this.elapsed = 0;
    this.modeState = {
      mode: GENERATION_MODES.SMART,
      lastChangeAt: performance.now(),
      holdUntil: 0,
      robotStableAt: 0,
      robotExitAfterMs: 0,
      lowFpsSec: 0,
      lastDegradedNoticeAt: 0,
      pendingRobotNoticeAt: 0,
      pendingApology: false,
      forceRobotOnce: false,
      lastBigEventActive: false,
      lastIntent: '',
      lastEmittedAt: 0,
      lastText: '',
      glitchyStreak: 0,
      lastEventType: '',
      lastEventAt: 0,
    };
    this._candidatePool = buildCandidatePool(CANDIDATE_POOL_LIMIT);
    this._allocStats = { candidates: 0, grammar: 0, templates: 0, markov: 0 };
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
    this.lexiconPack = getLexiconPack(this.language);
    this.pack = mergePack(LANGUAGE_PACKS[this.language] || EN_PACK, this.lexiconPack);
    this.lexicon = buildLexicon(this.pack, this.lexiconPack);
    if (this.grammar) this.grammar.updatePack(this.pack, this.lexiconPack, this.language);
    this.templateEngine = new TemplateEngine(this.pack);
    this.tone = new ToneController(this.pack, this.config);
    this.memory = new PhraseMemory(`${STORAGE_KEY}_${this.language}`, MEMORY_LIMIT, KEYWORD_MEMORY_LIMIT, TRACK_MEMORY_LIMIT);
    this.personality = new PersonalityState({ storageKey: `semantic_personality_${this.language}` });
    this._train();
  }

  resetTransient() {
    this.elapsed = 0;
    this.nextAt = this._nextInterval(0.5);
    if (this.degradation) this.degradation.level = 0;
    if (this.eventQueue) this.eventQueue.queue = [];
    this.nextAllowedAt = 0;
    this.modeState.mode = GENERATION_MODES.SMART;
    this.modeState.lastChangeAt = performance.now();
    this.modeState.holdUntil = 0;
    this.modeState.robotStableAt = 0;
    this.modeState.robotExitAfterMs = 0;
    this.modeState.lowFpsSec = 0;
    this.modeState.lastDegradedNoticeAt = 0;
    this.modeState.pendingRobotNoticeAt = 0;
    this.modeState.pendingApology = false;
    this.modeState.forceRobotOnce = false;
    this.modeState.lastBigEventActive = false;
    this.modeState.lastIntent = '';
    this.modeState.lastEmittedAt = 0;
    this.modeState.lastText = '';
    this.modeState.glitchyStreak = 0;
    this.modeState.lastEventType = '';
    this.modeState.lastEventAt = 0;
    if (this._allocStats) {
      this._allocStats.candidates = 0;
      this._allocStats.grammar = 0;
      this._allocStats.templates = 0;
      this._allocStats.markov = 0;
    }
  }

  update(dt, context) {
    if (!this.config.enabled) return null;
    const now = performance.now();
    this.elapsed += dt;

    const baseContext = this._prepareContext(context, now);
    const personality = this.personality.update(dt, baseContext, this.modeState.mode);
    baseContext.personality = personality;
    baseContext.degradationSensitivity = this.config.degradationSensitivity;
    const level = this.degradation.update(dt, baseContext);
    baseContext.degradationLevel = level;

    this._ingestEvents(baseContext, now);
    const mode = this._computeMode(baseContext, now, dt);
    baseContext.generationMode = mode;

    const canEmit = now >= this.nextAllowedAt;
    if (canEmit) {
      const forced = this._resolveForcedOutput(baseContext, now);
      if (forced) {
        this._afterEmit(now, baseContext);
        return this._commitOutput(forced, baseContext);
      }
    }

    if (canEmit && this.eventQueue.has()) {
      const event = this.eventQueue.next();
      const eventContext = { ...baseContext, eventType: event.type, eventPayload: event.payload };
      const output = this._generateByMode(eventContext, level, mode, true);
      if (output) {
        this._afterEmit(now, eventContext);
        return this._commitOutput(output, eventContext);
      }
    }

    if (this.elapsed < this.nextAt || !canEmit) return null;
    const output = this._generateByMode(baseContext, level, mode, false);
    if (!output) return null;
    this._afterEmit(now, baseContext);
    return this._commitOutput(output, baseContext);
  }

  getDisplayState() {
    return this.degradation.getDisplayState();
  }

  _train() {
    const corpus = buildMarkovCorpus(this.lexiconPack, { language: this.language });
    const seed = this.pack.seedSentences || [];
    const base = seed.length ? [...seed, ...corpus.base] : corpus.base;
    this.markov.train(base, corpus.topics);
  }

  _prepareContext(context, now) {
    const base = context ? { ...context } : {};
    const glitch = base.glitchState || {};
    const activeCount = glitch.activeCount ?? (glitch.activeGlitches?.length || 0);
    const bigEventActive = glitch.bigEventActive ?? glitch.recentBigEvent ?? false;
    const textAlien = clamp(this.config.alienAlphabetStrength ?? 1, 0, 2);
    const glitchAlien = clamp(glitch.alienAlphabetStrength ?? 0.7, 0, 2);
    const combinedAlien = clamp(glitchAlien * textAlien, 0, 2);
    return {
      ...base,
      now,
      language: this.language,
      symbolSet: ALIEN_SYMBOLS,
      whiningIntensity: this.config.whiningIntensity,
      apologyEnabled: this.config.apologyEnabled,
      preemptiveWarnings: this.config.preemptiveWarnings,
      textModeStrategy: this.config.textModeStrategy,
      smartCandidateCount: this.config.smartCandidateCount,
      liveMetrics: {
        cpu: base.metrics?.cpu ?? null,
        gpu: base.metrics?.gpu ?? null,
        ram: base.metrics?.mem ?? null,
        temp: base.metrics?.cpu_temp ?? null,
        vram: base.metrics?.vram ?? null,
        down: base.metrics?.down ?? null,
        up: base.metrics?.up ?? null,
      },
      glitchState: {
        ...glitch,
        activeCount,
        bigEventActive,
        alienAlphabetStrength: combinedAlien,
      },
    };
  }

  _computeMode(context, now, dt) {
    const forced = this._resolveModeStrategy();
    const target = forced || this._computeTargetMode(context, dt);

    if (context.glitchState?.bigEventActive && !this.modeState.lastBigEventActive) {
      this.modeState.forceRobotOnce = true;
    }
    this.modeState.lastBigEventActive = !!context.glitchState?.bigEventActive;

    const current = this.modeState.mode;
    if (forced && forced !== current) {
      this._setMode(forced, now);
      return this.modeState.mode;
    }

    if (current === GENERATION_MODES.DUMB_ROBOT && target !== GENERATION_MODES.DUMB_ROBOT) {
      if (!this.modeState.robotStableAt) {
        this.modeState.robotStableAt = now;
        this.modeState.robotExitAfterMs = randRange(ROBOT_EXIT_MIN_SEC * 1000, ROBOT_EXIT_MAX_SEC * 1000);
      }
      if (now - this.modeState.robotStableAt < this.modeState.robotExitAfterMs) {
        return current;
      }
    } else if (target === GENERATION_MODES.DUMB_ROBOT) {
      this.modeState.robotStableAt = 0;
    }

    if (target !== current) {
      if (now < this.modeState.holdUntil) return current;
      this._setMode(target, now);
    }
    return this.modeState.mode;
  }

  _computeTargetMode(context, dt) {
    const systemState = context.systemState || 'STABLE';
    const metrics = context.metrics || {};
    const performanceState = context.performanceState || {};
    const glitch = context.glitchState || {};
    const entropy = clamp(context.entropyLevel ?? 0.4, 0, 1);

    const robotScale = clamp(this.config.robotModeThreshold ?? 1, 0.5, 2);
    const cpuThreshold = 90 / robotScale;
    const gpuThreshold = 95 / robotScale;
    const memThreshold = 94 / robotScale;
    const fpsThreshold = 18 * robotScale;
    const stallThresholdMs = 650;

    const cpu = metrics.cpu ?? metrics.cpuUsage ?? metrics.cpuPercent;
    const gpu = metrics.gpu ?? metrics.gpuUsage ?? metrics.gpuPercent;
    const mem = metrics.mem ?? metrics.memUsage ?? metrics.memPercent;
    const fps = performanceState.fpsEstimate ?? performanceState.fps ?? 60;
    const frameMs = performanceState.lastFrameDeltaMs ?? 0;
    const watchdogNearStall = frameMs > stallThresholdMs;

    if (fps < fpsThreshold) {
      this.modeState.lowFpsSec += dt;
    } else {
      this.modeState.lowFpsSec = 0;
    }

    const overload = systemState === 'OVERLOAD' || systemState === 'DEGRADED';
    const hasHeavyLoad =
      (Number.isFinite(cpu) && cpu > cpuThreshold) ||
      (Number.isFinite(gpu) && gpu > gpuThreshold) ||
      (Number.isFinite(mem) && mem > memThreshold);
    const lowFps = this.modeState.lowFpsSec > 3.5;
    const severeFps = Number.isFinite(fps) && fps < fpsThreshold * 0.75;
    const longLowFps = this.modeState.lowFpsSec > 5;
    const heavyCombo = hasHeavyLoad && (lowFps || watchdogNearStall);
    const overloadCombo = overload && (hasHeavyLoad || lowFps || watchdogNearStall);

    if (overloadCombo || heavyCombo || (longLowFps && severeFps)) {
      return GENERATION_MODES.DUMB_ROBOT;
    }

    const sensitivity = clamp(this.config.degradationSensitivity ?? 1, 0.5, 2);
    const entropyThreshold = 0.75 / sensitivity;
    const glitchThreshold = 1.1 / sensitivity;
    const glitchIntensity = glitch.glitchIntensity ?? 1;
    const activeGlitches = glitch.activeCount ?? 0;

    if (
      systemState === 'DEGRADED' ||
      systemState === 'ANOMALY' ||
      entropy > entropyThreshold ||
      (activeGlitches >= 2 && glitchIntensity > glitchThreshold)
    ) {
      return GENERATION_MODES.DEGRADED_MARKOV;
    }

    return GENERATION_MODES.SMART;
  }

  _resolveModeStrategy() {
    const strategy = this.config.textModeStrategy || 'auto';
    if (strategy === 'force_smart') return GENERATION_MODES.SMART;
    if (strategy === 'force_markov') return GENERATION_MODES.DEGRADED_MARKOV;
    if (strategy === 'force_robot') return GENERATION_MODES.DUMB_ROBOT;
    return null;
  }

  _setMode(nextMode, now) {
    const prev = this.modeState.mode;
    this.modeState.mode = nextMode;
    this.modeState.lastChangeAt = now;
    this.modeState.holdUntil = now + randRange(MODE_HOLD_MIN_SEC * 1000, MODE_HOLD_MAX_SEC * 1000);
    if (nextMode === GENERATION_MODES.DUMB_ROBOT && prev !== nextMode) {
      this.modeState.pendingRobotNoticeAt = now + randRange(5000, 15000);
      this.modeState.pendingApology = false;
      this.personality.markRobotUsed();
    }
    if (prev === GENERATION_MODES.DUMB_ROBOT && nextMode !== GENERATION_MODES.DUMB_ROBOT) {
      this.modeState.pendingApology = true;
    }
    if (nextMode === GENERATION_MODES.DEGRADED_MARKOV && prev !== nextMode) {
      this.modeState.lastDegradedNoticeAt = 0;
    }
  }

  _resolveForcedOutput(context, now) {
    const mode = context.generationMode || this.modeState.mode;
    if (mode === GENERATION_MODES.DUMB_ROBOT && this.modeState.pendingRobotNoticeAt) {
      if (now >= this.modeState.pendingRobotNoticeAt) {
        this.modeState.pendingRobotNoticeAt = 0;
        const notice = this._applyGlitchLanguage(generateRobotMessage(context, { type: 'notice' }), context);
        return {
          text: notice,
          intent: INTENTS.SELF_DIAG,
          mode: GENERATION_MODES.DUMB_ROBOT,
        };
      }
    }

    if (this.modeState.pendingApology && this.config.apologyEnabled) {
      this.modeState.pendingApology = false;
      this.personality.markApology();
      const apology = this._applyGlitchLanguage(generateRobotMessage(context, { type: 'apology' }), context);
      return {
        text: apology,
        intent: INTENTS.RECOVERY_NOTE,
        mode: context.generationMode || this.modeState.mode,
      };
    }

    if (this.modeState.forceRobotOnce && !context.glitchState?.bigEventActive) {
      this.modeState.forceRobotOnce = false;
    }
    if (this.modeState.forceRobotOnce && mode !== GENERATION_MODES.DUMB_ROBOT) {
      this.modeState.forceRobotOnce = false;
      const notice = this._applyGlitchLanguage(generateRobotMessage(context, { type: 'notice' }), context);
      return {
        text: notice,
        intent: INTENTS.ANOMALY_WARNING,
        mode: GENERATION_MODES.DUMB_ROBOT,
      };
    }
    return null;
  }

  _generateByMode(context, degradationLevel, mode, fromEvent = false) {
    if (mode === GENERATION_MODES.DUMB_ROBOT) return this._generateRobot(context);
    if (mode === GENERATION_MODES.DEGRADED_MARKOV) return this._generateDegraded(context, degradationLevel);
    return this._generateSmart(context, degradationLevel, fromEvent);
  }

  _generateSmart(context, degradationLevel, fromEvent = false) {
    const moodState = this._resolveMood(context);
    const styleProfile = this._resolveStyleProfile(context, moodState);
    const baseContext = {
      ...context,
      moodClass: moodState.moodClass,
      moodConfidence: moodState.confidence,
      moodStableForSec: moodState.moodStableForSec,
      moodAggressiveness: moodState.aggressiveness,
      styleProfile,
      minChars: styleProfile.minChars ?? MIN_CHARS,
      maxChars: styleProfile.maxChars ?? MAX_CHARS,
    };

    const eventInfo = this._resolveEventInfo(baseContext);
    const topicWeights = this._resolveTopicWeights(baseContext, eventInfo);
    const trackInfo = this._resolveTrackInfo(baseContext, eventInfo);
    const personality = baseContext.personality || {};

    const approach = this._isApproachingRobot(baseContext);
    const preemptive = this.planner.shouldPreemptive({
      ...baseContext,
      approachingRobot: approach,
      preemptiveWarnings: this.config.preemptiveWarnings,
    });
    const intentPlan = this.planner.plan({
      ...baseContext,
      eventType: eventInfo.type,
      preemptiveWarning: preemptive,
      coherence: personality.coherence,
      lastEventType: this.modeState.lastEventType,
      lastEventAt: this.modeState.lastEventAt,
      now: context.now ?? performance.now(),
    });
    const intent = intentPlan.intent;

    const generationContext = {
      ...baseContext,
      intent,
      topicWeights,
      trackInfo,
      eventType: eventInfo.type,
      eventPayload: eventInfo.payload,
      eventPhrase: eventInfo.phrase,
    };

    if (intent === INTENTS.PREEMPTIVE_WARNING) {
      const warning = this.grammar.generate({
        ...generationContext,
        maxChars: styleProfile.maxChars ?? MAX_CHARS,
        minChars: styleProfile.minChars ?? MIN_CHARS,
        personality,
        apologyEnabled: this.config.apologyEnabled,
        whiningIntensity: this.config.whiningIntensity,
      });
      if (warning?.text) {
        let text = this._applyGlitchLanguage(warning.text, generationContext, styleProfile);
        text = finalizeSentence(text, this.language, this.config.languageProfile, degradationLevel);
        return {
          text,
          intent,
          meta: warning.meta || {},
          mode: GENERATION_MODES.SMART,
        };
      }
    }

    const candidates = this._candidatePool;
    let candidateCount = 0;
    const baseCount = clamp(this.config.smartCandidateCount ?? 40, 10, 80);
    const fpsEstimate = context.performanceState?.fpsEstimate ?? 60;
    const frameMs = context.performanceState?.lastFrameDeltaMs ?? 16;
    let budgetScale = 1;
    if (fpsEstimate < 25) budgetScale = 0.5;
    else if (fpsEstimate < 35) budgetScale = 0.65;
    else if (fpsEstimate < 45) budgetScale = 0.8;
    if (frameMs > 60) budgetScale = Math.min(budgetScale, 0.65);
    const total = clamp(Math.round(baseCount * budgetScale), 8, baseCount);
    const grammarCount = Math.max(6, Math.round(total * 0.5));
    const templateCount = Math.max(4, Math.round(total * 0.3));
    const markovCount = Math.max(2, total - grammarCount - templateCount);
    let grammarMade = 0;
    let templateMade = 0;
    let markovMade = 0;
    const pushCandidate = (text, meta, source) => {
      if (!text || candidateCount >= candidates.length) return;
      const slot = candidates[candidateCount++];
      slot.text = text;
      slot.meta = meta || EMPTY_META;
      slot.source = source;
      slot.intent = intent;
      slot.tokens = null;
    };

    for (let i = 0; i < grammarCount && candidateCount < candidates.length; i++) {
      const cand = this.grammar.generate({
        ...generationContext,
        maxChars: styleProfile.maxChars ?? MAX_CHARS,
        minChars: styleProfile.minChars ?? MIN_CHARS,
        personality,
        apologyEnabled: this.config.apologyEnabled,
        whiningIntensity: this.config.whiningIntensity,
      });
      if (cand?.text) {
        grammarMade += 1;
        pushCandidate(cand.text, cand.meta, 'grammar');
      }
    }

    for (let i = 0; i < templateCount && candidateCount < candidates.length; i++) {
      const cand = this._buildPhrase(generationContext, degradationLevel, { skipFinalize: true });
      if (cand?.text) {
        templateMade += 1;
        pushCandidate(cand.text, cand.meta, 'template');
      }
    }

    const coherence = clamp(personality.coherence ?? 0.6, 0, 1);
    const markovChance = clamp(0.05 + (1 - coherence) * 0.2, 0.05, 0.18);
    if (Math.random() < markovChance) {
      const markovMeta = {
        keywords: trackInfo.keywords || EMPTY_META.keywords,
        trackKey: trackInfo.key || '',
      };
      for (let i = 0; i < markovCount && candidateCount < candidates.length; i++) {
        const phrase = this._buildMarkovPhrase(topicWeights, styleProfile);
        if (phrase) {
          markovMade += 1;
          pushCandidate(phrase, markovMeta, 'markov');
        }
      }
    }

    this._allocStats.candidates = candidateCount;
    this._allocStats.grammar = grammarMade;
    this._allocStats.templates = templateMade;
    this._allocStats.markov = markovMade;
    allocationDetector.record('textCandidates', candidateCount);

    const rerankOptions = {
      keywords: trackInfo.keywords || [],
      whineMarkers: this.pack.exhaustionMarkers || [],
      sarcasmMarkers: this.pack.sarcasmMarkers || [],
      uncertaintyMarkers: this.pack.uncertaintyMarkers || [],
      minChars: styleProfile.minChars ?? MIN_CHARS,
      maxChars: styleProfile.maxChars ?? MAX_CHARS,
    };
    let chosen = rerankCandidates(candidates, candidateCount, generationContext, personality, this.memory, rerankOptions);
    if (!chosen && candidateCount) chosen = candidates[0];
    if (!chosen || !chosen.text) return null;

    let text = chosen.text;
    text = this._applyGlitchLanguage(text, generationContext, styleProfile);
    text = finalizeSentence(text, this.language, this.config.languageProfile, degradationLevel);
    return {
      text,
      intent,
      meta: chosen.meta || { keywords: trackInfo.keywords || [], trackKey: trackInfo.key || '' },
      mode: GENERATION_MODES.SMART,
    };
  }

  _generateDegraded(context, degradationLevel) {
    const eventInfo = this._resolveEventInfo(context);
    const topicWeights = this._resolveTopicWeights(context, eventInfo);
    const trackInfo = this._resolveTrackInfo(context, eventInfo);
    const now = context.now ?? performance.now();
    if (this._shouldEmitDegradedNotice(now)) {
      this.modeState.lastDegradedNoticeAt = now;
      return {
        text: getDegradedNotice(this.language),
        intent: INTENTS.SELF_DIAG,
        meta: { keywords: [], trackKey: '' },
        mode: GENERATION_MODES.DEGRADED_MARKOV,
      };
    }

    const degradedContext = {
      ...context,
      topicsWeights: topicWeights,
      trackInfo,
      symbolSet: ALIEN_SYMBOLS,
    };
    const result = generateDegradedMarkov(this.markov, degradedContext, { topicsWeights });
    if (!result?.text) return null;
    let text = result.text;
    text = this._applyGlitchLanguage(text, degradedContext, context.styleProfile);
    text = finalizeSentence(text, this.language, this.config.languageProfile, degradationLevel);
    return {
      text,
      intent: INTENTS.SELF_DIAG,
      meta: result.meta || {},
      mode: GENERATION_MODES.DEGRADED_MARKOV,
    };
  }

  _generateRobot(context) {
    let text = generateRobotMessage(context);
    if (!text) return null;
    text = this._applyGlitchLanguage(text, context);
    return {
      text,
      intent: INTENTS.SELF_DIAG,
      meta: { keywords: [], trackKey: '' },
      mode: GENERATION_MODES.DUMB_ROBOT,
    };
  }

  _shouldEmitDegradedNotice(now) {
    if (!this.modeState.lastDegradedNoticeAt) {
      const elapsed = now - this.modeState.lastChangeAt;
      return elapsed > randRange(DEGRADED_NOTICE_MIN_SEC * 1000, DEGRADED_NOTICE_MAX_SEC * 1000);
    }
    const next = randRange(DEGRADED_NOTICE_MIN_SEC * 1000, DEGRADED_NOTICE_MAX_SEC * 1000);
    return now - this.modeState.lastDegradedNoticeAt > next;
  }

  _isApproachingRobot(context) {
    const metrics = context.metrics || {};
    const performanceState = context.performanceState || {};
    const robotScale = clamp(this.config.robotModeThreshold ?? 1, 0.5, 2);
    const cpuThreshold = (90 / robotScale) * 0.92;
    const gpuThreshold = (95 / robotScale) * 0.92;
    const memThreshold = (94 / robotScale) * 0.92;
    const fpsThreshold = 18 * robotScale;
    const cpu = metrics.cpu ?? metrics.cpuUsage ?? metrics.cpuPercent;
    const gpu = metrics.gpu ?? metrics.gpuUsage ?? metrics.gpuPercent;
    const mem = metrics.mem ?? metrics.memUsage ?? metrics.memPercent;
    const fps = performanceState.fpsEstimate ?? performanceState.fps ?? 60;
    if (Number.isFinite(cpu) && cpu > cpuThreshold) return true;
    if (Number.isFinite(gpu) && gpu > gpuThreshold) return true;
    if (Number.isFinite(mem) && mem > memThreshold) return true;
    if (Number.isFinite(fps) && fps < fpsThreshold + 4) return true;
    return false;
  }

  _applyGlitchLanguage(text, context, style = {}) {
    if (!text) return text;
    const glitch = context.glitchState || {};
    const active = glitch.activeCount || 0;
    const big = glitch.bigEventActive || glitch.recentBigEvent;
    if (!active && !big) {
      this.modeState.glitchyStreak = 0;
      return text;
    }
    if (this.modeState.glitchyStreak >= 2 && Math.random() < 0.8) return text;

    const heavy = active >= 2 || big;
    const strength = clamp((glitch.glitchIntensity ?? 1) * (heavy ? 1.15 : 1), 0.6, 2);
    const allow = this.modeState.lastText && this.modeState.lastText !== text;
    if (!allow && Math.random() < 0.5) return text;

    let result = text;
    let mutated = false;
    if (Math.random() < 0.2 + strength * 0.1) {
      result = garbleToken(result);
      mutated = true;
    }
    if (Math.random() < 0.25 + strength * 0.15) {
      result = glitchTextPartial(result, clamp(0.2 + strength * 0.15, 0.2, 0.7));
      mutated = true;
    }
    if (Math.random() < 0.2 + strength * 0.1) {
      result = result.replace(/[,:;]/g, '');
      mutated = true;
    }
    if (mutated) this.modeState.glitchyStreak += 1;
    else this.modeState.glitchyStreak = 0;
    return result.trim();
  }

  _commitOutput(result, context) {
    if (!result?.text) return null;
    const mode = result.mode || context.generationMode || this.modeState.mode;
    const intent = result.intent || INTENTS.SYSTEM_COMMENT;
    const meta = result.meta || {};
    if (!this.memory.isTooSimilar(result.text, meta)) {
      this.memory.add(result.text, meta);
    }
    this.modeState.lastIntent = intent;
    this.modeState.lastText = result.text;
    this.modeState.lastEmittedAt = context.now ?? performance.now();
    return { text: result.text, mode, intent };
  }

  getDebugInfo() {
    return {
      mode: this.modeState.mode,
      lastIntent: this.modeState.lastIntent,
      lastText: this.modeState.lastText,
      lastEmittedAt: this.modeState.lastEmittedAt,
      sinceModeChangeSec: (performance.now() - this.modeState.lastChangeAt) / 1000,
      allocations: this._allocStats,
    };
  }

  _resolveMood(context) {
    const moodData = context?.musicContext?.mood || {};
    const rawClass = context?.moodClass || moodData.moodClass || 'steady';
    const moodClass = this.config.moodReactiveText ? rawClass : 'steady';
    return {
      moodClass,
      confidence: moodData.confidence ?? 0,
      moodStableForSec: moodData.moodStableForSec ?? 0,
      aggressiveness: context?.moodAggressiveness ?? moodData.features?.aggressiveness ?? 1,
    };
  }

  _resolveStyleProfile(context, moodState) {
    const moodClass = moodState?.moodClass || 'steady';
    const base = STYLE_PROFILES[moodClass] || STYLE_PROFILES.steady;
    const aggressiveness = clamp(moodState?.aggressiveness ?? 1, 0.5, 2);
    const style = {
      ...base,
      verbosityTarget: { ...base.verbosityTarget },
      selfCheckChance: 0,
    };

    style.sarcasmWeight = scaleFromNeutral(base.sarcasmWeight, aggressiveness, 0.2, 1.5);
    style.fragmentationWeight = scaleFromNeutral(base.fragmentationWeight, aggressiveness, 0.4, 1.7);
    style.alienInsertWeight = scaleFromNeutral(base.alienInsertWeight, aggressiveness, 0.4, 1.7);
    style.diagnosticsWeight = scaleFromNeutral(base.diagnosticsWeight, aggressiveness, 0.3, 1.8);
    style.uncertaintyWeight = scaleFromNeutral(base.uncertaintyWeight, aggressiveness, 0.2, 1.3);
    style.verbosityTarget.extraChance = clamp(
      base.verbosityTarget.extraChance * (2 - aggressiveness * 0.6),
      0.08,
      0.5
    );
    const textAlien = clamp(this.config.alienAlphabetStrength ?? 1, 0, 2);
    style.alienInsertWeight = clamp(style.alienInsertWeight * textAlien, 0.3, 2.4);

    const systemState = context.systemState || 'STABLE';
    if (systemState === 'OVERLOAD' || systemState === 'DEGRADED' || systemState === 'ANOMALY') {
      style.fragmentationWeight = clamp(style.fragmentationWeight + 0.2, 0.4, 1.8);
      style.alienInsertWeight = clamp(style.alienInsertWeight + 0.15, 0.4, 1.8);
      style.diagnosticsWeight = clamp(style.diagnosticsWeight + 0.15, 0.3, 1.9);
      style.verbosityTarget.extraChance = clamp(style.verbosityTarget.extraChance * 0.75, 0.05, 0.4);
    }
    if (systemState === 'RECOVERY') {
      style.fragmentationWeight = clamp(style.fragmentationWeight * 0.75, 0.3, 1.4);
      style.alienInsertWeight = clamp(style.alienInsertWeight * 0.7, 0.3, 1.4);
      style.diagnosticsWeight = clamp(style.diagnosticsWeight + 0.2, 0.3, 1.9);
      style.selfCheckChance = 0.35;
    }

    const personality = context.personality || {};
    const fatigue = clamp(personality.fatigue ?? 0.5, 0, 1);
    const irritation = clamp(personality.irritation ?? 0.4, 0, 1);
    const suspicion = clamp(personality.suspicion ?? 0.4, 0, 1);
    const coherence = clamp(personality.coherence ?? 0.6, 0, 1);

    const lengthFactor = clamp(1 + (0.5 - fatigue) * 0.25 + (coherence - 0.5) * 0.2, 0.75, 1.2);
    style.verbosityTarget.minWords = clamp(Math.round(style.verbosityTarget.minWords * lengthFactor), 3, 10);
    style.verbosityTarget.maxWords = clamp(
      Math.round(style.verbosityTarget.maxWords * lengthFactor),
      style.verbosityTarget.minWords,
      12
    );
    style.verbosityTarget.extraChance = clamp(
      style.verbosityTarget.extraChance * (1 + (0.5 - fatigue) * 0.35),
      0.05,
      0.6
    );
    style.minChars = clamp(Math.round((style.minChars ?? MIN_CHARS) * lengthFactor), 16, 32);

    const breakBoost = (1 - coherence) * 0.45;
    style.fragmentationWeight = clamp(style.fragmentationWeight + breakBoost + irritation * 0.12, 0.3, 2);
    style.alienInsertWeight = clamp(style.alienInsertWeight + breakBoost * 0.6, 0.3, 2.4);
    style.sarcasmWeight = clamp(style.sarcasmWeight + irritation * 0.25, 0.2, 1.8);
    style.diagnosticsWeight = clamp(style.diagnosticsWeight + suspicion * 0.2, 0.3, 2);
    style.uncertaintyWeight = clamp(style.uncertaintyWeight + suspicion * 0.2, 0.2, 1.6);

    return style;
  }

  _generate(context, degradationLevel) {
    const attempts = 6;
    const moodState = this._resolveMood(context);
    const styleProfile = this._resolveStyleProfile(context, moodState);
    const minChars = styleProfile.minChars ?? MIN_CHARS;
    const maxChars = styleProfile.maxChars ?? MAX_CHARS;
    const baseContext = {
      ...context,
      moodClass: moodState.moodClass,
      moodConfidence: moodState.confidence,
      moodStableForSec: moodState.moodStableForSec,
      moodAggressiveness: moodState.aggressiveness,
      styleProfile,
    };
    for (let i = 0; i < attempts; i++) {
      const result = this._buildPhrase(baseContext, degradationLevel);
      if (!result) continue;
      const phrase = result.text;
      if (!phrase) continue;
      if (phrase.length < minChars || phrase.length > maxChars) continue;
      if (this.memory.isTooSimilar(phrase, result.meta)) continue;
      this.memory.add(phrase, result.meta);
      return phrase;
    }
    return null;
  }

  _buildPhrase(context, degradationLevel, options = {}) {
    if (context.glitchState?.recentBigEvent && Math.random() < 0.22) {
      const fragments = [];
      const count = 6 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        fragments.push(pickAlienFragment(3 + (i % 2)));
      }
      return { text: fragments.join(' '), meta: {} };
    }

    const eventInfo = this._resolveEventInfo(context);
    const topicWeights = this._resolveTopicWeights(context, eventInfo);
    const style = context.styleProfile || {};
    const markovPhrase = this._buildMarkovPhrase(topicWeights, style);
    const tags = this._buildTags(context, eventInfo);
    const trackInfo = this._resolveTrackInfo(context, eventInfo);
    const keywordPool = trackInfo.keywords || [];
    let keywordUsed = '';
    let trackUsed = false;
    const past = this.memory.getReference(this.language);
    const profile = this.config.languageProfile;

    const slots = {
      STATUS: () => this.tone.pickStatus(context.systemState),
      COMMENT: () => this.tone.pickComment(context, style),
      SYSTEM_ENTITY: () => this.tone.pickEntity(),
      ADJECTIVE: () => this.tone.pickAdjective(),
      VERB: () => this.tone.pickVerb(),
      CONNECTIVE: () => this.tone.pickConnective(),
      SARCASM: () => this.tone.pickSarcasm(style),
      MARKOV_PHRASE: () => markovPhrase,
      EVENT_PHRASE: () => eventInfo.phrase || this.tone.pickComment(context, style),
      PAST_REFERENCE: () => past || this.tone.pickComment(context, style),
      ALIEN_FRAGMENT: () => this.tone.pickAlienFragment(profile, context.glitchState, style),
      TRACK: () => {
        trackUsed = true;
        return this._formatTrack(trackInfo.title, context);
      },
      ARTIST: () => {
        trackUsed = true;
        return this._formatTrack(trackInfo.artist, context, 40);
      },
      KEYWORD: () => {
        if (!keywordPool.length) return '';
        if (!keywordUsed) keywordUsed = this.memory.pickKeyword(keywordPool);
        return keywordUsed;
      },
      TOPIC_PHRASE: () => this._pickTopicPhrase(topicWeights),
      UNCERTAIN: () => this.tone.pickUncertain(style),
      BROKEN: () => this._pickBroken(context, style),
      ALIEN: () => this._pickAlienToken(context, style),
      LIVE_DATA: () => this._pickLiveDataPhrase(context),
    };

    const templateContext = {
      ...context,
      eventActive: !!eventInfo.phrase,
      eventType: eventInfo.type,
      tags,
      keywordCount: keywordPool.length,
    };
    let sentence = this.templateEngine.render(templateContext, slots);
    if (!sentence) return null;
    const extraChance = clamp(
      (this.config.verbosity - 0.6) * (style.verbosityTarget?.extraChance ?? 0.3),
      0,
      0.5
    );
    if (Math.random() < extraChance) {
      sentence = `${sentence} ${this._buildMarkovPhrase(topicWeights, style)}`.trim();
    }
    if (eventInfo.phrase && Math.random() < 0.35) {
      sentence = `${eventInfo.phrase}. ${sentence}`.trim();
    }
    sentence = enforceLength(sentence, style.maxChars);
    sentence = this.degradation.apply(sentence, { ...context, languageProfile: profile });
    if (!options.skipFinalize) {
      sentence = finalizeSentence(sentence, this.language, this.config.languageProfile, degradationLevel);
    }
    return {
      text: sentence,
      meta: {
        keywords: keywordUsed ? [keywordUsed] : [],
        trackKey: trackUsed ? trackInfo.key : '',
      },
    };
  }

  _pickLiveDataPhrase(context) {
    const phrases = this.pack.liveDataPhrases || [];
    if (!phrases.length) return '';
    const m = context.liveMetrics || {};
    const fmt = n => (n != null && Number.isFinite(n)) ? Math.round(n) : null;
    const cpu = fmt(m.cpu);
    const ram = fmt(m.ram);
    const gpu = fmt(m.gpu);
    const temp = fmt(m.temp);
    const vram = fmt(m.vram);
    const down = m.down || null;
    const up = m.up || null;
    const usable = phrases.filter(p => {
      if (p.includes('{cpu}') && cpu == null) return false;
      if (p.includes('{ram}') && ram == null) return false;
      if (p.includes('{gpu}') && gpu == null) return false;
      if (p.includes('{temp}') && temp == null) return false;
      if (p.includes('{vram}') && vram == null) return false;
      if (p.includes('{down}') && down == null) return false;
      if (p.includes('{up}') && up == null) return false;
      return true;
    });
    if (!usable.length) return '';
    const comment = this.tone.pickComment(context, context.styleProfile || {});
    let phrase = usable[Math.floor(Math.random() * usable.length)];
    phrase = phrase
      .replace('{cpu}', cpu)
      .replace('{ram}', ram)
      .replace('{gpu}', gpu)
      .replace('{temp}', temp)
      .replace('{vram}', vram)
      .replace('{down}', down)
      .replace('{up}', up)
      .replace('{comment}', comment);
    return phrase;
  }

  _buildMarkovPhrase(topicWeights, style = {}) {
    const minWords = clamp(style.verbosityTarget?.minWords ?? MIN_WORDS, MIN_WORDS, MAX_WORDS);
    const maxWords = clamp(style.verbosityTarget?.maxWords ?? MAX_WORDS, minWords, MAX_WORDS);
    const maxChars = style.maxChars ?? MAX_CHARS;
    const phrase = this.markov.generate({
      topicsWeights: topicWeights,
      minWords,
      maxWords,
      maxChars,
    });
    return phrase ? capitalize(phrase) : '';
  }

  _afterEmit(now, context) {
    this.elapsed = 0;
    this.nextAt = this._nextInterval(context.entropyLevel ?? 0.4, context);
    this.nextAllowedAt = now + randRange(EVENT_RATE_MIN_MS, EVENT_RATE_MAX_MS);
  }

  _ingestEvents(context, now) {
    if (!context) return;
    const systemEvents = context.systemEvents || {};
    Object.keys(systemEvents).forEach(key => {
      const value = systemEvents[key];
      if (!value) return;
      const type = normalizeEventType(key);
      if (!type) return;
      const payload = value && typeof value === 'object' && !Array.isArray(value) ? value.payload || value : null;
      const enriched =
        type === 'TRACK_CHANGE' && !payload && context.musicContext?.novelty?.isNewTrack
          ? this._buildTrackPayload(context.musicContext)
          : payload;
      if (this.eventQueue.enqueue(type, enriched, now)) {
        // Track the most recent non-track event for narrative arc
        if (type !== 'TRACK_CHANGE' && type !== 'USER_WAKE' && type !== 'RAPID_CLICKS') {
          this.modeState.lastEventType = type;
          this.modeState.lastEventAt = now;
        }
      }
    });

    const inputEvents = context.userInputEvents || {};
    if (inputEvents.wake || inputEvents.firstClickAfterIdle) {
      this.eventQueue.enqueue('USER_WAKE', null, now);
    }
    if (inputEvents.rapidClicks) {
      this.eventQueue.enqueue('RAPID_CLICKS', null, now);
    }
    if (context.musicContext?.novelty?.isNewTrack) {
      this.eventQueue.enqueue('TRACK_CHANGE', this._buildTrackPayload(context.musicContext), now);
    }
  }

  _resolveEventInfo(context) {
    const type = context.eventType;
    const payload = context.eventPayload || null;
    const phrase =
      (type ? pickEventPhraseByType(type, this.pack.eventPhrases) : '') ||
      pickEventPhrase(context.systemEvents, this.pack.eventPhrases) ||
      pickEventPhrase(context.userInputEvents, this.pack.userEventPhrases);
    return { type, payload, phrase };
  }

  _resolveTopicWeights(context, eventInfo) {
    const base = {};
    MUSIC_TOPICS.forEach(topic => {
      base[topic] = context.musicContext?.topicsWeights?.[topic] || 0;
    });
    const mood = context.moodClass || context.musicContext?.mood?.moodClass || context.musicContext?.trackMoodHint;
    if (mood === 'chaotic') {
      base.NOISE = Math.max(base.NOISE, 0) + 0.2;
      base.SIGNAL = Math.max(base.SIGNAL, 0) + 0.15;
    } else if (mood === 'tense') {
      base.SIGNAL = Math.max(base.SIGNAL, 0) + 0.1;
      base.DATA = Math.max(base.DATA, 0) + 0.1;
    } else if (mood === 'calm') {
      base.TIME = Math.max(base.TIME, 0) + 0.15;
      base.MEMORY = Math.max(base.MEMORY, 0) + 0.1;
    }
    if (eventInfo.payload?.topics) {
      MUSIC_TOPICS.forEach(topic => {
        const value = eventInfo.payload.topics[topic];
        if (value) base[topic] = Math.max(base[topic], value);
      });
    }
    if (context.systemState === 'OVERLOAD' || context.systemState === 'DEGRADED' || context.systemState === 'ANOMALY') {
      base.NOISE = Math.max(base.NOISE, 0) + 0.4;
      base.FAILURE = Math.max(base.FAILURE, 0) + 0.4;
    }
    if (context.systemState === 'RECOVERY' || eventInfo.type === 'RECOVERY') {
      base.RECOVERY = Math.max(base.RECOVERY, 0) + 0.6;
    }
    if (context.systemState === 'IDLE') {
      base.TIME = Math.max(base.TIME, 0) + 0.25;
    }
    if (context.glitchState?.activeGlitches?.length) {
      base.NOISE = Math.max(base.NOISE, 0) + 0.3;
      base.FAILURE = Math.max(base.FAILURE, 0) + 0.2;
    }
    if (context.audioState?.peak) {
      base.NOISE = Math.max(base.NOISE, 0) + 0.2;
      base.MUSIC = Math.max(base.MUSIC, 0) + 0.2;
    }
    if (context.userInputEvents?.wake) {
      base.HUMAN = Math.max(base.HUMAN, 0) + 0.2;
    }
    const maxScore = Math.max(...Object.values(base), 0);
    if (maxScore > 0) {
      Object.keys(base).forEach(key => {
        base[key] = clamp(base[key] / maxScore, 0, 1);
      });
    }
    return base;
  }

  _resolveTrackInfo(context, eventInfo) {
    const music = context.musicContext || {};
    const payload = eventInfo.payload || {};
    const title = payload.title || music.trackTitle || '';
    const artist = payload.artist || music.artistName || '';
    const keywords = payload.keywords || music.extractedKeywords || [];
    const key = title || artist ? `${title}::${artist}`.toLowerCase() : '';
    return {
      title,
      artist,
      key,
      keywords,
      hasData: !!(title || artist),
    };
  }

  _buildTags(context, eventInfo) {
    const tags = new Set();
    if (eventInfo.phrase) tags.add('event');
    if (eventInfo.type === 'TRACK_CHANGE') tags.add('track_change');
    if (eventInfo.type === 'RECOVERY') tags.add('recovery');
    const music = context.musicContext;
    if (music?.hasData) tags.add('track');
    if (music?.novelty?.isNewTrack) tags.add('track_change');
    if (music?.novelty?.isNewTrack && music?.novelty?.repeatsCount > 0) tags.add('repeat_track');
    if (music?.flags?.hasSymbols) tags.add('symbol_title');
    if (music?.flags?.hasCaps) tags.add('caps_title');
    if (music?.flags?.hasNumbers) tags.add('numbers_title');
    if (music?.flags?.veryLongTitle) tags.add('long_title');
    if (music?.flags?.veryShortTitle) tags.add('short_title');
    if (music?.flags?.hasFeat || music?.flags?.multiArtist) tags.add('feat');
    if (context.timeState?.isNight) tags.add('night');
    if (context.glitchState?.activeGlitches?.length) tags.add('glitch');
    if (context.systemState === 'RECOVERY') tags.add('recovery');
    if (context.systemState === 'ANOMALY' || context.systemState === 'DEGRADED') tags.add('anomaly');
    return tags;
  }

  _pickTopicPhrase(weights) {
    const entries = Object.entries(weights || {}).sort((a, b) => b[1] - a[1]);
    const top = entries[0]?.[1] ? entries[0][0] : 'MUSIC';
    const pool = this.pack.topicPhrases?.[top] || this.pack.topicPhrases?.MUSIC || [];
    return pick(pool) || '';
  }

  _formatTrack(text, context, maxLen = 60) {
    const safe = safeInsert(text, maxLen);
    if (!safe) return '';
    const strength = this._glitchStrength(context);
    const glitchActive = context.glitchState?.activeGlitches?.length || context.glitchState?.recentBigEvent;
    if (glitchActive && strength > 0.12 && Math.random() < strength) {
      return glitchTextPartial(safe, strength);
    }
    return safe;
  }

  _pickBroken(context, style = {}) {
    const token = this.tone.pickBroken(style);
    if (token) return token;
    return '';
  }

  _pickAlienToken(context, style = {}) {
    const token = this.tone.pickAlienToken(style);
    if (token) return token;
    return '';
  }

  _glitchStrength(context) {
    const glitch = context.glitchState || {};
    const active = glitch.activeGlitches?.length ? 0.3 : 0;
    const big = glitch.recentBigEvent ? 0.4 : 0;
    return clamp(this.degradation.level + active + big, 0, 1);
  }

  _buildTrackPayload(musicContext) {
    if (!musicContext) return null;
    return {
      title: musicContext.trackTitle || '',
      artist: musicContext.artistName || '',
      keywords: musicContext.extractedKeywords || [],
      topics: musicContext.topicsWeights || {},
    };
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

function buildLexicon(pack, lexiconPack) {
  const tokens = new Set();
  const baseWords = lexiconPack?.baseWords || {};
  Object.values(baseWords).forEach(list => {
    if (!Array.isArray(list)) return;
    list.forEach(word => tokens.add(word));
  });
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
  return Array.from(tokens);
}

function buildCandidatePool(size) {
  const pool = new Array(size);
  for (let i = 0; i < size; i++) {
    pool[i] = { text: '', meta: EMPTY_META, source: '', intent: '', tokens: null };
  }
  return pool;
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
  const keys = Object.keys(events).filter(key => {
    const value = events[key];
    if (!value) return false;
    if (!eventPhrases[key]) return false;
    if (value && typeof value === 'object' && value.active === false) return false;
    return true;
  });
  if (!keys.length) return '';
  const key = keys[Math.floor(Math.random() * keys.length)];
  const pool = eventPhrases[key];
  return pool ? pick(pool) : '';
}

function pickEventPhraseByType(type, eventPhrases) {
  if (!type || !eventPhrases) return '';
  const keys = EVENT_PHRASE_KEYS[type] || [];
  for (const key of keys) {
    const pool = eventPhrases[key];
    if (pool && pool.length) return pick(pool);
  }
  return '';
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

function enforceLength(text, maxLen = MAX_CHARS) {
  if (!text) return text;
  let result = text.trim();
  if (result.length > maxLen) {
    result = result.slice(0, maxLen);
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

export function normalizeText(text) {
  return normalizeSentence(text);
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

function safeInsert(text, maxLen = 60) {
  if (!text) return '';
  let value = String(text).replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length > maxLen) {
    value = value.slice(0, maxLen);
    value = value.replace(/[^\p{L}\p{N})\]]+$/gu, '').trim();
  }
  return value;
}

function glitchTextPartial(text, strength = 0.4) {
  if (!text) return text;
  const chars = text.split('');
  const count = Math.max(1, Math.floor(chars.length * 0.12 * strength));
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    const symbol = ALIEN_SYMBOLS[Math.floor(Math.random() * ALIEN_SYMBOLS.length)];
    if (symbol) chars[idx] = symbol;
  }
  if (strength > 0.5 && Math.random() < strength) {
    const cut = Math.max(2, Math.floor(chars.length * 0.85));
    chars.length = cut;
  }
  return chars.join('');
}

function garbleToken(text) {
  if (!text) return text;
  const chars = text.split('');
  const count = Math.max(1, Math.floor(chars.length * 0.02));
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    if (!chars[idx] || /\s/.test(chars[idx])) continue;
    if (Math.random() < 0.5) {
      chars[idx] = chars[idx].toUpperCase();
    } else {
      chars[idx] = pickAlienFragment(1) || chars[idx];
    }
  }
  return chars.join('');
}

function breakToken(token) {
  if (!token || token.length <= 3) return token;
  const cut = Math.max(2, Math.floor(token.length * (0.4 + Math.random() * 0.4)));
  return token.slice(0, cut);
}

function hasRepeatingNGram(aTokens, bTokens, size = 3) {
  if (aTokens.length < size || bTokens.length < size) return false;
  const set = new Set();
  for (let i = 0; i <= aTokens.length - size; i++) {
    set.add(aTokens.slice(i, i + size).join(' '));
  }
  for (let i = 0; i <= bTokens.length - size; i++) {
    if (set.has(bTokens.slice(i, i + size).join(' '))) return true;
  }
  return false;
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

function scaleFromNeutral(value, aggressiveness, min = 0, max = 2) {
  const scaled = 1 + (value - 1) * aggressiveness;
  return clamp(scaled, min, max);
}

function normalizeEventType(name) {
  return EVENT_TYPE_ALIASES[name] || null;
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
