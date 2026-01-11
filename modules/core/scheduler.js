const DEFAULT_BACKOFF_MAX = 5 * 60 * 1000;

/**
 * @typedef {Object} SchedulerTaskConfig
 * @property {number} intervalMs
 * @property {number} [jitterMs]
 * @property {number} [backoffMaxMs]
 * @property {(now:number)=>Promise|void} handler
 * @property {boolean} [enabled]
 * @property {number} [initialDelayMs]
 */

/**
 * Simple task scheduler with backoff and jitter.
 */
export class Scheduler {
  constructor(options = {}) {
    this.tasks = new Map();
    this.now = options.now || (() => performance.now());
    this.activeTasks = 0;
  }

  addTask(id, config) {
    const task = {
      id,
      intervalMs: Math.max(200, config.intervalMs || 1000),
      jitterMs: Math.max(0, config.jitterMs || 0),
      backoffMaxMs: Math.max(1000, config.backoffMaxMs || DEFAULT_BACKOFF_MAX),
      handler: config.handler,
      enabled: config.enabled !== false,
      nextAt: this.now() + (config.initialDelayMs || 0),
      inFlight: false,
      failures: 0,
      lastRunAt: 0,
    };
    this.tasks.set(id, task);
    return task;
  }

  removeTask(id) {
    this.tasks.delete(id);
  }

  setEnabled(id, enabled) {
    const task = this.tasks.get(id);
    if (!task) return;
    task.enabled = !!enabled;
  }

  setInterval(id, intervalMs) {
    const task = this.tasks.get(id);
    if (!task) return;
    task.intervalMs = Math.max(200, intervalMs);
  }

  update(now = this.now()) {
    let active = 0;
    this.tasks.forEach(task => {
      if (!task.enabled || task.inFlight || now < task.nextAt) return;
      task.inFlight = true;
      active += 1;
      let result;
      try {
        result = task.handler?.(now);
      } catch (err) {
        task.failures += 1;
        const backoff = Math.min(task.backoffMaxMs, task.intervalMs * Math.pow(2, task.failures));
        task.nextAt = now + backoff;
        task.inFlight = false;
        return;
      }
      Promise.resolve(result)
        .then(res => {
          task.failures = 0;
          task.lastRunAt = now;
          task.nextAt = now + this._nextInterval(task);
          if (res && Number.isFinite(res.nextInMs)) {
            task.nextAt = now + Math.max(50, res.nextInMs);
          }
        })
        .catch(() => {
          task.failures += 1;
          const backoff = Math.min(task.backoffMaxMs, task.intervalMs * Math.pow(2, task.failures));
          task.nextAt = now + backoff;
        })
        .finally(() => {
          task.inFlight = false;
        });
    });
    this.activeTasks = active;
  }

  getActiveCount() {
    return this.activeTasks;
  }

  getTaskCount() {
    return this.tasks.size;
  }

  getTaskState(id) {
    const task = this.tasks.get(id);
    if (!task) return null;
    return {
      id: task.id,
      nextAt: task.nextAt,
      failures: task.failures,
      lastRunAt: task.lastRunAt,
      inFlight: task.inFlight,
      enabled: task.enabled,
    };
  }

  _nextInterval(task) {
    if (!task.jitterMs) return task.intervalMs;
    const offset = (Math.random() - 0.5) * task.jitterMs * 2;
    return Math.max(200, task.intervalMs + offset);
  }
}
