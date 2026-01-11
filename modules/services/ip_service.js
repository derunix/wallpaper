import { fetchJson } from './http_utils.js';
import { clamp } from '../utils.js';

/**
 * External IP lookup with TTL caching.
 */
export class ExternalIpService {
  constructor(options = {}, onUpdate = () => {}) {
    if (typeof options === 'function') {
      onUpdate = options;
      options = {};
    }
    this.options = {
      ttlMinutes: 60,
      ...options,
    };
    this.onUpdate = onUpdate;
    this.cache = null;
  }

  getCache() {
    return this.cache;
  }

  setOptions(opts = {}) {
    Object.assign(this.options, opts);
  }

  _ttlMs() {
    const minutes = clamp(this.options.ttlMinutes ?? 60, 30, 120);
    return minutes * 60 * 1000;
  }

  _isFresh() {
    if (!this.cache?.fetchedAt) return false;
    return Date.now() - this.cache.fetchedAt < this._ttlMs();
  }

  async fetch(options = {}) {
    if (!options.force && this.cache && this._isFresh()) {
      this.onUpdate?.(this.cache, { cached: true });
      return this.cache;
    }
    const data = await fetchJson('https://api.ipify.org?format=json', { timeoutMs: 2500, cache: 'no-store' });
    const value = data?.ip || '';
    this.cache = value ? { value, fetchedAt: Date.now() } : null;
    this.onUpdate(this.cache);
    return this.cache;
  }
}
