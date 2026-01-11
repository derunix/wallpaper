import { fetchJson } from './http_utils.js';
import { clamp } from '../utils.js';

const DEFAULT_COORDS = { lat: 41.7167, lon: 44.7833 };

/**
 * Weather service with simple caching and provider routing.
 */
export class WeatherService {
  constructor(options = {}, onUpdate = () => {}) {
    this.options = {
      provider: 'open-meteo',
      apiKey: '',
      units: 'metric',
      refreshMinutes: 20,
      ...options,
    };
    this.onUpdate = onUpdate;
    this.cache = null;
  }

  setOptions(opts = {}) {
    Object.assign(this.options, opts);
  }

  getCache() {
    return this.cache;
  }

  getCacheAgeMs() {
    if (!this.cache?.fetchedAt) return Infinity;
    return Date.now() - this.cache.fetchedAt;
  }

  getTtlMs() {
    const minutes = clamp(this.options.refreshMinutes ?? 15, 5, 15);
    return minutes * 60 * 1000;
  }

  isCacheFresh() {
    return this.getCacheAgeMs() < this.getTtlMs();
  }

  async fetch(options = {}) {
    if (!options.force && this.cache && this.isCacheFresh()) {
      this.onUpdate?.(this.cache, { cached: true });
      return this.cache;
    }
    const data = await this._fetchWeather();
    this.cache = data;
    this.onUpdate?.(data);
    return data;
  }

  async _fetchWeather() {
    if (this.options.provider === 'open-meteo') {
      return fetchOpenMeteo(this.options.units);
    }
    if (this.options.provider === 'owm') {
      return fetchOpenWeather(this.options.apiKey, this.options.units);
    }
    return fetchOpenMeteo(this.options.units);
  }
}

async function fetchOpenMeteo(units = 'metric') {
  const params = new URLSearchParams({
    latitude: DEFAULT_COORDS.lat,
    longitude: DEFAULT_COORDS.lon,
    current_weather: 'true',
    forecast_days: '3',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const data = await fetchJson(url, { timeoutMs: 4500 });
  const current = data.current_weather || {};
  const codeInfo = mapOpenMeteoCode(current.weathercode);
  const daily = data.daily || {};
  const days = (daily.time || []).slice(0, 3).map((date, i) => {
    const rawMax = daily.temperature_2m_max?.[i] ?? null;
    const rawMin = daily.temperature_2m_min?.[i] ?? null;
    const tempMax = convertTemp(rawMax, units);
    const tempMin = convertTemp(rawMin, units);
    const precip = daily.precipitation_probability_max?.[i] ?? null;
    return {
      day: new Date(date),
      tempMax,
      tempMin,
      precip,
    };
  });
  const wind = current.windspeed ?? null;
  const windConverted = wind !== null ? (units === 'imperial' ? wind * 0.621371 : wind) : null;
  const windLabel = units === 'imperial' ? 'mph' : 'km/h';
  return normalizeWeather(
    {
      temp: convertTemp(current.temperature, units),
      condition: codeInfo.label || (windConverted !== null ? `Wind ${windConverted.toFixed(0)} ${windLabel}` : 'Calm'),
      icon: codeInfo.icon || 'unknown',
    },
    days,
    units
  );
}

async function fetchOpenWeather(apiKey, units = 'metric') {
  if (!apiKey) throw new Error('Missing weather API key');
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${DEFAULT_COORDS.lat}&lon=${DEFAULT_COORDS.lon}&cnt=24&units=${units}&appid=${apiKey}`;
  const data = await fetchJson(url, { timeoutMs: 4500 });
  const current = data.list?.[0];
  const codeInfo = mapOwmCode(current?.weather?.[0]?.id);
  const days = aggregateDaily(data.list || []);
  return normalizeWeather(
    {
      temp: convertTemp(current?.main?.temp, units),
      condition: codeInfo.label || current?.weather?.[0]?.description || 'n/a',
      icon: codeInfo.icon || 'unknown',
    },
    days,
    units
  );
}

function aggregateDaily(list) {
  const byDay = {};
  list.forEach(entry => {
    const day = entry.dt_txt?.split(' ')[0];
    if (!day) return;
    const temp = entry.main?.temp;
    if (!byDay[day]) byDay[day] = { min: temp, max: temp, precip: 0, count: 0 };
    byDay[day].min = Math.min(byDay[day].min, temp);
    byDay[day].max = Math.max(byDay[day].max, temp);
    byDay[day].precip = Math.max(byDay[day].precip, entry.pop || 0);
    byDay[day].count++;
  });
  return Object.entries(byDay)
    .slice(0, 3)
    .map(([date, val]) => ({
      day: new Date(date),
      tempMax: val.max,
      tempMin: val.min,
      precip: Math.round(val.precip * 100),
    }));
}

function normalizeWeather(current, forecast, units) {
  return {
    current,
    forecast,
    units,
    fetchedAt: Date.now(),
  };
}

function mapOpenMeteoCode(code) {
  if (code === 0) return { label: 'Clear', icon: 'clear' };
  if (code === 1 || code === 2) return { label: 'Partly cloudy', icon: 'partly' };
  if (code === 3) return { label: 'Cloudy', icon: 'cloudy' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' };
  if (code === 51 || code === 53 || code === 55) return { label: 'Drizzle', icon: 'drizzle' };
  if (code === 56 || code === 57) return { label: 'Freezing drizzle', icon: 'drizzle' };
  if (code === 61 || code === 63 || code === 65) return { label: 'Rain', icon: 'rain' };
  if (code === 66 || code === 67) return { label: 'Freezing rain', icon: 'rain' };
  if (code === 71 || code === 73 || code === 75 || code === 77) return { label: 'Snow', icon: 'snow' };
  if (code === 80 || code === 81 || code === 82) return { label: 'Showers', icon: 'rain' };
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'snow' };
  if (code === 95 || code === 96 || code === 99) return { label: 'Storm', icon: 'storm' };
  return { label: 'Weather', icon: 'unknown' };
}

function mapOwmCode(code) {
  if (!code) return { label: 'Weather', icon: 'unknown' };
  if (code >= 200 && code < 300) return { label: 'Storm', icon: 'storm' };
  if (code >= 300 && code < 400) return { label: 'Drizzle', icon: 'drizzle' };
  if (code >= 500 && code < 600) return { label: 'Rain', icon: 'rain' };
  if (code >= 600 && code < 700) return { label: 'Snow', icon: 'snow' };
  if (code >= 700 && code < 800) return { label: 'Fog', icon: 'fog' };
  if (code === 800) return { label: 'Clear', icon: 'clear' };
  if (code > 800) return { label: 'Cloudy', icon: 'cloudy' };
  return { label: 'Weather', icon: 'unknown' };
}

function convertTemp(value, units) {
  if (value === null || value === undefined) return null;
  if (units === 'imperial') {
    return (value * 9) / 5 + 32;
  }
  return value;
}
