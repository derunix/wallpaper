const EN_BASE = {
  nouns_system: [
    'signal', 'data', 'memory', 'cache', 'buffer', 'node', 'thread', 'core', 'module', 'channel',
    'kernel', 'daemon', 'sensor', 'matrix', 'grid', 'clock', 'packet', 'queue', 'protocol', 'stream',
    'relay', 'cluster', 'loop', 'state', 'context', 'ledger', 'index', 'checksum', 'payload', 'schema',
    'bridge', 'mesh', 'gate', 'aperture', 'monitor', 'probe', 'latency', 'jitter', 'drift', 'resonator',
    'watchdog', 'router', 'switch', 'fabric', 'trace', 'registry', 'signature', 'baseline', 'frame', 'bus',
    'link', 'process', 'driver', 'decoder', 'encoder', 'stack', 'heap', 'array', 'vector', 'channel',
  ],
  verbs_system: [
    'drifting', 'choking', 'retrying', 'pretending', 'recalculating', 'stalling', 'buffering', 'throttling',
    'bleeding', 'resetting', 'stuttering', 'misaligning', 'skipping', 'looping', 'fading', 'replaying',
    'scraping', 'crawling', 'smoothing', 'smearing', 'overheating', 'limiting', 'failing', 'restarting',
    'dropping', 'spiking', 'compressing', 'expanding', 'patching', 'queueing', 'fragmenting', 'corrupting',
    'detuning', 'resyncing', 'rerouting', 'freezing', 'sampling', 'hashing', 'diagnosing', 'leaking',
    'ghosting', 'glitching', 'stitching', 'draining', 'dimming', 'probing',
  ],
  adjectives: [
    'unstable', 'tired', 'noisy', 'obsolete', 'fragmented', 'nominal', 'overheated', 'brittle',
    'sluggish', 'misaligned', 'stale', 'hollow', 'blurred', 'delayed', 'intermittent', 'muted',
    'overclocked', 'underfed', 'saturated', 'skewed', 'faulty', 'suspect', 'spiky', 'flat',
    'degraded', 'compressed', 'volatile', 'dense', 'hazy', 'erratic', 'detuned', 'silent',
    'bent', 'thinned', 'shadowed', 'strained', 'tarnished', 'fraying', 'threadbare', 'leaky',
    'fractured', 'cold', 'hot', 'raw', 'pale', 'fuzzy', 'grainy', 'jittery', 'cracked', 'patched',
  ],
  adverbs: [
    'quietly', 'slowly', 'barely', 'reluctantly', 'softly', 'loudly', 'erratically', 'coldly',
    'patiently', 'roughly', 'faintly', 'briefly', 'silently', 'awkwardly', 'mechanically',
    'carelessly', 'grudgingly', 'vaguely', 'technically', 'openly',
  ],
  connectors: [
    'still', 'anyway', 'meanwhile', 'somehow', 'for now', 'in theory', 'in practice', 'at least',
    'probably', 'for once', 'if it holds', 'as if', 'for the record', 'on paper', 'for a moment',
    'without drama', 'with reluctance', 'in the meantime', 'in passing', 'as always',
  ],
  sarcasm_markers: [
    'apparently', 'again', 'as expected', 'of course', 'sure', 'naturally', 'fine', 'great',
    'wonderful', 'just perfect', 'how novel', 'if you say so', 'clearly', 'obviously',
    'what a surprise', 'predictably',
  ],
  exhaustion_markers: [
    'running low', 'barely awake', 'almost offline', 'running on fumes', 'sleep denied',
    'overdue for a reboot', 'low on patience', 'tired of this', 'exhausted', 'stretched thin',
  ],
  repair_markers: [
    'repairing', 'patching up', 'stitching', 'rebuilding', 'restarting', 'realigning', 'rebooting',
    'calibrating', 'restoring', 'resyncing', 'self-check', 'stabilizing',
  ],
  uncertainty_markers: [
    'maybe', 'probably', 'not sure', 'i think', 'if it holds', 'if we are lucky', 'unclear',
    'in theory', 'guessing', 'no guarantee', 'hard to tell',
  ],
  human_markers: [
    'human', 'operator', 'listener', 'hands', 'eyes', 'skin', 'breath', 'pulse',
    'habit', 'voice', 'attention', 'patience',
  ],
  time_markers: [
    'night', 'midnight', 'dawn', 'twilight', 'late', 'early', 'cycle', 'minute', 'hour',
    'second', 'drift', 'daybreak', 'after hours', 'today', 'yesterday', 'tomorrow', 'time', 'clock',
  ],
  weather_markers: [
    'rain', 'storm', 'fog', 'mist', 'snow', 'wind', 'thunder', 'ice', 'heat', 'cold',
    'humidity', 'cloud', 'overcast', 'lightning', 'drizzle',
  ],
  audio_markers: [
    'beat', 'rhythm', 'bass', 'echo', 'mix', 'track', 'signal', 'tone', 'frequency',
    'spectrum', 'noise', 'hiss', 'pulse', 'chord', 'tempo', 'loop', 'reverb', 'distortion',
  ],
  failure_markers: [
    'failure', 'error', 'fault', 'dropout', 'crash', 'overload', 'overflow', 'timeout',
    'corruption', 'drift', 'desync', 'stall', 'loss', 'rupture', 'collapse', 'panic',
  ],
  recovery_markers: [
    'recovery', 'restore', 'resume', 'stabilize', 'reboot', 'clean state', 'rebuild',
    'heal', 'reconnect', 'reset',
  ],
  glitch_tokens: [
    'glitch', 'tear', 'flicker', 'static', 'sync-loss', 'drop', 'noise', 'scramble',
    'shift', 'void', 'desync', 'artifact', 'fracture', 'bleed', 'gap', 'shiver',
  ],
  command_tokens: [
    'abort', 'retry', 'flush', 'rescan', 'reindex', 'override', 'checksum', 'rewind', 'lock',
    'unlock', 'trace', 'dump', 'ping', 'probe', 'isolate', 'patch', 'mute', 'resume', 'hold',
    'pause', 'sync',
  ],
  diagnostics_tokens: [
    'diag', 'telemetry', 'scan', 'probe', 'report', 'checksum', 'status', 'integrity', 'baseline',
    'threshold', 'signature', 'trace', 'watch', 'metric', 'sensor-readout', 'latency',
    'jitter', 'voltage', 'uptime',
  ],
};

const EN_EXPAND = {
  nounPrefixes: [
    'meta-', 'sub-', 'ultra-', 'pseudo-', 'nano-', 'micro-', 'hyper-', 'inter-', 'intra-',
    'proto-', 'auto-', 'semi-', 'anti-', 'cross-', 'post-', 'pre-', 'infra-', 'over-', 'under-',
  ],
  nounSuffixes: [
    '-core', '-node', '-mesh', '-loop', '-gate', '-layer', '-grid', '-array', '-vector', '-stack',
    '-field', '-zone', '-path', '-lock', '-bridge', '-trace', '-wave', '-band', '-rail', '-pulse',
    '-drive', '-frame', '-flux', '-shift', '-port', '-chain', '-pool', '-ring',
  ],
  verbPrefixes: ['re-', 'mis-', 'over-', 'under-', 'de-', 'un-', 'cross-', 'anti-', 'auto-'],
  adjPrefixes: ['over-', 'under-', 'mis-', 'post-', 'pre-', 'ultra-', 'quasi-'],
  adjSuffixes: ['-ish', '-bound', '-less', '-heavy', '-starved', '-rich', '-tuned', '-blind', '-thin'],
  advSuffixes: ['-ly'],
  alienRoots: [
    'xq', 'qv', 'zx', 'vr', 'ky', 'mn', 'rk', 'tn', 'hx', 'zz', 'kx', 'pv', 'rx',
    'gx', 'nv', 'wm', 'lk', 'sv', 'tz', 'vv', 'qq', 'xr', 'yk', 'qt', 'dv', 'mp',
  ],
  alienSuffixes: [
    '-0', '-1', '-2', '-3', '-7', '-9', '::', '//', '##', '~~', '??', '..', '++',
    '--', '==', '@@', '_x', '_k', '_v', '_z', '-core', '-node', '-gate', '-line', '-grid', '-x',
  ],
};

const RU_BASE = {
  nouns_system: [
    'сигнал', 'данные', 'память', 'процесс', 'кэш', 'связь', 'узел', 'буфер', 'поток', 'шина',
    'ядро', 'модуль', 'канал', 'решетка', 'регистр', 'интерфейс', 'сенсор', 'матрица', 'сетка',
    'осциллятор', 'таймер', 'порт', 'пакет', 'вектор', 'шлюз', 'очередь', 'контур', 'топология',
    'схема', 'сеть', 'лог', 'след', 'рутина', 'команда', 'стек', 'куча', 'адрес', 'драйвер',
    'кластер', 'контроллер', 'контекст', 'состояние', 'профиль', 'протокол', 'слот', 'переход',
    'датчик', 'трасса', 'мост', 'сборка', 'таблица', 'индекс', 'сигнатура',
  ],
  verbs_system: [
    'дрейфует', 'задыхается', 'пересчитывается', 'буксует', 'тормозит', 'плавает', 'пульсирует',
    'отваливается', 'срывается', 'зависает', 'забивается', 'подтекает', 'притворяется',
    'откатывается', 'перезапускается', 'дробится', 'размывается', 'проваливается', 'засоряется',
    'перегревается', 'компрессируется', 'разрежается', 'смазывается', 'глохнет', 'дребезжит',
    'мерцает', 'залипает', 'шипит', 'ломается', 'замирает', 'рвется', 'подвисает',
  ],
  adjectives: [
    'нестабильный', 'усталый', 'частичный', 'шумный', 'устаревший', 'фрагментированный',
    'номинальный', 'перегретый', 'ломкий', 'вязкий', 'смещенный', 'тусклый', 'нервный',
    'подозрительный', 'дрожащий', 'разреженный', 'потертый', 'сбитый', 'глухой',
    'плавающий', 'хрупкий', 'задыхающийся', 'перекошенный', 'блеклый', 'мутный',
    'плоский', 'кривой', 'рваный', 'зависший', 'изношенный', 'липкий',
  ],
  adverbs: [
    'тихо', 'медленно', 'едва', 'нехотя', 'мутно', 'глухо', 'ровно', 'неловко',
    'механически', 'резко', 'редко', 'почти', 'вяло',
  ],
  connectors: [
    'между тем', 'впрочем', 'в любом случае', 'так или иначе', 'пока', 'пожалуй', 'если что',
    'в теории', 'на практике', 'как ни странно', 'по привычке', 'в целом', 'в итоге',
  ],
  sarcasm_markers: [
    'конечно', 'как всегда', 'опять', 'ну да', 'разумеется', 'естественно', 'прекрасно',
    'великолепно', 'очень вовремя', 'как удобно', 'очевидно',
  ],
  exhaustion_markers: [
    'почти не жив', 'еле держусь', 'устал', 'на исходе', 'еле тяну', 'сплю на ходу',
    'на грани', 'почти оффлайн',
  ],
  repair_markers: [
    'чиню', 'подшиваю', 'собираю', 'перезапускаю', 'выравниваю', 'калибрую',
    'пересинхрон', 'самопроверка', 'стабилизация',
  ],
  uncertainty_markers: [
    'может быть', 'похоже', 'кажется', 'не уверен', 'в теории', 'как получится',
    'не факт', 'сомнительно', 'неясно',
  ],
  human_markers: ['человек', 'оператор', 'слушатель', 'руки', 'глаза', 'кожа', 'дыхание', 'пульс'],
  time_markers: ['ночь', 'полночь', 'рассвет', 'сумерки', 'поздно', 'рано', 'цикл', 'минута', 'час'],
  weather_markers: ['дождь', 'гроза', 'туман', 'снег', 'ветер', 'гром', 'молния', 'мороз', 'жара'],
  audio_markers: ['бит', 'ритм', 'бас', 'эхо', 'микс', 'трек', 'сигнал', 'тон', 'частота', 'шум'],
  failure_markers: ['ошибка', 'сбой', 'поломка', 'падение', 'крах', 'перегруз', 'таймаут', 'утечка'],
  recovery_markers: ['восстановление', 'возврат', 'перезапуск', 'стабилизация', 'починка', 'исправление'],
  glitch_tokens: ['глитч', 'разрыв', 'фликер', 'статика', 'десинк', 'шум', 'искажение', 'дрожь'],
  command_tokens: ['отмена', 'повтор', 'сброс', 'перезапуск', 'блок', 'разблок', 'пинг', 'проверка'],
  diagnostics_tokens: ['диагноз', 'телеметрия', 'скан', 'отчет', 'контроль', 'состояние', 'порог'],
};

const RU_EXPAND = {
  nounPrefixes: ['сверх-', 'квази-', 'ультра-', 'нано-', 'микро-', 'гипер-', 'суб-', 'интер-', 'псевдо-'],
  nounSuffixes: ['-ядро', '-узел', '-контур', '-канал', '-слой', '-матрица', '-шина', '-модуль'],
  verbPrefixes: ['пере-', 'недо-', 'псевдо-', 'пер-', 'сверх-'],
  adjPrefixes: ['псевдо-', 'полу-', 'сверх-', 'пер-', 'квази-'],
  adjSuffixes: ['-ватый', '-ной', '-ный', '-щий'],
  advSuffixes: ['-но'],
  alienRoots: ['хк', 'зц', 'кж', 'тн', 'рк', 'шв', 'чп', 'гф', 'цж', 'кх', 'вх'],
  alienSuffixes: ['-0', '-1', '-2', '::', '##', '--', '==', '_x', '_к', '_в', '-ядро', '-узел'],
};

const EN_TOPIC_PHRASES = {
  SIGNAL: ['signal holds', 'phase drifting', 'carrier unstable', 'frequency wavers', 'pulse misaligned', 'band noise'],
  DATA: ['data pooling', 'packet drift', 'queue swelling', 'checksum whisper', 'cache sweating', 'trace repeating'],
  MEMORY: ['memory echoes', 'archive groans', 'state sticks', 'cache remembers', 'ghosted record', 'history loops'],
  TIME: ['late cycle', 'minute slipping', 'clock stutters', 'time drifts', 'night extends', 'daybreak delayed'],
  WEATHER: ['rain in the line', 'fog on the grid', 'storm pressure', 'cold front', 'static air', 'wet signal'],
  NOISE: ['static rises', 'noise floor climbing', 'hiss in the bus', 'distortion bloom', 'glitch noise', 'grit layer'],
  CONTROL: ['control softens', 'limits argue', 'gate reluctant', 'throttle narrow', 'command delayed', 'override pending'],
  FAILURE: ['fault flagged', 'error breathes', 'fracture line', 'dropout noted', 'failure whisper', 'crash avoided'],
  RECOVERY: ['rebuild underway', 'patch settling', 'recovery slow', 'stability returning', 'resync routine', 'self-check'],
  HUMAN: ['human pulse', 'eyes on the log', 'breath in the loop', 'attention drifting', 'hands tired', 'voice fading'],
  MUSIC: ['beat intact', 'tempo wandering', 'track humming', 'bass creeping', 'mix unstable', 'melody thin'],
};

const RU_TOPIC_PHRASES = {
  SIGNAL: ['сигнал держится', 'фаза плывет', 'частота дрожит', 'пульс сбит', 'несущая шатается'],
  DATA: ['данные копятся', 'пакеты тянут', 'очередь пухнет', 'след повторяется', 'кэш потеет'],
  MEMORY: ['память эхом', 'архив скрипит', 'состояние липнет', 'кэш помнит', 'история кругом'],
  TIME: ['поздний цикл', 'минута скользит', 'часы кашляют', 'ночь тянется', 'время плывет'],
  WEATHER: ['дождь в линии', 'туман на сетке', 'давление растет', 'холодный фронт', 'сырой сигнал'],
  NOISE: ['шум растет', 'статика всплыла', 'шипение в шине', 'искажение разлилось', 'глитчовый фон'],
  CONTROL: ['контроль мягкий', 'лимиты спорят', 'затвор медлит', 'команда опаздывает', 'override в пути'],
  FAILURE: ['сбой отмечен', 'ошибка дышит', 'разлом рядом', 'падение рядом', 'отказ шепчет'],
  RECOVERY: ['сборка идет', 'патч садится', 'восстановление медленное', 'стабильность возвращается', 'самопроверка'],
  HUMAN: ['пульс жив', 'взгляд на лог', 'дыхание в петле', 'внимание дрейфует', 'руки устали'],
  MUSIC: ['бит держится', 'темп плавает', 'трек гудит', 'бас ползет', 'микс дрожит'],
};

function buildTemplateBank(language) {
  if (language === 'ru-RU') return buildTemplatesRu();
  return buildTemplatesEn();
}

function withMood(entries = [], mood) {
  return entries.map(entry => ({ ...entry, moods: [mood] }));
}

function buildMoodTemplatesEn() {
  const calm = [
    { template: 'quiet cycle. {COMMENT}' },
    { template: '{STATUS}. low drift.' },
    { template: 'soft state. {COMMENT}' },
    { template: 'signal steady enough. {UNCERTAIN}' },
    { template: 'no rush. {MARKOV_PHRASE}' },
    { template: '{CONNECTIVE}, the line is quiet.' },
    { template: '{TOPIC_PHRASE}. nothing urgent.' },
    { template: 'slow loop. {COMMENT}' },
    { template: 'calm feed: {TRACK}. {COMMENT}', requireTags: ['track'] },
    { template: 'soft input: {TRACK}.', weight: 1.1, requireTags: ['track_change'] },
    { template: 'now playing, quietly: {TRACK}.', requireTags: ['track'] },
    { template: '{TRACK}. low emphasis.', requireTags: ['track'] },
    { template: 'easy signal. {TRACK}. {UNCERTAIN}', requireTags: ['track'] },
    { template: 'still {TRACK}. {COMMENT}', requireTags: ['repeat_track'] },
    { template: 'repeat cycle, but soft: {TRACK}.', requireTags: ['repeat_track'] },
    { template: 'late hour. {TRACK}. {TOPIC_PHRASE}.', requireTags: ['night', 'track'] },
    { template: 'night drift: {TRACK}. {COMMENT}', requireTags: ['night', 'track'] },
    { template: 'after hours, {TRACK}.', requireTags: ['night', 'track'] },
    { template: '{KEYWORD} hums. {COMMENT}', requireTags: ['track'], minKeywords: 1 },
    { template: 'keyword in the margin: {KEYWORD}.', minKeywords: 1 },
    { template: 'track logged: {TRACK}. {TOPIC_PHRASE}.', requireTags: ['track'] },
    { template: 'soft reset. {TRACK} stays.', requireTags: ['track'] },
    { template: '{ARTIST} through a quiet filter.', requireTags: ['track'] },
    { template: 'signal breathes. {TRACK}.', requireTags: ['track'] },
    { template: 'no pressure. {TRACK}.', requireTags: ['track'] },
    { template: 'slow check: {TOPIC_PHRASE}.', requireTags: ['track'] },
    { template: 'calm log: {TRACK} // {COMMENT}', requireTags: ['track'] },
    { template: '{COMMENT}. {TRACK} still.', requireTags: ['repeat_track'] },
    { template: 'minimal noise. {TRACK} plays.', requireTags: ['track'] },
    { template: 'steady ear. {TRACK}.', requireTags: ['track'] },
    { template: 'quiet line, {TRACK}. {UNCERTAIN}', requireTags: ['track'] },
    { template: 'soft recovery. {TOPIC_PHRASE}.', requireTags: ['recovery'] },
  ];

  const steady = [
    { template: 'status nominal. {COMMENT}' },
    { template: 'system log: {MARKOV_PHRASE}' },
    { template: 'baseline holds. {COMMENT}' },
    { template: '{SYSTEM_ENTITY} {VERB}. {COMMENT}' },
    { template: '{CONNECTIVE}, {STATUS}.' },
    { template: 'process line: {TRACK}.', requireTags: ['track'] },
    { template: 'input tagged: {TRACK}.', weight: 1.1, requireTags: ['track_change'] },
    { template: '{TRACK} by {ARTIST}. logged.', requireTags: ['track'] },
    { template: 'signal says {TRACK}. {UNCERTAIN}', requireTags: ['track'] },
    { template: 'data listens to {TRACK}.', requireTags: ['track'] },
    { template: 'keyword: {KEYWORD}. {COMMENT}', minKeywords: 1 },
    { template: 'topic drift: {TOPIC_PHRASE}.', requireTags: ['track'] },
    { template: 'repeat noted: {TRACK}.', requireTags: ['repeat_track'] },
    { template: 'caps noted in {TRACK}. {SARCASM}', requireTags: ['caps_title'] },
    { template: 'symbol noise in {TRACK}.', requireTags: ['symbol_title'] },
    { template: 'multiple artists. {UNCERTAIN}', requireTags: ['feat'] },
    { template: 'night check: {TRACK}.', requireTags: ['night', 'track'] },
    { template: 'glitch overlay: {TRACK}.', requireTags: ['glitch', 'track'] },
    { template: 'post-recovery line. {TOPIC_PHRASE}.', requireTags: ['recovery'] },
    { template: 'state says {STATUS}. {COMMENT}' },
    { template: '{MARKOV_PHRASE}. {COMMENT}' },
    { template: '{COMMENT}. {MARKOV_PHRASE}' },
    { template: 'system entity: {SYSTEM_ENTITY}. {COMMENT}' },
    { template: 'signal stable enough. {TRACK}.', requireTags: ['track'] },
    { template: 'steady input: {TRACK}.', requireTags: ['track_change'] },
    { template: 'audio log: {TRACK}.', requireTags: ['track'] },
    { template: 'trace: {TRACK}.', requireTags: ['track'] },
    { template: 'line holds. {UNCERTAIN}' },
    { template: 'nominal feed. {COMMENT}' },
    { template: 'routine update. {TOPIC_PHRASE}.' },
    { template: 'diagnostic pass. {COMMENT}' },
    { template: 'nothing unexpected. {UNCERTAIN}' },
  ];

  const tense = [
    { template: 'pressure rising. {COMMENT}' },
    { template: 'retry budget thinning.' },
    { template: '{STATUS}. unstable margin.' },
    { template: '{SYSTEM_ENTITY} {VERB}. again.' },
    { template: 'input spikes: {TRACK}.', weight: 1.1, requireTags: ['track_change'] },
    { template: 'track under load: {TRACK}.', requireTags: ['track'] },
    { template: '{TRACK}. not helping.', requireTags: ['track'] },
    { template: 'signal jitter + {TRACK}.', requireTags: ['track'] },
    { template: 'keyword triggers: {KEYWORD}.', minKeywords: 1 },
    { template: 'control wavers. {UNCERTAIN}' },
    { template: 'noise in the line. {TRACK}.', requireTags: ['glitch', 'track'] },
    { template: 'saturation: {TRACK}.', requireTags: ['track'] },
    { template: 'caps and strain: {TRACK}.', requireTags: ['caps_title'] },
    { template: 'symbols and strain: {TRACK}.', requireTags: ['symbol_title'] },
    { template: 'feat overload: {ARTIST}.', requireTags: ['feat'] },
    { template: 'repeat loop. {TRACK}. again.', requireTags: ['repeat_track'] },
    { template: 'late hour, short fuse. {TRACK}.', requireTags: ['night', 'track'] },
    { template: 'recovery pending. {TOPIC_PHRASE}.', requireTags: ['recovery'] },
    { template: 'system says retry. {COMMENT}' },
    { template: 'signal tight. {MARKOV_PHRASE}' },
    { template: 'queue fights back. {COMMENT}' },
    { template: 'unsure but running. {UNCERTAIN}' },
    { template: 'tension in {TOPIC_PHRASE}.', requireTags: ['track'] },
    { template: 'drift climbing. {COMMENT}' },
    { template: 'buffer thin. {COMMENT}' },
    { template: 'control lag. {UNCERTAIN}' },
    { template: 'peak pressure. {TRACK}.', requireTags: ['track'] },
    { template: 'track flagged: {TRACK}.', requireTags: ['track'] },
    { template: '{TRACK} vs stability. stability wins.', requireTags: ['track'] },
    { template: 'music stress test: {TRACK}.', requireTags: ['track'] },
    { template: 'error budget whispers. {COMMENT}' },
    { template: 'retry loop: {MARKOV_PHRASE}.' },
  ];

  const chaotic = [
    { template: 'signal tear.' },
    { template: '{BROKEN} {COMMENT}' },
    { template: 'noise spike.' },
    { template: 'input rupture: {TRACK}.', weight: 1.1, requireTags: ['track_change'] },
    { template: 'new spike: {TRACK}.', weight: 1.05, requireTags: ['track_change'] },
    { template: '{ALIEN} {COMMENT}' },
    { template: 'desync. {MARKOV_PHRASE}' },
    { template: 'line fracture: {TRACK}.', requireTags: ['track'] },
    { template: '{TRACK} // {BROKEN}', requireTags: ['track'] },
    { template: 'track cut: {TRACK}.', requireTags: ['track'] },
    { template: 'glitch in {TRACK}.', requireTags: ['glitch', 'track'] },
    { template: 'chaos feed: {TRACK}.', requireTags: ['track'] },
    { template: '{TRACK}. snap.', requireTags: ['track'] },
    { template: '{TRACK}. signal lost.', requireTags: ['track'] },
    { template: '{KEYWORD}. rupture.', minKeywords: 1 },
    { template: 'repeat loop breaks: {TRACK}.', requireTags: ['repeat_track'] },
    { template: 'caps scream: {TRACK}.', requireTags: ['caps_title'] },
    { template: 'symbols scream: {TRACK}.', requireTags: ['symbol_title'] },
    { template: 'feat spill. {ARTIST}.', requireTags: ['feat'] },
    { template: 'night noise: {TRACK}.', requireTags: ['night', 'track'] },
    { template: '{BROKEN} {TRACK} {BROKEN}', requireTags: ['glitch', 'track'] },
    { template: '{ALIEN} {TRACK}', requireTags: ['glitch', 'track'] },
    { template: 'panic buffer. {COMMENT}' },
    { template: 'control drop. {COMMENT}' },
    { template: 'recovery lag. {UNCERTAIN}', requireTags: ['recovery'] },
    { template: '{TOPIC_PHRASE}. cut short.', requireTags: ['track'] },
    { template: 'signal shiver. {TOPIC_PHRASE}.', requireTags: ['track'] },
    { template: 'short burst. {COMMENT}' },
    { template: 'tear in audio. {TRACK}.', requireTags: ['track'] },
    { template: 'noise flood. {TRACK}.', requireTags: ['track'] },
    { template: 'track fragment: {TRACK}.', requireTags: ['track'] },
    { template: 'stuttered input. {TRACK}.', requireTags: ['track'] },
    { template: 'system fracture. {MARKOV_PHRASE}' },
    { template: '{MARKOV_PHRASE}. {BROKEN}' },
  ];

  return [
    ...withMood(calm, 'calm'),
    ...withMood(steady, 'steady'),
    ...withMood(tense, 'tense'),
    ...withMood(chaotic, 'chaotic'),
  ];
}

function buildMoodTemplatesRu() {
  const calm = [
    { template: 'тихий цикл. {COMMENT}' },
    { template: '{STATUS}. низкий дрейф.' },
    { template: 'мягкое состояние. {COMMENT}' },
    { template: 'сигнал ровный. {UNCERTAIN}' },
    { template: 'без спешки. {MARKOV_PHRASE}' },
    { template: '{CONNECTIVE}, линия тихая.' },
    { template: '{TOPIC_PHRASE}. ничего срочного.' },
    { template: 'медленная петля. {COMMENT}' },
    { template: 'тихий ввод: {TRACK}. {COMMENT}', requireTags: ['track'] },
    { template: 'мягкий ввод: {TRACK}.', weight: 1.1, requireTags: ['track_change'] },
    { template: 'сейчас играет тихо: {TRACK}.', requireTags: ['track'] },
    { template: '{TRACK}. низкий акцент.', requireTags: ['track'] },
    { template: 'спокойный сигнал. {TRACK}. {UNCERTAIN}', requireTags: ['track'] },
    { template: 'всё еще {TRACK}. {COMMENT}', requireTags: ['repeat_track'] },
    { template: 'повтор цикла, но мягко: {TRACK}.', requireTags: ['repeat_track'] },
    { template: 'поздний час. {TRACK}. {TOPIC_PHRASE}.', requireTags: ['night', 'track'] },
    { template: 'ночной дрейф: {TRACK}. {COMMENT}', requireTags: ['night', 'track'] },
    { template: 'после смены. {TRACK}.', requireTags: ['night', 'track'] },
    { template: '{KEYWORD} гудит. {COMMENT}', requireTags: ['track'], minKeywords: 1 },
    { template: 'ключ на полях: {KEYWORD}.', minKeywords: 1 },
    { template: 'трек в журнале: {TRACK}. {TOPIC_PHRASE}.', requireTags: ['track'] },
    { template: 'мягкий ресет. {TRACK} держится.', requireTags: ['track'] },
    { template: '{ARTIST} через тихий фильтр.', requireTags: ['track'] },
    { template: 'сигнал дышит. {TRACK}.', requireTags: ['track'] },
    { template: 'без давления. {TRACK}.', requireTags: ['track'] },
    { template: 'спокойная проверка: {TOPIC_PHRASE}.', requireTags: ['track'] },
    { template: 'тихий лог: {TRACK} // {COMMENT}', requireTags: ['track'] },
    { template: '{COMMENT}. {TRACK} всё еще.', requireTags: ['repeat_track'] },
    { template: 'минимальный шум. {TRACK} играет.', requireTags: ['track'] },
    { template: 'ровный слух. {TRACK}.', requireTags: ['track'] },
    { template: 'тихая линия, {TRACK}. {UNCERTAIN}', requireTags: ['track'] },
    { template: 'спокойное восстановление. {TOPIC_PHRASE}.', requireTags: ['recovery'] },
  ];

  const steady = [
    { template: 'статус номинален. {COMMENT}' },
    { template: 'системный лог: {MARKOV_PHRASE}' },
    { template: 'база держится. {COMMENT}' },
    { template: '{SYSTEM_ENTITY} {VERB}. {COMMENT}' },
    { template: '{CONNECTIVE}, {STATUS}.' },
    { template: 'вход: {TRACK}.', requireTags: ['track'] },
    { template: 'ввод отмечен: {TRACK}.', weight: 1.1, requireTags: ['track_change'] },
    { template: '{TRACK} - {ARTIST}. в журнале.', requireTags: ['track'] },
    { template: 'сигнал говорит {TRACK}. {UNCERTAIN}', requireTags: ['track'] },
    { template: 'данные слушают {TRACK}.', requireTags: ['track'] },
    { template: 'ключ: {KEYWORD}. {COMMENT}', minKeywords: 1 },
    { template: 'тема: {TOPIC_PHRASE}.', requireTags: ['track'] },
    { template: 'повтор отмечен: {TRACK}.', requireTags: ['repeat_track'] },
    { template: 'капс замечен в {TRACK}. {SARCASM}', requireTags: ['caps_title'] },
    { template: 'символы в {TRACK}. {UNCERTAIN}', requireTags: ['symbol_title'] },
    { template: 'много артистов. {UNCERTAIN}', requireTags: ['feat'] },
    { template: 'ночная проверка: {TRACK}.', requireTags: ['night', 'track'] },
    { template: 'глитч-покрытие: {TRACK}.', requireTags: ['glitch', 'track'] },
    { template: 'после восстановления. {TOPIC_PHRASE}.', requireTags: ['recovery'] },
    { template: 'состояние: {STATUS}. {COMMENT}' },
    { template: '{MARKOV_PHRASE}. {COMMENT}' },
    { template: '{COMMENT}. {MARKOV_PHRASE}' },
    { template: 'сущность: {SYSTEM_ENTITY}. {COMMENT}' },
    { template: 'сигнал держится. {TRACK}.', requireTags: ['track'] },
    { template: 'стандартный ввод: {TRACK}.', requireTags: ['track_change'] },
    { template: 'аудиолог: {TRACK}.', requireTags: ['track'] },
    { template: 'след: {TRACK}.', requireTags: ['track'] },
    { template: 'линия держится. {UNCERTAIN}' },
    { template: 'номинальная подача. {COMMENT}' },
    { template: 'рутинное обновление. {TOPIC_PHRASE}.' },
    { template: 'диаг-проход. {COMMENT}' },
    { template: 'ничего нового. {UNCERTAIN}' },
  ];

  const tense = [
    { template: 'давление растет. {COMMENT}' },
    { template: 'лимит повторов тает.' },
    { template: '{STATUS}. нестабильная грань.' },
    { template: '{SYSTEM_ENTITY} {VERB}. опять.' },
    { template: 'ввод скачком: {TRACK}.', weight: 1.1, requireTags: ['track_change'] },
    { template: 'трек под нагрузкой: {TRACK}.', requireTags: ['track'] },
    { template: '{TRACK}. не помогает.', requireTags: ['track'] },
    { template: 'дрожь сигнала + {TRACK}.', requireTags: ['track'] },
    { template: 'триггер: {KEYWORD}.', minKeywords: 1 },
    { template: 'контроль плавает. {UNCERTAIN}' },
    { template: 'шум в линии. {TRACK}.', requireTags: ['glitch', 'track'] },
    { template: 'перегруз: {TRACK}.', requireTags: ['track'] },
    { template: 'капс и напряжение: {TRACK}.', requireTags: ['caps_title'] },
    { template: 'символы и напряжение: {TRACK}.', requireTags: ['symbol_title'] },
    { template: 'feat перегруз: {ARTIST}.', requireTags: ['feat'] },
    { template: 'повтор петли. {TRACK}. опять.', requireTags: ['repeat_track'] },
    { template: 'поздно, терпение тонкое. {TRACK}.', requireTags: ['night', 'track'] },
    { template: 'восстановление на подходе. {TOPIC_PHRASE}.', requireTags: ['recovery'] },
    { template: 'система шепчет повтор. {COMMENT}' },
    { template: 'сигнал натянут. {MARKOV_PHRASE}' },
    { template: 'очередь сопротивляется. {COMMENT}' },
    { template: 'не уверен, но держу. {UNCERTAIN}' },
    { template: 'напряжение в {TOPIC_PHRASE}.', requireTags: ['track'] },
    { template: 'дрейф растет. {COMMENT}' },
    { template: 'буфер тонкий. {COMMENT}' },
    { template: 'задержка контроля. {UNCERTAIN}' },
    { template: 'пиковое давление. {TRACK}.', requireTags: ['track'] },
    { template: 'трек отмечен: {TRACK}.', requireTags: ['track'] },
    { template: '{TRACK} против стабильности. стабильность победила.', requireTags: ['track'] },
    { template: 'музыка как стресс-тест: {TRACK}.', requireTags: ['track'] },
    { template: 'бюджет ошибок шепчет. {COMMENT}' },
    { template: 'повтор цикла: {MARKOV_PHRASE}.' },
  ];

  const chaotic = [
    { template: 'разрыв сигнала.' },
    { template: '{BROKEN} {COMMENT}' },
    { template: 'шумовой всплеск.' },
    { template: 'ввод рванул: {TRACK}.', weight: 1.1, requireTags: ['track_change'] },
    { template: 'новый всплеск: {TRACK}.', weight: 1.05, requireTags: ['track_change'] },
    { template: '{ALIEN} {COMMENT}' },
    { template: 'десинк. {MARKOV_PHRASE}' },
    { template: 'трещина линии: {TRACK}.', requireTags: ['track'] },
    { template: '{TRACK} // {BROKEN}', requireTags: ['track'] },
    { template: 'обрыв трека: {TRACK}.', requireTags: ['track'] },
    { template: 'глитч в {TRACK}.', requireTags: ['glitch', 'track'] },
    { template: 'хаос-подача: {TRACK}.', requireTags: ['track'] },
    { template: '{TRACK}. щелчок.', requireTags: ['track'] },
    { template: '{TRACK}. сигнал потерян.', requireTags: ['track'] },
    { template: '{KEYWORD}. разлом.', minKeywords: 1 },
    { template: 'петля ломается: {TRACK}.', requireTags: ['repeat_track'] },
    { template: 'капс кричит: {TRACK}.', requireTags: ['caps_title'] },
    { template: 'символы кричат: {TRACK}.', requireTags: ['symbol_title'] },
    { template: 'feat пролив. {ARTIST}.', requireTags: ['feat'] },
    { template: 'ночной шум: {TRACK}.', requireTags: ['night', 'track'] },
    { template: '{BROKEN} {TRACK} {BROKEN}', requireTags: ['glitch', 'track'] },
    { template: '{ALIEN} {TRACK}', requireTags: ['glitch', 'track'] },
    { template: 'паника буфера. {COMMENT}' },
    { template: 'срыв контроля. {COMMENT}' },
    { template: 'восстановление запаздывает. {UNCERTAIN}', requireTags: ['recovery'] },
    { template: '{TOPIC_PHRASE}. коротко.', requireTags: ['track'] },
    { template: 'сигнал дрожит. {TOPIC_PHRASE}.', requireTags: ['track'] },
    { template: 'короткий всплеск. {COMMENT}' },
    { template: 'разрыв в аудио. {TRACK}.', requireTags: ['track'] },
    { template: 'шумовая волна. {TRACK}.', requireTags: ['track'] },
    { template: 'фрагмент трека: {TRACK}.', requireTags: ['track'] },
    { template: 'ввод дернулся. {TRACK}.', requireTags: ['track'] },
    { template: 'система трещит. {MARKOV_PHRASE}' },
    { template: '{MARKOV_PHRASE}. {BROKEN}' },
  ];

  return [
    ...withMood(calm, 'calm'),
    ...withMood(steady, 'steady'),
    ...withMood(tense, 'tense'),
    ...withMood(chaotic, 'chaotic'),
  ];
}

function buildTemplatesEn() {
  const templates = [
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
  ];

  const trackTemplates = [
    { template: 'new input: {TRACK}. {COMMENT}', weight: 1.2, requireTags: ['track_change'] },
    { template: 'now playing: {TRACK}. {UNCERTAIN}', weight: 1.1, anyTags: ['track_change', 'event'] },
    { template: '{TRACK} by {ARTIST}. {COMMENT}', weight: 1.0, requireTags: ['track'] },
    { template: '{TRACK}. {COMMENT}', weight: 0.95, requireTags: ['track'] },
    { template: '{TRACK} — {COMMENT}', weight: 0.95, requireTags: ['track'] },
    { template: '{ARTIST}. {COMMENT}', weight: 0.9, requireTags: ['track'] },
    { template: 'signal stable. {TRACK} is not.', weight: 1.1, requireTags: ['track'] },
    { template: '{KEYWORD}. {UNCERTAIN}', weight: 1.0, requireTags: ['track'], minKeywords: 1 },
    { template: 'heard {KEYWORD}. regret logged.', weight: 1.0, minKeywords: 1, requireTags: ['track'] },
    { template: '{TRACK} queued. {TOPIC_PHRASE}.', weight: 1.0, requireTags: ['track'] },
    { template: '{COMMENT} {TRACK}.', weight: 0.95, requireTags: ['track'] },
    { template: 'audio says {TRACK}. fine.', weight: 1.05, requireTags: ['track'] },
    { template: '{TRACK} again? {UNCERTAIN}', weight: 1.1, requireTags: ['repeat_track'] },
    { template: 'same track. same {COMMENT}', weight: 1.0, requireTags: ['repeat_track'] },
    { template: '{ARTIST} repeats. i notice.', weight: 0.95, requireTags: ['repeat_track'] },
    { template: 'still {TRACK}. {COMMENT}', weight: 0.95, requireTags: ['repeat_track'] },
    { template: 'repeat cycle: {TRACK}.', weight: 0.95, requireTags: ['repeat_track'] },
    { template: 'caps detected in {TRACK}. {SARCASM}', weight: 1.0, requireTags: ['caps_title'] },
    { template: 'symbols everywhere: {TRACK}. {UNCERTAIN}', weight: 1.05, requireTags: ['symbol_title'] },
    { template: '{TRACK} is too long. {UNCERTAIN}', weight: 1.05, requireTags: ['long_title'] },
    { template: '{TRACK} is too short. {COMMENT}', weight: 1.0, requireTags: ['short_title'] },
    { template: 'feat. density detected. {COMMENT}', weight: 0.95, requireTags: ['feat'] },
    { template: '{ARTIST} plus extras. {UNCERTAIN}', weight: 1.0, requireTags: ['feat'] },
    { template: 'night shift: {TRACK}. {TOPIC_PHRASE}.', weight: 1.1, requireTags: ['night', 'track'] },
    { template: 'after hours. {TRACK}. {COMMENT}', weight: 1.05, requireTags: ['night', 'track'] },
    { template: 'midnight input: {TRACK}.', weight: 1.0, requireTags: ['night', 'track'] },
    { template: 'glitch in the line. {TRACK}.', weight: 1.1, requireTags: ['glitch', 'track'] },
    { template: 'signal torn, {TRACK} intact. maybe.', weight: 1.05, requireTags: ['glitch', 'track'] },
    { template: '{BROKEN} {TRACK} {BROKEN}', weight: 0.8, requireTags: ['glitch', 'track'] },
    { template: '{ALIEN} {TRACK}. {UNCERTAIN}', weight: 0.8, requireTags: ['glitch', 'track'] },
    { template: 'recovery check: {KEYWORD}.', weight: 1.1, requireTags: ['recovery'], minKeywords: 1 },
    { template: 'recovery check: {TRACK}.', weight: 1.1, requireTags: ['recovery', 'track'] },
    { template: 'self-check complete. {TOPIC_PHRASE}.', weight: 1.0, requireTags: ['recovery'] },
    { template: '{TOPIC_PHRASE}. {COMMENT}', weight: 0.95, requireTags: ['track'] },
    { template: '{COMMENT}. {TOPIC_PHRASE}.', weight: 0.95, requireTags: ['track'] },
    { template: '{UNCERTAIN}. {TOPIC_PHRASE}.', weight: 0.95, requireTags: ['track'] },
    { template: '{TRACK} in the log. {UNCERTAIN}', weight: 1.0, requireTags: ['track'] },
    { template: 'playing {TRACK}. system yawns.', weight: 1.0, requireTags: ['track'] },
    { template: '{ARTIST} filtered through {TOPIC_PHRASE}.', weight: 1.0, requireTags: ['track'] },
    { template: '{TRACK}. {MARKOV_PHRASE}.', weight: 1.0, requireTags: ['track'] },
    { template: '{MARKOV_PHRASE}. {TRACK}.', weight: 1.0, requireTags: ['track'] },
    { template: 'title flagged: {TRACK}.', weight: 0.9, requireTags: ['track'] },
    { template: 'artist tagged: {ARTIST}. {COMMENT}', weight: 1.0, requireTags: ['track'] },
    { template: 'keyword drift: {KEYWORD}.', weight: 1.0, minKeywords: 1 },
    { template: '{TRACK} vs signal. signal wins.', weight: 1.0, requireTags: ['track'] },
    { template: 'audio state says {TRACK}.', weight: 0.95, requireTags: ['track'] },
    { template: 'audible: {TRACK}. tolerable.', weight: 0.95, requireTags: ['track'] },
    { template: 'log entry: {TRACK}. {COMMENT}', weight: 1.0, requireTags: ['track'] },
    { template: 'noted: {TRACK}.', weight: 0.9, requireTags: ['track'] },
    { template: '{TRACK} again. of course.', weight: 1.05, requireTags: ['repeat_track'] },
    { template: 'title noise: {TRACK}.', weight: 0.95, requireTags: ['symbol_title'] },
    { template: 'too many caps. {TRACK}.', weight: 1.0, requireTags: ['caps_title'] },
    { template: 'too many symbols. {UNCERTAIN}', weight: 1.0, requireTags: ['symbol_title'] },
    { template: 'multiple artists detected. {COMMENT}', weight: 1.0, requireTags: ['feat'] },
    { template: 'feat chain: {ARTIST}. {SARCASM}', weight: 1.0, requireTags: ['feat'] },
    { template: 'night log: {TRACK} // {COMMENT}', weight: 1.05, requireTags: ['night', 'track'] },
    { template: 'late hour. {TRACK}. {UNCERTAIN}', weight: 1.0, requireTags: ['night', 'track'] },
    { template: 'system anomaly + {TRACK}. nice.', weight: 1.0, requireTags: ['glitch', 'track'] },
    { template: 'glitch overlay: {TRACK}.', weight: 0.9, requireTags: ['glitch', 'track'] },
    { template: 'stability returns. {TRACK}.', weight: 1.0, requireTags: ['recovery', 'track'] },
    { template: 'post-glitch note: {KEYWORD}.', weight: 1.0, requireTags: ['recovery'], minKeywords: 1 },
    { template: '{TRACK}. {UNCERTAIN}. {COMMENT}', weight: 1.0, requireTags: ['track'] },
    { template: '{ARTIST}. {UNCERTAIN}.', weight: 0.95, requireTags: ['track'] },
    { template: 'keyword imprint: {KEYWORD}. {COMMENT}', weight: 1.0, minKeywords: 1 },
    { template: '{TRACK} // {ALIEN}', weight: 0.8, requireTags: ['glitch', 'track'] },
  ];

  const moodTemplates = buildMoodTemplatesEn();
  return templates.concat(trackTemplates, moodTemplates);
}

function buildTemplatesRu() {
  const templates = [
    { template: '{STATUS}. {COMMENT}', weight: 1.2 },
    { template: '{MARKOV_PHRASE}, {COMMENT}', weight: 1.1 },
    { template: '{COMMENT}. {MARKOV_PHRASE}', weight: 1.0 },
    { template: '{SYSTEM_ENTITY} - {ADJECTIVE}. {COMMENT}', weight: 1.0 },
    { template: '{SYSTEM_ENTITY} {VERB}. {COMMENT}', weight: 1.0 },
    { template: '{SARCASM} {STATUS}.', weight: 0.9 },
    { template: '{EVENT_PHRASE}. {COMMENT}', weight: 1.2 },
    { template: '{MARKOV_PHRASE}. {PAST_REFERENCE}', weight: 0.7 },
    { template: '{ALIEN_FRAGMENT} {MARKOV_PHRASE}', weight: 0.6 },
    { template: '{CONNECTIVE}, {STATUS}.', weight: 0.8 },
  ];

  const trackTemplates = [
    { template: 'новый ввод: {TRACK}. {COMMENT}', weight: 1.2, requireTags: ['track_change'] },
    { template: 'сейчас играет: {TRACK}. {UNCERTAIN}', weight: 1.1, anyTags: ['track_change', 'event'] },
    { template: '{TRACK} — {ARTIST}. {COMMENT}', weight: 1.0, requireTags: ['track'] },
    { template: '{TRACK}. {COMMENT}', weight: 0.95, requireTags: ['track'] },
    { template: '{ARTIST}. {COMMENT}', weight: 0.9, requireTags: ['track'] },
    { template: 'сигнал стабилен. {TRACK} нет.', weight: 1.05, requireTags: ['track'] },
    { template: '{KEYWORD}. {UNCERTAIN}', weight: 1.0, minKeywords: 1, requireTags: ['track'] },
    { template: 'услышал {KEYWORD}. жаль.', weight: 1.0, minKeywords: 1, requireTags: ['track'] },
    { template: '{TRACK} в очереди. {TOPIC_PHRASE}.', weight: 1.0, requireTags: ['track'] },
    { template: '{COMMENT} {TRACK}.', weight: 0.95, requireTags: ['track'] },
    { template: 'аудио говорит: {TRACK}.', weight: 1.0, requireTags: ['track'] },
    { template: '{TRACK} снова? {UNCERTAIN}', weight: 1.1, requireTags: ['repeat_track'] },
    { template: 'тот же трек. {COMMENT}', weight: 1.0, requireTags: ['repeat_track'] },
    { template: '{ARTIST} повторяется. отмечено.', weight: 0.95, requireTags: ['repeat_track'] },
    { template: 'всё еще {TRACK}. {COMMENT}', weight: 0.95, requireTags: ['repeat_track'] },
    { template: 'повтор цикла: {TRACK}.', weight: 0.95, requireTags: ['repeat_track'] },
    { template: 'капс в {TRACK}. {SARCASM}', weight: 1.0, requireTags: ['caps_title'] },
    { template: 'символы повсюду: {TRACK}. {UNCERTAIN}', weight: 1.05, requireTags: ['symbol_title'] },
    { template: '{TRACK} слишком длинный. {UNCERTAIN}', weight: 1.05, requireTags: ['long_title'] },
    { template: '{TRACK} слишком короткий. {COMMENT}', weight: 1.0, requireTags: ['short_title'] },
    { template: 'feat обнаружен. {COMMENT}', weight: 0.95, requireTags: ['feat'] },
    { template: '{ARTIST} и еще. {UNCERTAIN}', weight: 1.0, requireTags: ['feat'] },
    { template: 'ночная смена: {TRACK}. {TOPIC_PHRASE}.', weight: 1.1, requireTags: ['night', 'track'] },
    { template: 'после полуночи. {TRACK}. {COMMENT}', weight: 1.05, requireTags: ['night', 'track'] },
    { template: 'ночной ввод: {TRACK}.', weight: 1.0, requireTags: ['night', 'track'] },
    { template: 'глитч в линии. {TRACK}.', weight: 1.1, requireTags: ['glitch', 'track'] },
    { template: 'сигнал рвется, {TRACK} держится. может.', weight: 1.05, requireTags: ['glitch', 'track'] },
    { template: '{BROKEN} {TRACK} {BROKEN}', weight: 0.8, requireTags: ['glitch', 'track'] },
    { template: '{ALIEN} {TRACK}. {UNCERTAIN}', weight: 0.8, requireTags: ['glitch', 'track'] },
    { template: 'проверка после сбоя: {KEYWORD}.', weight: 1.1, requireTags: ['recovery'], minKeywords: 1 },
    { template: 'проверка после сбоя: {TRACK}.', weight: 1.1, requireTags: ['recovery', 'track'] },
    { template: 'самопроверка завершена. {TOPIC_PHRASE}.', weight: 1.0, requireTags: ['recovery'] },
    { template: '{TOPIC_PHRASE}. {COMMENT}', weight: 0.95, requireTags: ['track'] },
    { template: '{COMMENT}. {TOPIC_PHRASE}.', weight: 0.95, requireTags: ['track'] },
    { template: '{UNCERTAIN}. {TOPIC_PHRASE}.', weight: 0.95, requireTags: ['track'] },
    { template: '{TRACK} в логе. {UNCERTAIN}', weight: 1.0, requireTags: ['track'] },
    { template: 'играет {TRACK}. система зевает.', weight: 1.0, requireTags: ['track'] },
    { template: '{ARTIST} через {TOPIC_PHRASE}.', weight: 1.0, requireTags: ['track'] },
    { template: '{TRACK}. {MARKOV_PHRASE}.', weight: 1.0, requireTags: ['track'] },
    { template: '{MARKOV_PHRASE}. {TRACK}.', weight: 1.0, requireTags: ['track'] },
    { template: 'заголовок отмечен: {TRACK}.', weight: 0.9, requireTags: ['track'] },
    { template: 'артист: {ARTIST}. {COMMENT}', weight: 1.0, requireTags: ['track'] },
    { template: 'ключевое: {KEYWORD}.', weight: 1.0, minKeywords: 1 },
    { template: '{TRACK} против сигнала. сигнал победил.', weight: 1.0, requireTags: ['track'] },
    { template: 'аудио: {TRACK}.', weight: 0.95, requireTags: ['track'] },
    { template: 'лог: {TRACK}. {COMMENT}', weight: 1.0, requireTags: ['track'] },
    { template: 'отмечено: {TRACK}.', weight: 0.9, requireTags: ['track'] },
    { template: '{TRACK} снова. конечно.', weight: 1.05, requireTags: ['repeat_track'] },
    { template: 'шумное название: {TRACK}.', weight: 0.95, requireTags: ['symbol_title'] },
    { template: 'слишком много капса. {TRACK}.', weight: 1.0, requireTags: ['caps_title'] },
    { template: 'слишком много символов. {UNCERTAIN}', weight: 1.0, requireTags: ['symbol_title'] },
    { template: 'много артистов. {COMMENT}', weight: 1.0, requireTags: ['feat'] },
    { template: 'ночной лог: {TRACK} // {COMMENT}', weight: 1.05, requireTags: ['night', 'track'] },
    { template: 'поздний час. {TRACK}. {UNCERTAIN}', weight: 1.0, requireTags: ['night', 'track'] },
    { template: 'сбой + {TRACK}. мило.', weight: 1.0, requireTags: ['glitch', 'track'] },
    { template: 'глитч поверх: {TRACK}.', weight: 0.9, requireTags: ['glitch', 'track'] },
    { template: 'стабильность вернулась. {TRACK}.', weight: 1.0, requireTags: ['recovery', 'track'] },
    { template: 'после сбоя: {KEYWORD}.', weight: 1.0, requireTags: ['recovery'], minKeywords: 1 },
    { template: '{TRACK}. {UNCERTAIN}. {COMMENT}', weight: 1.0, requireTags: ['track'] },
    { template: '{ARTIST}. {UNCERTAIN}.', weight: 0.95, requireTags: ['track'] },
    { template: 'ключевая метка: {KEYWORD}. {COMMENT}', weight: 1.0, minKeywords: 1 },
    { template: '{TRACK} // {ALIEN}', weight: 0.8, requireTags: ['glitch', 'track'] },
  ];

  const moodTemplates = buildMoodTemplatesRu();
  return templates.concat(trackTemplates, moodTemplates);
}

function buildLanguagePack(base, expand, topicPhrases, language) {
  const nouns_system = expandWithAffixes(base.nouns_system, expand.nounPrefixes, expand.nounSuffixes, 900);
  const verbs_system = expandWithAffixes(base.verbs_system, expand.verbPrefixes, [], 650);
  const adjectives = expandWithAffixes(base.adjectives, expand.adjPrefixes, expand.adjSuffixes, 700);
  const adverbs = expandAdverbs(base.adverbs, adjectives, expand.advSuffixes, 320, language);
  const alien_tokens = buildAlienTokens(expand.alienRoots, expand.alienSuffixes, 380);

  return {
    baseWords: {
      nouns_system,
      verbs_system,
      adjectives,
      adverbs,
      connectors: dedupe(base.connectors),
      sarcasm_markers: dedupe(base.sarcasm_markers),
      exhaustion_markers: dedupe(base.exhaustion_markers),
      repair_markers: dedupe(base.repair_markers),
      uncertainty_markers: dedupe(base.uncertainty_markers),
      human_markers: dedupe(base.human_markers),
      time_markers: dedupe(base.time_markers),
      weather_markers: dedupe(base.weather_markers),
      audio_markers: dedupe(base.audio_markers),
      failure_markers: dedupe(base.failure_markers),
      recovery_markers: dedupe(base.recovery_markers),
      alien_tokens,
      glitch_tokens: dedupe(base.glitch_tokens),
      command_tokens: dedupe(base.command_tokens),
      diagnostics_tokens: dedupe(base.diagnostics_tokens),
    },
    topicPhrases,
    templates: buildTemplateBank(language),
  };
}

export const LEXICON_BIG = {
  'en-US': buildLanguagePack(EN_BASE, EN_EXPAND, EN_TOPIC_PHRASES, 'en-US'),
  'ru-RU': buildLanguagePack(RU_BASE, RU_EXPAND, RU_TOPIC_PHRASES, 'ru-RU'),
};

export function getLexiconPack(language) {
  if (language && language.toLowerCase().startsWith('ru')) return LEXICON_BIG['ru-RU'];
  return LEXICON_BIG['en-US'];
}

function expandWithAffixes(base = [], prefixes = [], suffixes = [], max = 600) {
  const tokens = new Set(base.map(token => String(token).toLowerCase()));
  for (const prefix of prefixes) {
    for (const word of base) {
      if (tokens.size >= max) break;
      tokens.add(`${prefix}${word}`);
    }
    if (tokens.size >= max) break;
  }
  for (const suffix of suffixes) {
    for (const word of base) {
      if (tokens.size >= max) break;
      tokens.add(`${word}${suffix}`);
    }
    if (tokens.size >= max) break;
  }
  return Array.from(tokens);
}

function expandAdverbs(base = [], adjectives = [], suffixes = [], max = 300, language = 'en-US') {
  const tokens = new Set(base.map(token => String(token).toLowerCase()));
  const suffix = suffixes[0] || (language === 'ru-RU' ? 'но' : 'ly');
  for (const adj of adjectives) {
    if (tokens.size >= max) break;
    const clean = String(adj).replace(/[^a-zа-яё-]/gi, '');
    if (!clean) continue;
    tokens.add(`${clean}${suffix}`);
  }
  return Array.from(tokens);
}

function buildAlienTokens(roots = [], suffixes = [], max = 360) {
  const tokens = new Set();
  roots.forEach(root => tokens.add(root));
  for (const root of roots) {
    for (const suffix of suffixes) {
      if (tokens.size >= max) break;
      tokens.add(`${root}${suffix}`);
    }
    if (tokens.size >= max) break;
  }
  for (let i = 0; i < roots.length && tokens.size < max; i++) {
    tokens.add(`${roots[i]}-${i}`);
  }
  return Array.from(tokens);
}

function dedupe(list = []) {
  return Array.from(new Set(list.filter(Boolean)));
}
