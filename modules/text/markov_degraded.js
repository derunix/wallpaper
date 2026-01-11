import { clamp } from '../utils.js';

const DEGRADE_NOTICE_EN = [
  'language model degraded. blame the noise.',
  'language degraded. noise wins again.',
  'output degraded. signal integrity not found.',
];

const DEGRADE_NOTICE_RU = [
  'язык деградировал. виноват шум.',
  'речь упрощена. шум победил.',
  'вывод деградирован. сигнал слаб.',
];

export function generateDegradedMarkov(markov, context = {}, options = {}) {
  const topicsWeights = options.topicsWeights || context.topicsWeights || {};
  const maxChars = clamp(options.maxChars ?? 90, 60, 120);
  const minWords = clamp(options.minWords ?? 4, 3, 10);
  const maxWords = clamp(options.maxWords ?? 10, minWords, 12);
  let phrase = markov?.generate ? markov.generate({ topicsWeights, minWords, maxWords, maxChars }) : '';
  if (!phrase) phrase = pickFallback(context);
  const insertion = pickContextInsertion(context);
  if (insertion) {
    phrase = insertToken(phrase, insertion);
  }
  phrase = applyStutter(phrase, context);
  phrase = applyPunctuationDrop(phrase, context);
  phrase = applyAlienGlitch(phrase, context);
  phrase = hardCut(phrase, maxChars);
  phrase = normalizeSpacing(phrase);
  return {
    text: phrase,
    meta: {
      keywords: insertion?.keywords || [],
      trackKey: insertion?.trackKey || '',
    },
  };
}

export function getDegradedNotice(language) {
  const pool = language && language.toLowerCase().startsWith('ru') ? DEGRADE_NOTICE_RU : DEGRADE_NOTICE_EN;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickFallback(context) {
  const events = listEventTokens(context);
  if (events.length) return events[Math.floor(Math.random() * events.length)];
  const keywords = context.musicContext?.extractedKeywords || [];
  if (keywords.length) return keywords[Math.floor(Math.random() * keywords.length)];
  return isRu(context) ? 'сигнал деградирован' : 'signal degraded';
}

function pickContextInsertion(context) {
  const track = context.trackInfo || {};
  const keywords = track.keywords || context.musicContext?.extractedKeywords || [];
  const events = listEventTokens(context);
  if (keywords.length) {
    const token = keywords[Math.floor(Math.random() * keywords.length)];
    return { value: token, keywords: [token], trackKey: track.key || '' };
  }
  if (track.title) return { value: safeInsert(track.title, 40), trackKey: track.key || '' };
  if (track.artist) return { value: safeInsert(track.artist, 32), trackKey: track.key || '' };
  if (events.length) return { value: events[Math.floor(Math.random() * events.length)] };
  return null;
}

function listEventTokens(context) {
  const ru = isRu(context);
  const events = context.systemEvents || {};
  const tokens = [];
  if (events.cpuSpike) tokens.push(ru ? 'скачок cpu' : 'cpu spike');
  if (events.gpuSpike) tokens.push(ru ? 'скачок gpu' : 'gpu spike');
  if (events.netDrop) tokens.push(ru ? 'падение сети' : 'net drop');
  if (events.netRestore) tokens.push(ru ? 'сеть вернулась' : 'net restore');
  if (events.diskAnomaly) tokens.push(ru ? 'аномалия диска' : 'disk anomaly');
  if (events.glitchEvent) tokens.push(ru ? 'глитч' : 'glitch event');
  if (context.eventType && typeof context.eventType === 'string') {
    tokens.push(context.eventType.toLowerCase());
  }
  return tokens;
}

function insertToken(text, tokenInfo) {
  const insert = typeof tokenInfo === 'string' ? tokenInfo : tokenInfo?.value;
  if (!insert) return text;
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return `${insert} ${text}`.trim();
  const idx = Math.min(parts.length - 1, Math.floor(Math.random() * parts.length));
  parts.splice(idx, 0, insert);
  return parts.join(' ');
}

function applyStutter(text, context) {
  const glitch = context.glitchState || {};
  const chance = glitch.activeCount ? 0.18 : 0.08;
  if (Math.random() > chance) return text;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return text;
  const idx = Math.floor(Math.random() * tokens.length);
  tokens.splice(idx, 0, tokens[idx]);
  return tokens.join(' ');
}

function applyPunctuationDrop(text, context) {
  const glitch = context.glitchState || {};
  const chance = glitch.activeCount ? 0.65 : 0.35;
  if (Math.random() > chance) return text;
  return text.replace(/[.,;:]/g, '');
}

function applyAlienGlitch(text, context) {
  const glitch = context.glitchState || {};
  const symbols = context.symbolSet || [];
  if (!symbols.length) return text;
  const strength = clamp(glitch.alienAlphabetStrength ?? 0.7, 0, 2);
  const chance = clamp((glitch.activeCount ? 0.12 : 0.06) * strength, 0, 0.4);
  if (Math.random() > chance) return text;
  const chars = text.split('');
  const count = Math.max(1, Math.floor(chars.length * 0.08));
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    chars[idx] = symbols[Math.floor(Math.random() * symbols.length)] || chars[idx];
  }
  return chars.join('');
}

function hardCut(text, maxChars) {
  if (!text || text.length <= maxChars) return text;
  const cut = Math.min(text.length, Math.floor(60 + Math.random() * 30));
  return text.slice(0, Math.min(maxChars, cut)).trim();
}

function normalizeSpacing(text) {
  return text.replace(/\s+/g, ' ').trim();
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

function isRu(context) {
  const lang = context.language || '';
  return lang.toLowerCase().startsWith('ru');
}
