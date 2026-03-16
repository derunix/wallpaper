const DEFAULTS = {
  themecolorprimary: [0.553, 0.988, 0.31],
  themecolorsecondary: [0.247, 0.906, 1.0],
  backgroundcolor: [0.016, 0.027, 0.039],
  linethickness: 4,
  gridenabled: true,
  griddensity: 32,
  audiosensitivity: 1.1,
  audiosmoothing: 0.35,
  barscount: 48,
  waveformenabled: true,
  waveformheight: 0.25,
  backgroundequalizeralpha: 0.35,
  nowplayingenabled: true,
  nowplayingcoversize: 56,
  layoutpreset: 'Left HUD',
  hwpollintervalsec: 5,
  hwmonitorurl: 'http://172.25.160.1:8085/data.json',
  weatherenabled: true,
  weatherprovider: 'open-meteo',
  weatherapikey: '',
  weatherlat: 41.7167,
  weatherlon: 44.7833,
  units: 'metric',
  language: 'en-US',
  textscale: 1.25,
  showseconds: true,
  debugglitchoverlay: false,
  diagnosticsenabled: false,
  perfprofilerenabled: false,
  mooddebug: false,
  debugtextai: false,
  electriceffectsenabled: true,
  electricintensity: 1.2,
  electricarccooldown: 20,
  electricladderspeed: 1,
  electricaudioreactive: true,
  semantictextenabled: true,
  semantictextfrequency: 1,
  semantictextverbosity: 0.9,
  semantictextsarcasm: 0.7,
  semantictextdegradationstrength: 0.6,
  semantictextlanguageprofile: 'engineering',
  semantictextidlemode: true,
  textmodestrategy: 'auto',
  smartcandidatecount: 40,
  degradationsensitivity: 1,
  robotmodethreshold: 1,
  apologyenabled: true,
  preemptivewarnings: true,
  whiningintensity: 1.2,
  alienalphabetstrength: 1,
  moodreactivetext: true,
  moodreactivevisuals: true,
  moodaggressiveness: 1,
  logenabled: true,
  logmaxentries: 300,
  logshowtimestamp: true,
  logfontscale: 1.2,
  logpersistbetweensessions: true,
  visualprofile: 'ENGINEERING',
  entropylevel: 0.45,
  behaviormemoryenabled: true,
  narrativeeventsenabled: true,
  degradationenabled: true,
  timeofdayadaptive: true,
  glitchesenabled: true,
  glitchintervalminsec: 10,
  glitchintervalmaxsec: 20,
  glitchintensity: 1,
  musicreactiveglitches: true,
  localglitchesenabled: true,
  localglitchintensityboost: 1,
  localglitchfrequencyboost: 1,
  allowtwoblockglitches: true,
  maxsimultaneousglitches: 2,
  allowscreenwideeffects: true,
  bigeventchance: 0.2,
  chromaticaberrationenabled: true,
  aliensymbolset: '',
  interactivityenabled: true,
  hovereffectsenabled: true,
  clickeffectsenabled: true,
  cursortrailenabled: true,
  parallaxenabled: true,
  interactivecontrolsenabled: true,
  hiddengesturesenabled: true,
  idletimeoutsec: 60,
  uiresponsiveness: 1,
  tooltipsenabled: false,
  thresholdscpuhigh: 80,
  thresholdsgpuhigh: 80,
  thresholdsnethigh: 80,
  externalipenabled: true,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function parseColor01(input) {
  if (Array.isArray(input) && input.length >= 3) {
    return normalizeColor01(input[0], input[1], input[2]);
  }
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return [1, 1, 1];
    if (raw.startsWith('#') && (raw.length === 7 || raw.length === 4)) {
      const hex = raw.length === 4
        ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
        : raw;
      const num = parseInt(hex.slice(1), 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return normalizeColor01(r, g, b);
    }
    if (raw.startsWith('rgb')) {
      const nums = raw.replace(/[^\d,]/g, '').split(',').map(Number);
      if (nums.length >= 3) return normalizeColor01(nums[0], nums[1], nums[2]);
    }
    const parts = raw.split(/[\s,]+/).map(Number).filter(v => Number.isFinite(v));
    if (parts.length >= 3) return normalizeColor01(parts[0], parts[1], parts[2]);
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    return normalizeColor01(input, input, input);
  }
  return [1, 1, 1];
}

export function color01ToCss(rgb01) {
  const rgb255 = color01To255(rgb01);
  return `rgb(${rgb255[0]}, ${rgb255[1]}, ${rgb255[2]})`;
}

function color01To255(rgb01) {
  const r = clamp(rgb01[0] ?? 0, 0, 1);
  const g = clamp(rgb01[1] ?? 0, 0, 1);
  const b = clamp(rgb01[2] ?? 0, 0, 1);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function normalizeColor01(r, g, b) {
  const maxVal = Math.max(r, g, b);
  if (maxVal > 1.5) {
    return [clamp(r / 255, 0, 1), clamp(g / 255, 0, 1), clamp(b / 255, 0, 1)];
  }
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}

function toNumber(value, fallback) {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return !!value;
}

class SettingsStore {
  constructor(defaults) {
    this.defaults = { ...defaults };
    this.values = { ...defaults };
    this.colorKeys = new Set(
      Object.keys(defaults).filter(key => Array.isArray(defaults[key]) && defaults[key].length === 3)
    );
    this.colorCache = {};
    this.colorKeys.forEach(key => {
      this._setColor(key, defaults[key], false);
    });
  }

  applyFromWE(properties = {}) {
    const changed = new Set();
    if (!properties) return changed;
    Object.keys(properties).forEach(key => {
      if (!(key in this.values)) return;
      const prop = properties[key];
      const value = prop && prop.value !== undefined ? prop.value : prop;
      const def = this.defaults[key];
      if (this.colorKeys.has(key)) {
        if (this._setColor(key, value, true)) changed.add(key);
        return;
      }
      if (typeof def === 'boolean') {
        const next = toBool(value);
        if (next !== this.values[key]) {
          this.values[key] = next;
          changed.add(key);
        }
        return;
      }
      if (typeof def === 'number') {
        const next = toNumber(value, def);
        if (next !== this.values[key]) {
          this.values[key] = next;
          changed.add(key);
        }
        return;
      }
      const next = value === undefined || value === null ? '' : String(value);
      if (next !== this.values[key]) {
        this.values[key] = next;
        changed.add(key);
      }
    });
    return changed;
  }

  getBool(key) {
    return !!this.values[key];
  }

  getNumber(key) {
    const def = this.defaults[key];
    return toNumber(this.values[key], typeof def === 'number' ? def : 0);
  }

  getString(key) {
    const value = this.values[key];
    return value === undefined || value === null ? '' : String(value);
  }

  getColor01(key) {
    return this.colorCache[key]?.rgb01 || [1, 1, 1];
  }

  getColor255(key) {
    return this.colorCache[key]?.rgb255 || [255, 255, 255];
  }

  getColorCss(key) {
    return this.colorCache[key]?.css || 'rgb(255, 255, 255)';
  }

  _setColor(key, value, detectChange) {
    const next = parseColor01(value);
    const current = this.colorCache[key]?.rgb01 || [1, 1, 1];
    const changed =
      Math.abs(next[0] - current[0]) > 0.0001 ||
      Math.abs(next[1] - current[1]) > 0.0001 ||
      Math.abs(next[2] - current[2]) > 0.0001;
    if (!detectChange || changed) {
      const rgb255 = color01To255(next);
      this.colorCache[key] = {
        rgb01: next,
        rgb255,
        css: `rgb(${rgb255[0]}, ${rgb255[1]}, ${rgb255[2]})`,
      };
      this.values[key] = next;
    }
    return changed;
  }
}

const settings = new SettingsStore(DEFAULTS);

export { DEFAULTS, SettingsStore, settings };
