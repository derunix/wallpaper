export function rerankCandidates(candidates, count, context, personality, memory, options = {}) {
  if (!candidates || !candidates.length) return null;
  const limit = Math.min(count ?? candidates.length, candidates.length);
  if (limit <= 0) return null;
  const keywords = options.keywords || context.trackInfo?.keywords || context.musicContext?.extractedKeywords || [];
  const keywordSet = buildKeywordSet(keywords);
  const whineMarkers = options.whineMarkers || [];
  const sarcasmMarkers = options.sarcasmMarkers || [];
  const uncertaintyMarkers = options.uncertaintyMarkers || [];
  const minChars = options.minChars ?? 20;
  const maxChars = options.maxChars ?? 120;
  const desiredIntent = context.intent;

  const scored = [];
  for (let i = 0; i < limit; i++) {
    const cand = candidates[i];
    if (!cand || !cand.text) continue;
    const text = cand.text.trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    const tokens = cand.tokens || tokenize(text);
    if (!cand.tokens) cand.tokens = tokens;
    let score = 0;

    if (desiredIntent && cand.intent === desiredIntent) score += 0.6;
    const keywordHits = countHits(tokens, keywordSet);
    score += Math.min(0.5, keywordHits * 0.25);

    if (memory?.isTooSimilar && memory.isTooSimilar(text, cand.meta || {}, tokens)) score -= 2.2;

    const whineHit = containsAnyLower(lower, whineMarkers);
    if (whineHit) score += 0.35;
    else score -= 0.45;

    if (personality) {
      if (personality.fatigue > 0.6 && whineHit) score += 0.25;
      if (personality.irritation > 0.6 && containsAnyLower(lower, sarcasmMarkers)) score += 0.2;
      if (personality.suspicion > 0.5 && containsAnyLower(lower, uncertaintyMarkers)) score += 0.2;
      if (personality.coherence < 0.35 && cand.source === 'markov') score += 0.15;
    }

    if (text.length < minChars) score -= 0.4 + (minChars - text.length) * 0.01;
    if (text.length > maxChars) score -= 0.5 + (text.length - maxChars) * 0.01;

    if (hasRepeatedTokens(tokens)) score -= 0.25;
    if (hasEmoji(text)) score -= 0.8;
    if (hasSpammyPunct(text)) score -= 0.2;

    scored.push({ cand, score });
  }

  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);

  // Softmax sampling over top-3 to add controlled variety while preserving quality
  const topK = scored.slice(0, 3).filter(s => s.score > -1.5);
  if (!topK.length) return scored[0].cand;
  const weights = topK.map(s => Math.exp(s.score * 2.0));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < topK.length; i++) {
    r -= weights[i];
    if (r <= 0) return topK[i].cand;
  }
  return topK[0].cand;
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function countHits(tokens, keywordSet) {
  if (!keywordSet || keywordSet.size === 0) return 0;
  let hits = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (keywordSet.has(tokens[i])) hits += 1;
  }
  return hits;
}

function containsAnyLower(lower, list) {
  if (!lower || !list || !list.length) return false;
  for (let i = 0; i < list.length; i++) {
    const token = String(list[i]).toLowerCase();
    if (token && lower.includes(token)) return true;
  }
  return false;
}

function hasRepeatedTokens(tokens) {
  if (tokens.length < 4) return false;
  let streak = 1;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) {
      streak += 1;
      if (streak >= 3) return true;
    } else {
      streak = 1;
    }
  }
  return false;
}

function hasSpammyPunct(text) {
  return /([!?.,])\1{3,}/.test(text);
}

function hasEmoji(text) {
  return /[\u{1F300}-\u{1FAFF}]/u.test(text);
}

function buildKeywordSet(keywords) {
  if (!keywords || !keywords.length) return null;
  const set = new Set();
  for (let i = 0; i < keywords.length; i++) {
    const value = String(keywords[i]).toLowerCase();
    if (value) set.add(value);
  }
  return set;
}
