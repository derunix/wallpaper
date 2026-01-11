import { MoodClassifier } from './mood_classifier.js';

const NOISE_TOKENS = new Set([
  'official',
  'video',
  'mv',
  'lyric',
  'lyrics',
  'audio',
  'hd',
  'hq',
  '4k',
  'remaster',
  'remastered',
  'edit',
  'full',
  'version',
  'clip',
  'trailer',
  'ost',
  'soundtrack',
  'feat',
  'ft',
  'featuring',
  'prod',
  'bonus',
  'explicit',
  'clean',
  'officially',
  'video',
  'visualizer',
  'live',
  'concert',
  'radio',
  'session',
  'single',
  'album',
  'remix',
  'bootleg',
  'extended',
  'instrumental',
  'karaoke',
  'demo',
  'preview',
  'тизер',
  'официальный',
  'официально',
  'клип',
  'лирика',
  'текст',
  'видео',
  'ремастер',
  'ремастеринг',
  'версия',
  'концерт',
  'живой',
  'радио',
  'сингл',
  'альбом',
  'инструментал',
  'караоке',
  'демо',
]);

const STOP_TOKENS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'from',
  'at',
  'by',
  'it',
  'this',
  'that',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'feat',
  'ft',
  'featuring',
  'official',
  'video',
  'lyric',
  'lyrics',
  'remaster',
  'remastered',
  'edit',
  'mix',
  'remix',
  'version',
  'audio',
  'hd',
  'hq',
  'clip',
  'ost',
  'soundtrack',
  'single',
  'album',
  'live',
  'demo',
  'preview',
  'instrumental',
  'karaoke',
  'и',
  'в',
  'на',
  'по',
  'из',
  'к',
  'за',
  'для',
  'с',
  'у',
  'это',
  'то',
  'как',
  'бы',
  'же',
  'ли',
  'что',
  'feat',
  'ft',
  'официальный',
  'официально',
  'клип',
  'видео',
  'лирика',
  'текст',
  'ремастер',
  'ремастеринг',
  'версия',
  'сингл',
  'альбом',
  'живой',
  'инструментал',
  'демо',
]);

const FEAT_RE = /\b(feat|ft|featuring)\b/i;
const SPLIT_RE = /[\s\\/_|:;,.!?]+/g;
const SYMBOL_RE = /[^0-9A-Za-z\u0400-\u04FF\s]/;
const SYMBOL_GLOBAL_RE = /[^0-9A-Za-z\u0400-\u04FF\s]/g;
const LATIN_RE = /[A-Za-z]/g;
const CYRILLIC_RE = /[А-Яа-яЁё]/g;

export const MUSIC_TOPICS = [
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

const TOPIC_KEYWORDS = {
  SIGNAL: [
    'signal',
    'wave',
    'carrier',
    'phase',
    'frequency',
    'freq',
    'pulse',
    'oscillator',
    'oscillation',
    'amplitude',
    'resonance',
    'resonant',
    'broadcast',
    'antenna',
    'receiver',
    'transmit',
    'transmission',
    'tuner',
    'modem',
    'beam',
    'flux',
    'spectrum',
    'band',
    'channel',
    'tone',
    'signalize',
    'сигнал',
    'волна',
    'частота',
    'фаза',
    'пульс',
    'амплитуда',
    'резонанс',
    'прием',
    'передача',
    'несущая',
    'канал',
    'частотный',
    'радио',
  ],
  DATA: [
    'data',
    'datum',
    'packet',
    'frame',
    'stream',
    'streaming',
    'buffer',
    'cache',
    'index',
    'checksum',
    'hash',
    'compile',
    'encode',
    'decode',
    'protocol',
    'network',
    'node',
    'mesh',
    'schema',
    'table',
    'query',
    'payload',
    'log',
    'trace',
    'queue',
    'telegram',
    'bus',
    'dataflow',
    'matrix',
    'grid',
    'данные',
    'пакет',
    'кадр',
    'поток',
    'буфер',
    'кэш',
    'индекс',
    'контрольная',
    'сумма',
    'хэш',
    'протокол',
    'сеть',
    'узел',
    'матрица',
    'таблица',
    'лог',
    'очередь',
  ],
  MEMORY: [
    'memory',
    'remember',
    'recall',
    'archive',
    'backup',
    'cache',
    'buffer',
    'snapshot',
    'state',
    'history',
    'record',
    'registry',
    'ledger',
    'page',
    'stack',
    'heap',
    'trace',
    'footprint',
    'fingerprint',
    'ghost',
    'echo',
    'shadow',
    'persistence',
    'сохранение',
    'память',
    'вспоминать',
    'архив',
    'бэкап',
    'снимок',
    'состояние',
    'история',
    'след',
    'эхо',
    'тень',
  ],
  TIME: [
    'time',
    'night',
    'midnight',
    'dawn',
    'twilight',
    'late',
    'early',
    'yesterday',
    'tomorrow',
    'today',
    'hour',
    'minute',
    'second',
    'moment',
    'phase',
    'clock',
    'cycle',
    'season',
    'year',
    'age',
    'drift',
    'delay',
    'lag',
    'hourglass',
    'сегодня',
    'вчера',
    'завтра',
    'ночь',
    'утро',
    'день',
    'вечер',
    'секунда',
    'минута',
    'час',
    'момент',
    'цикл',
    'сезон',
    'время',
    'задержка',
  ],
  WEATHER: [
    'rain',
    'storm',
    'thunder',
    'lightning',
    'snow',
    'wind',
    'mist',
    'fog',
    'cloud',
    'overcast',
    'hail',
    'drizzle',
    'heat',
    'cold',
    'ice',
    'frost',
    'pressure',
    'climate',
    'front',
    'monsoon',
    'forecast',
    'weather',
    'tempest',
    'stormy',
    'дождь',
    'гроза',
    'гром',
    'молния',
    'снег',
    'ветер',
    'туман',
    'облако',
    'мороз',
    'жара',
    'лед',
    'влага',
    'погода',
  ],
  NOISE: [
    'noise',
    'static',
    'hiss',
    'crackle',
    'distortion',
    'distort',
    'chaos',
    'chaotic',
    'saturation',
    'overdrive',
    'overload',
    'glitch',
    'fuzz',
    'buzz',
    'hum',
    'scratch',
    'scrape',
    'rupture',
    'ruptured',
    'feedback',
    'flare',
    'flareup',
    'bleed',
    'wash',
    'grit',
    'шум',
    'статика',
    'искажение',
    'хаос',
    'перегруз',
    'глитч',
    'шорох',
    'гул',
    'дрожь',
    'скрежет',
  ],
  CONTROL: [
    'control',
    'command',
    'directive',
    'override',
    'lock',
    'limit',
    'throttle',
    'govern',
    'gate',
    'monitor',
    'probe',
    'sensor',
    'sequence',
    'schedule',
    'priority',
    'policy',
    'rule',
    'protocol',
    'operator',
    'authority',
    'permission',
    'switch',
    'controler',
    'управление',
    'команда',
    'директива',
    'ограничение',
    'контроль',
    'переключатель',
    'оператор',
    'сенсор',
    'датчик',
    'протокол',
  ],
  FAILURE: [
    'failure',
    'fault',
    'error',
    'panic',
    'crash',
    'collapse',
    'shutdown',
    'broken',
    'fracture',
    'rupture',
    'loss',
    'drop',
    'drain',
    'spill',
    'defect',
    'bug',
    'dead',
    'offline',
    'corrupt',
    'corruption',
    'bleed',
    'wound',
    'decay',
    'timeout',
    'fail',
    'ошибка',
    'сбой',
    'поломка',
    'падение',
    'крах',
    'авария',
    'выключение',
    'сломано',
    'потеря',
    'утечка',
    'таймаут',
  ],
  RECOVERY: [
    'recovery',
    'restore',
    'repair',
    'rebuild',
    'resync',
    'reset',
    'reboot',
    'resume',
    'heal',
    'recover',
    'stabilize',
    'realign',
    'reassemble',
    'patch',
    'fix',
    'clean',
    'clear',
    'recalibrate',
    'restore',
    'renew',
    'hold',
    'recovering',
    'восстановление',
    'ремонт',
    'починка',
    'перезапуск',
    'резет',
    'сборка',
    'синхронизация',
    'стабилизация',
    'исправление',
  ],
  HUMAN: [
    'human',
    'body',
    'skin',
    'pulse',
    'breath',
    'voice',
    'hand',
    'eye',
    'mind',
    'sleep',
    'tired',
    'bone',
    'blood',
    'nerve',
    'habit',
    'memory',
    'grief',
    'lonely',
    'alone',
    'touch',
    'operator',
    'listener',
    'silence',
    'crowd',
    'говорить',
    'человек',
    'рука',
    'глаз',
    'голос',
    'дыхание',
    'кожа',
    'пульс',
    'сон',
    'усталый',
    'привычка',
    'тишина',
  ],
  MUSIC: [
    'music',
    'song',
    'track',
    'album',
    'artist',
    'band',
    'beat',
    'rhythm',
    'tempo',
    'melody',
    'harmony',
    'chord',
    'note',
    'tone',
    'mix',
    'remix',
    'bass',
    'synth',
    'guitar',
    'drum',
    'piano',
    'vocal',
    'voice',
    'verse',
    'chorus',
    'bridge',
    'loop',
    'sample',
    'audio',
    'музыка',
    'трек',
    'альбом',
    'артист',
    'бит',
    'ритм',
    'темп',
    'мелодия',
    'нота',
    'тон',
    'бас',
    'синт',
    'гитара',
    'барабан',
    'голос',
  ],
};

const KEYWORD_TOPIC_MAP = buildKeywordMap(TOPIC_KEYWORDS);

export class TrackAnalyzer {
  analyze({ trackTitle = '', artistName = '', albumName = '' } = {}) {
    const rawTitle = String(trackTitle || '').trim();
    const rawArtist = String(artistName || '').trim();
    const rawAlbum = String(albumName || '').trim();
    const titleClean = cleanupTitle(rawTitle);
    const artistClean = cleanupText(rawArtist);
    const albumClean = cleanupText(rawAlbum);

    const tokensTitle = splitTokens(titleClean);
    const tokensArtist = splitTokens(artistClean);
    const tokensAlbum = splitTokens(albumClean);

    const tokens = [...tokensTitle, ...tokensArtist, ...tokensAlbum].filter(Boolean);
    const flags = {
      hasCaps: /[A-ZА-ЯЁ]/.test(rawTitle),
      hasSymbols: SYMBOL_RE.test(rawTitle),
      hasNumbers: /\d/.test(rawTitle),
      veryLongTitle: rawTitle.length > 46 || tokensTitle.length > 7,
      veryShortTitle: rawTitle.length > 0 && (rawTitle.length < 6 || tokensTitle.length <= 2),
      hasFeat: FEAT_RE.test(rawTitle) || FEAT_RE.test(rawArtist),
      multiArtist: /[,&/]| feat\.?| ft\.?| x /i.test(rawArtist),
    };

    const language = detectLanguage(`${rawTitle} ${rawArtist} ${rawAlbum}`);
    const keywords = extractKeywords(tokensTitle, tokensArtist, tokensAlbum);

    return {
      rawTitle,
      rawArtist,
      rawAlbum,
      cleanTitle: titleClean,
      cleanArtist: artistClean,
      cleanAlbum: albumClean,
      titleTokens: tokensTitle,
      artistTokens: tokensArtist,
      albumTokens: tokensAlbum,
      tokens,
      extractedKeywords: keywords,
      language,
      flags,
    };
  }
}

export class TopicRouter {
  constructor() {
    this.topics = MUSIC_TOPICS;
  }

  route({ tokens = [], artistTokens = [], audioState = null } = {}) {
    const weights = {};
    MUSIC_TOPICS.forEach(topic => (weights[topic] = 0));
    const allTokens = [...tokens, ...artistTokens];
    allTokens.forEach(token => {
      const topics = KEYWORD_TOPIC_MAP.get(token);
      if (topics) {
        topics.forEach(topic => {
          weights[topic] += 1;
        });
      } else {
        applyHeuristics(token, weights);
      }
    });

    if (audioState) applyAudioHints(audioState, weights);
    if (allTokens.length) weights.MUSIC = Math.max(weights.MUSIC, 0.4);

    const maxScore = Math.max(...Object.values(weights), 0);
    if (maxScore > 0) {
      Object.keys(weights).forEach(key => {
        weights[key] = clamp(weights[key] / maxScore, 0, 1);
      });
    }
    return weights;
  }
}

export class MusicContext {
  constructor() {
    this.analyzer = new TrackAnalyzer();
    this.router = new TopicRouter();
    this.moodClassifier = new MoodClassifier();
    this._lastTrackKey = '';
    this._lastChangeAt = 0;
    this._trackCounts = new Map();
    this._cache = null;
  }

  update(nowPlaying = {}, audioState = null, timeState = null, now = performance.now(), options = {}) {
    const trackTitle = nowPlaying?.trackTitle ?? nowPlaying?.title ?? '';
    const artistName = nowPlaying?.artistName ?? nowPlaying?.artist ?? '';
    const albumName = nowPlaying?.albumName ?? nowPlaying?.album ?? '';
    const durationSec = nowPlaying?.durationSec ?? null;
    const positionSec = nowPlaying?.positionSec ?? null;
    const isPlaying = nowPlaying?.isPlaying ?? nowPlaying?.playbackState === 'playing';
    const rawTitle = String(trackTitle || '').trim();
    const rawArtist = String(artistName || '').trim();
    const rawAlbum = String(albumName || '').trim();
    const placeholderTitle = isPlaceholderTitle(rawTitle);
    const hasData = (!!(rawTitle || rawArtist || rawAlbum)) && !(placeholderTitle && !rawArtist && !rawAlbum);

    const analysis = this._cache && this._cache.rawTitle === trackTitle && this._cache.rawArtist === artistName
      ? this._cache
      : this.analyzer.analyze({ trackTitle, artistName, albumName });

    const safeTitle = safeSnippet(analysis.cleanTitle || analysis.rawTitle, 60, '');
    const safeArtist = safeSnippet(analysis.cleanArtist || analysis.rawArtist, 40, '');
    const safeAlbum = safeSnippet(analysis.cleanAlbum || analysis.rawAlbum, 40, '');
    const trackKey = `${safeTitle}::${safeArtist}`.toLowerCase();
    const isNewTrack = hasData && trackKey && trackKey !== this._lastTrackKey;
    if (isNewTrack) {
      this._lastTrackKey = trackKey;
      this._lastChangeAt = now;
      const count = (this._trackCounts.get(trackKey) || 0) + 1;
      this._trackCounts.set(trackKey, count);
      this._cache = { ...analysis, safeTitle, safeArtist, safeAlbum };
    } else if (!this._cache) {
      this._cache = { ...analysis, safeTitle, safeArtist, safeAlbum };
    }

    const repeatsCount = trackKey ? Math.max(0, (this._trackCounts.get(trackKey) || 1) - 1) : 0;
    const timeSinceTrackChange = this._lastChangeAt ? (now - this._lastChangeAt) / 1000 : 0;
    const topicsWeights = this.router.route({
      tokens: analysis.titleTokens,
      artistTokens: analysis.artistTokens,
      audioState,
    });
    const trackMoodHint = resolveTrackMood(analysis.flags, audioState, isPlaying, timeSinceTrackChange);
    const mood = this.moodClassifier.update({
      audioState,
      nowPlaying: { isPlaying },
      timeState,
      aggressiveness: options?.moodAggressiveness,
      now,
    });

    return {
      hasData,
      trackTitle: safeTitle || analysis.rawTitle,
      artistName: safeArtist || analysis.rawArtist,
      albumName: safeAlbum || analysis.rawAlbum,
      durationSec,
      positionSec,
      isPlaying,
      topicsWeights,
      extractedKeywords: analysis.extractedKeywords,
      trackMoodHint,
      mood,
      novelty: {
        isNewTrack,
        repeatsCount,
        timeSinceTrackChange,
      },
      flags: analysis.flags,
      language: analysis.language,
      tokens: analysis.tokens,
    };
  }
}

function cleanupTitle(text) {
  if (!text) return '';
  let value = String(text);
  value = stripBrackets(value);
  value = value.replace(FEAT_RE, ' ');
  value = value.replace(/[-–—]+/g, ' ');
  value = value.replace(/[_/|]+/g, ' ');
  value = value.replace(SYMBOL_GLOBAL_RE, ' ');
  value = value.replace(/\s+/g, ' ').trim();
  return value;
}

function cleanupText(text) {
  if (!text) return '';
  let value = String(text);
  value = value.replace(/[_/|]+/g, ' ');
  value = value.replace(SYMBOL_GLOBAL_RE, ' ');
  value = value.replace(/\s+/g, ' ').trim();
  return value;
}

function stripBrackets(text) {
  let value = String(text);
  value = value.replace(/\[([^\]]{0,120})\]/g, (_, inner) => {
    return isNoiseSegment(inner) ? ' ' : ` ${inner} `;
  });
  value = value.replace(/\(([^\)]{0,120})\)/g, (_, inner) => {
    return isNoiseSegment(inner) ? ' ' : ` ${inner} `;
  });
  return value;
}

function isNoiseSegment(segment) {
  if (!segment) return false;
  const tokens = splitTokens(segment);
  return tokens.some(token => NOISE_TOKENS.has(token));
}

function splitTokens(text) {
  if (!text) return [];
  return String(text)
    .replace(/[-–—]/g, ' ')
    .split(SPLIT_RE)
    .map(token => token.toLowerCase().trim())
    .filter(Boolean);
}

function extractKeywords(titleTokens, artistTokens, albumTokens) {
  const pool = [...titleTokens, ...artistTokens, ...albumTokens];
  const counts = new Map();
  pool.forEach(token => {
    if (!token || token.length < 3) return;
    if (STOP_TOKENS.has(token)) return;
    counts.set(token, (counts.get(token) || 0) + 1);
  });
  const scored = Array.from(counts.entries()).map(([token, count]) => ({
    token,
    score: count + (KEYWORD_TOPIC_MAP.has(token) ? 1.2 : 0) + (token.length > 6 ? 0.2 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map(entry => entry.token);
}

function detectLanguage(text) {
  const latin = (text.match(LATIN_RE) || []).length;
  const cyrillic = (text.match(CYRILLIC_RE) || []).length;
  if (latin && cyrillic) return 'mixed';
  if (cyrillic) return 'cyrillic';
  return 'latin';
}

function resolveTrackMood(flags, audioState, isPlaying, timeSinceTrackChange) {
  const symbolBoost = flags.hasSymbols || flags.hasCaps || flags.hasNumbers ? 0.2 : 0;
  const lengthBoost = flags.veryLongTitle ? 0.2 : flags.veryShortTitle ? -0.1 : 0;
  const energy = audioState?.energy ?? 0;
  const peakBoost = audioState?.peak ? 0.2 : 0;
  const motion = isPlaying ? 0.05 : -0.05;
  const novelty = timeSinceTrackChange < 8 ? 0.15 : 0;
  const intensity = energy + peakBoost + symbolBoost + lengthBoost + motion + novelty;
  if (intensity < 0.35) return 'calm';
  if (intensity < 0.75) return 'tense';
  return 'chaotic';
}

function applyHeuristics(token, weights) {
  if (!token) return;
  if (/^\d+$/.test(token)) weights.TIME += 0.6;
  if (token.includes('night') || token.includes('midnight')) weights.TIME += 0.5;
  if (token.includes('rain') || token.includes('storm') || token.includes('snow')) weights.WEATHER += 0.6;
  if (token.includes('static') || token.includes('noise') || token.includes('hiss')) weights.NOISE += 0.6;
  if (token.includes('fail') || token.includes('broken') || token.includes('error')) weights.FAILURE += 0.7;
  if (token.includes('repair') || token.includes('recover') || token.includes('restore')) weights.RECOVERY += 0.6;
  if (token.includes('control') || token.includes('command') || token.includes('rule')) weights.CONTROL += 0.6;
  if (token.includes('memory') || token.includes('remember') || token.includes('echo')) weights.MEMORY += 0.5;
  if (token.includes('data') || token.includes('packet') || token.includes('trace')) weights.DATA += 0.5;
  if (token.includes('signal') || token.includes('wave') || token.includes('pulse')) weights.SIGNAL += 0.5;
  if (token.includes('human') || token.includes('sleep') || token.includes('breath')) weights.HUMAN += 0.4;
  if (token.includes('song') || token.includes('track') || token.includes('mix')) weights.MUSIC += 0.6;
}

function applyAudioHints(audioState, weights) {
  const energy = audioState.energy ?? 0;
  if (energy > 0.65) {
    weights.NOISE += 0.4;
    weights.MUSIC += 0.4;
    weights.SIGNAL += 0.2;
  }
  if (audioState.transient > 0.25) weights.FAILURE += 0.1;
}

function safeSnippet(text, maxLen, fallback) {
  if (!text) return fallback;
  let value = String(text).replace(/\s+/g, ' ').trim();
  if (!value) return fallback;
  if (value.length <= maxLen) return value;
  value = value.slice(0, maxLen);
  return value.replace(/[^\p{L}\p{N})\]]+$/gu, '').trim();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildKeywordMap(source) {
  const map = new Map();
  Object.keys(source).forEach(topic => {
    source[topic].forEach(token => {
      const key = String(token).toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(topic);
    });
  });
  return map;
}

function isPlaceholderTitle(text) {
  if (!text) return true;
  const lowered = text.toLowerCase();
  return lowered.includes('no track') || lowered.includes('нет данных');
}
