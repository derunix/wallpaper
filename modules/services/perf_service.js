import { fetchJson } from './http_utils.js';

/**
 * Performance polling service for local endpoint.
 */
export class PerfService {
  constructor(url, onUpdate = () => {}) {
    this.url = url;
    this.onUpdate = onUpdate;
    this.lastData = null;
  }

  setUrl(url) {
    this.url = url;
  }

  async fetch() {
    if (!this.url) throw new Error('Missing perf url');
    const data = await fetchJson(this.url, { timeoutMs: 2500 });
    this.lastData = data;
    this.onUpdate({ data, online: true });
    return data;
  }

  fail() {
    this.onUpdate({ data: this.lastData, online: false });
  }
}
