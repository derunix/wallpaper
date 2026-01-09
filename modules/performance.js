import { exponentialBackoff } from './utils.js';

export class PerformanceMonitor {
  constructor(url, onUpdate = () => {}, intervalSec = 5) {
    this.url = url;
    this.onUpdate = onUpdate;
    this.intervalSec = intervalSec;
    this.timer = null;
    this.attempt = 0;
    this.lastData = null;
  }

  start() {
    this.stop();
    this._poll();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  setInterval(intervalSec) {
    this.intervalSec = intervalSec;
    this.start();
  }

  async _poll() {
    try {
      const res = await fetch(this.url);
      if (!res.ok) throw new Error('perf fetch failed');
      const data = await res.json();
      this.lastData = data;
      this.attempt = 0;
      this.onUpdate({ data, online: true });
    } catch (err) {
      this.attempt++;
      this.onUpdate({ data: this.lastData, online: false });
    } finally {
      const delay = Math.max(this.intervalSec * 1000, exponentialBackoff(this.attempt, 2000, 60000));
      this.timer = setTimeout(() => this._poll(), delay);
    }
  }
}
