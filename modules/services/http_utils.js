import { fetchTracker } from '../core/fetch_tracker.js';

export async function fetchJson(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 4000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchTracker.track(fetch(url, { ...options, signal: controller.signal }));
    if (!res.ok) throw new Error('fetch failed');
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}
