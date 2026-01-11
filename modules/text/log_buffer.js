import { clamp } from '../utils.js';

const DEFAULT_MAX = 300;
const DEFAULT_KEY = 'hud_log_v1';

export class LogBuffer {
  constructor(options = {}) {
    this.maxEntries = clamp(options.maxEntries ?? DEFAULT_MAX, 50, 500);
    this.persist = options.persist ?? true;
    this.storageKey = options.storageKey || DEFAULT_KEY;
    this.entries = [];
    this._lastSave = 0;
    this._dirty = false;

    if (this.persist) this._load();
  }

  setMaxEntries(value) {
    this.maxEntries = clamp(value ?? DEFAULT_MAX, 50, 500);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    this._scheduleSave(true);
  }

  setPersist(enabled) {
    this.persist = !!enabled;
    if (!this.persist) return;
    this._load();
  }

  setStorageKey(key) {
    if (!key || key === this.storageKey) return;
    this.storageKey = key;
    if (this.persist) this._load();
  }

  clear() {
    this.entries = [];
    this._scheduleSave(true);
  }

  push(payload, level = 'info', timestamp = Date.now()) {
    let text = payload;
    let ts = timestamp;
    let mode = '';
    let intent = '';
    let entryLevel = level;
    if (payload && typeof payload === 'object') {
      text = payload.text;
      ts = payload.ts ?? timestamp;
      mode = payload.mode || '';
      intent = payload.intent || '';
      if (payload.level) entryLevel = payload.level;
    }
    if (!text || typeof text !== 'string') return;
    const trimmed = text.trim();
    if (!trimmed) return;
    this.entries.push({ text: trimmed, ts, level: entryLevel, mode, intent });
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    this._scheduleSave();
  }

  getEntries() {
    return this.entries;
  }

  getRecent(maxLines = 50) {
    if (!this.entries.length) return [];
    return this.entries.slice(-maxLines);
  }

  _load() {
    if (!this.storageKey) return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.entries)) {
        this.entries = parsed.entries.slice(-this.maxEntries).map(entry => ({
          text: String(entry.text ?? '').trim(),
          ts: Number(entry.ts) || Date.now(),
          level: entry.level || 'info',
          mode: entry.mode || '',
          intent: entry.intent || '',
        }));
      }
    } catch (err) {
      // Ignore storage errors.
    }
  }

  _scheduleSave(force = false) {
    if (!this.persist || !this.storageKey) return;
    const now = performance.now();
    if (!force && now - this._lastSave < 1200) {
      this._dirty = true;
      return;
    }
    this._save();
  }

  _save() {
    if (!this.persist || !this.storageKey) return;
    this._lastSave = performance.now();
    this._dirty = false;
    try {
      const payload = JSON.stringify({ entries: this.entries });
      localStorage.setItem(this.storageKey, payload);
    } catch (err) {
      // Ignore storage errors.
    }
  }

  flush() {
    if (this._dirty) this._save();
  }
}
