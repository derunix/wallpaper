/**
 * Tracks active fetches for diagnostics.
 */
export const fetchTracker = {
  active: 0,
  start() {
    this.active = Math.max(0, this.active + 1);
  },
  end() {
    this.active = Math.max(0, this.active - 1);
  },
  track(promise) {
    this.start();
    return promise.finally(() => this.end());
  },
};
