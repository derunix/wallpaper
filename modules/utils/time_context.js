export class TimeContext {
  constructor(options = {}) {
    this.options = {
      dayStart: 7,
      eveningStart: 18,
      nightStart: 23,
      ...options,
    };
    this.sessionStart = Date.now();
    this.phase = 'day';
    this.dateKey = this._dateKey(new Date());
    this.dateChanged = false;
    this.hour = 0;
    this.dayProgress = 0;
  }

  update(now = Date.now()) {
    const date = new Date(now);
    const hour = date.getHours();
    this.hour = hour;
    const key = this._dateKey(date);
    this.dateChanged = key !== this.dateKey;
    this.dateKey = key;

    const { dayStart, eveningStart, nightStart } = this.options;
    if (hour >= nightStart || hour < dayStart) this.phase = 'night';
    else if (hour >= eveningStart) this.phase = 'evening';
    else this.phase = 'day';

    const minutes = hour * 60 + date.getMinutes();
    this.dayProgress = minutes / (24 * 60);

    return this.getState();
  }

  getState() {
    const sessionMinutes = (Date.now() - this.sessionStart) / 60000;
    const dayFactor = this.phase === 'day' ? 1 : 0.75;
    const eveningFactor = this.phase === 'evening' ? 1 : 0.6;
    const nightFactor = this.phase === 'night' ? 1 : 0.7;
    const instabilityBias = this.phase === 'evening' ? 0.35 : this.phase === 'night' ? 0.15 : 0.1;
    return {
      phase: this.phase,
      hour: this.hour,
      dayFactor,
      eveningFactor,
      nightFactor,
      instabilityBias,
      dayProgress: this.dayProgress,
      dateKey: this.dateKey,
      dateChanged: this.dateChanged,
      sessionMinutes,
      isNight: this.phase === 'night',
    };
  }

  _dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
