export function loadState(key, fallback = null) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (err) {
    return fallback;
  }
}

export function saveState(key, value) {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadWithTimestamp(key, maxAgeMs, fallback = null) {
  const payload = loadState(key, null);
  if (!payload || typeof payload !== 'object') return fallback;
  const ts = payload.t;
  if (!ts || (maxAgeMs && Date.now() - ts > maxAgeMs)) return fallback;
  return payload.value ?? fallback;
}

export function saveWithTimestamp(key, value) {
  return saveState(key, { t: Date.now(), value });
}
