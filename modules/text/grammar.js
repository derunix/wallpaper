import { clamp } from '../utils.js';
import { INTENTS } from './planner.js';

export class WeightedGrammar {
  constructor(pack, lexiconPack, options = {}) {
    this.language = options.language || 'en-US';
    this.updatePack(pack, lexiconPack, this.language);
  }

  updatePack(pack, lexiconPack, language) {
    this.pack = pack || {};
    this.lexiconPack = lexiconPack || {};
    this.language = language || this.language;
    this._buildPools();
  }

  generate(context = {}) {
    const intent = context.intent || INTENTS.SYSTEM_COMMENT;
    if (intent === INTENTS.PREEMPTIVE_WARNING) {
      return { text: pick(this.preemptiveWarnings), meta: {} };
    }

    if (intent === INTENTS.RECOVERY_NOTE && context.apologyEnabled && Math.random() < 0.35) {
      const apology = pick(this.apologies);
      if (apology) return { text: apology, meta: {} };
    }

    const trackInfo = context.trackInfo || {};
    const keywords = trackInfo.keywords || context.musicContext?.extractedKeywords || [];
    const keyword = keywords.length ? pick(keywords) : '';
    const trackSnippet = this._buildTrackSnippet(trackInfo, keyword, intent);
    const diagnosticSnippet = this._buildDiagnosticSnippet(intent);
    const opener = this._maybePick(this.openers, 0.55);
    const subject = pick(this.subjects);
    const predicate = this._buildPredicate(intent);
    const qualifier = this._maybePick(this.qualifiers, 0.35);
    const whine = this._buildWhine(context);

    let parts = [];
    if (opener) parts.push(opener);
    if (subject && predicate) parts.push(`${subject} ${predicate}`);
    if (qualifier) parts.push(qualifier);
    if (diagnosticSnippet) parts.push(diagnosticSnippet);
    if (trackSnippet) parts.push(trackSnippet);
    if (whine) parts.push(whine);

    let text = cleanupSentence(parts.join('. '));
    text = enforceLength(text, context.maxChars || 120);

    if (text.length < (context.minChars || 20)) {
      const filler = trackSnippet || diagnosticSnippet || this._maybePick(this.qualifiers, 0.5);
      if (filler) text = cleanupSentence(`${text}. ${filler}`);
    }

    text = cleanupSentence(text);
    return {
      text,
      meta: {
        keywords: keyword ? [keyword] : [],
        trackKey: trackInfo.key || '',
      },
    };
  }

  _buildPools() {
    const pack = this.pack || {};
    const words = this.lexiconPack?.baseWords || {};
    const exhaustion = words.exhaustion_markers || pack.exhaustionMarkers || [];
    const sarcasm = words.sarcasm_markers || pack.sarcasmMarkers || [];
    const uncertainty = words.uncertainty_markers || pack.uncertaintyMarkers || [];
    const diagnostics = words.diagnostics_tokens || pack.diagnosticsTokens || [];
    const commands = words.command_tokens || pack.commandTokens || [];
    const failure = words.failure_markers || pack.failureMarkers || [];
    const repair = words.repair_markers || pack.repairMarkers || [];

    this.openers = [
      ...asWeighted(['note', 'status', 'signal', 'log', 'trace'], 0.9),
      ...asWeighted(['brief update', 'system note'], 0.6),
    ];
    this.subjects = [...(pack.entities || []), ...(pack.systemNouns || [])].slice(0, 120);
    this.qualifiers = [
      ...asWeighted(pack.connectives || [], 1),
      ...asWeighted(sarcasm, 0.9),
      ...asWeighted(uncertainty, 0.8),
    ];
    this.whines = [
      ...asWeighted(exhaustion, 1.2),
      ...asWeighted(pack.comments || [], 0.8),
      ...asWeighted(sarcasm, 0.6),
    ];
    this.diagnostics = [
      ...asWeighted(diagnostics, 1.1),
      ...asWeighted(commands, 0.9),
      ...asWeighted(failure, 0.85),
      ...asWeighted(repair, 0.7),
    ];
    // Personality-tuned pools for context-aware whine selection
    this.fatiguedPhrases = [...asWeighted(pack.idleFragments || [], 1.2), ...asWeighted(exhaustion, 1.0)];
    this.irritatedPhrases = [...asWeighted(sarcasm, 1.4), ...asWeighted(exhaustion, 0.7)];
    this.suspiciousPhrases = [...asWeighted(uncertainty, 1.3), ...asWeighted(diagnostics, 1.0)];

    if (this.language && this.language.toLowerCase().startsWith('ru')) {
      this.preemptiveWarnings = [
        'давление ресурсов растет. могу упроститься.',
        'нагрузка растет. речь может стать проще.',
        'пределы близко. интеллект урежу, если надо.',
      ];
      this.apologies = [
        'вернулся. бюджет мыслей восстановлен. извиняюсь за минимализм.',
        'снова в норме. да, было тупо. простите.',
      ];
      this.openers = [
        ...asWeighted(['заметка', 'статус', 'сигнал', 'лог', 'след'], 0.9),
        ...asWeighted(['кратко', 'отчет'], 0.6),
      ];
    } else {
      this.preemptiveWarnings = [
        'resource pressure rising. i may simplify soon.',
        'load trending up. output could get simple.',
        'limits narrowing. expect reduced language.',
      ];
      this.apologies = [
        'back. cognitive budget restored. sorry for the minimalism.',
        'recovered. apologies for the blunt mode.',
      ];
    }
  }

  _buildPredicate(intent) {
    const verbs = this.pack.verbs || [];
    const adjectives = this.pack.adjectives || [];
    const isRu = this.language.toLowerCase().startsWith('ru');
    if (intent === INTENTS.SELF_DIAG || intent === INTENTS.ANOMALY_WARNING) {
      return pick(verbs) || '';
    }
    if (Math.random() < 0.5) {
      const adj = pick(adjectives);
      if (!adj) return pick(verbs) || '';
      return isRu ? adj : `is ${adj}`;
    }
    return pick(verbs) || '';
  }

  _buildWhine(context) {
    const intensity = clamp(context.whiningIntensity ?? 1, 0, 2);
    const fatigue = clamp(context.personality?.fatigue ?? 0.5, 0, 1);
    const irritation = clamp(context.personality?.irritation ?? 0.4, 0, 1);
    const suspicion = clamp(context.personality?.suspicion ?? 0.4, 0, 1);
    const chance = clamp(0.65 + intensity * 0.2 + fatigue * 0.2, 0.5, 0.98);
    if (Math.random() > chance) return '';
    if (fatigue > 0.72 && this.fatiguedPhrases.length && Math.random() < 0.55) return pick(this.fatiguedPhrases);
    if (irritation > 0.72 && this.irritatedPhrases.length && Math.random() < 0.5) return pick(this.irritatedPhrases);
    if (suspicion > 0.72 && this.suspiciousPhrases.length && Math.random() < 0.45) return pick(this.suspiciousPhrases);
    return pick(this.whines);
  }

  _buildTrackSnippet(trackInfo, keyword, intent) {
    const title = safeInsert(trackInfo.title, 50);
    const artist = safeInsert(trackInfo.artist, 36);
    const preferTrack = intent === INTENTS.TRACK_REACT || Math.random() < 0.45;
    if (!preferTrack) return '';
    if (title) return `track: ${title}`;
    if (artist) return `artist: ${artist}`;
    if (keyword) return `keyword: ${keyword}`;
    return '';
  }

  _buildDiagnosticSnippet(intent) {
    if (intent !== INTENTS.SELF_DIAG && intent !== INTENTS.ANOMALY_WARNING) return '';
    const token = pick(this.diagnostics);
    if (!token) return '';
    return this.language.toLowerCase().startsWith('ru') ? `диагностика: ${token}` : `diag: ${token}`;
  }

  _maybePick(list, chance) {
    if (Math.random() > chance) return '';
    return pick(list);
  }
}

function enforceLength(text, maxLen) {
  if (!text) return '';
  let result = text.trim();
  if (result.length > maxLen) {
    result = result.slice(0, maxLen);
    result = result.replace(/[^\w)\]]+$/g, '').trim();
  }
  return result;
}

function cleanupSentence(text) {
  if (!text) return '';
  let result = text.replace(/\s+/g, ' ').trim();
  result = result.replace(/\s+\./g, '.').replace(/\.\s+\./g, '.');
  if (result && !/[.!?]$/.test(result)) result += '.';
  return result;
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

function pick(list) {
  if (!list || !list.length) return '';
  const hasWeights = typeof list[0] === 'object' && list[0] !== null && 'weight' in list[0];
  if (!hasWeights) return list[Math.floor(Math.random() * list.length)];
  const total = list.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    roll -= list[i].weight ?? 1;
    if (roll <= 0) return list[i].text || '';
  }
  return list[0].text || '';
}

function asWeighted(list, weight) {
  if (!Array.isArray(list)) return [];
  return list.map(item => ({ text: item, weight }));
}
