import { fetchJson } from './http_utils.js';
import { isLHMData, parseLHMData } from './lhm_adapter.js';

/**
 * Performance polling service for local endpoint.
 * Auto-detects LibreHardwareMonitor /data.json format and normalizes it.
 */
const OFFLINE_GRACE_FAILURES = 3; // treat as online for first N consecutive failures

export class PerfService {
  constructor(url, onUpdate = () => {}) {
    this.url = url;
    this.onUpdate = onUpdate;
    this.lastData = null;
    this.consecutiveFailures = 0;
  }

  setUrl(url) {
    this.url = url;
    this.consecutiveFailures = 0;
  }

  async fetch() {
    if (!this.url) throw new Error('Missing perf url');
    const raw = await fetchJson(this.url, { timeoutMs: 10000 });
    const data = isLHMData(raw) ? parseLHMData(raw) : raw;
    this.lastData = data;
    this.consecutiveFailures = 0;
    this.onUpdate({ data, online: true });
    return data;
  }

  fail() {
    this.consecutiveFailures += 1;
    // Show as online during grace period (first N failures). After that — show КЭШ.
    // If monitoring is stable, fail() is never called, so КЭШ never appears.
    const online = this.consecutiveFailures < OFFLINE_GRACE_FAILURES;
    this.onUpdate({ data: this.lastData, online });
  }
}
