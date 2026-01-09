import { AudioEngine, registerWallpaperAudio } from './modules/audio.js';
import { drawBackground, drawForeground } from './modules/hud.js';
import { NowPlayingService } from './modules/nowplaying.js';
import { WeatherService } from './modules/weather.js';
import { PerformanceMonitor } from './modules/performance.js';
import { AudioDriver } from './modules/audio/audio_driver.js';
import { GlitchSystem } from './modules/glitch/index.js';
import { DEFAULT_SYMBOL_SET } from './modules/glitch/text_scramble.js';
import { InputManager } from './modules/input/input_manager.js';
import { hitTest } from './modules/input/hit_test.js';
import { EventBus } from './modules/interaction/event_bus.js';
import { InteractionFX } from './modules/interaction/interaction_fx.js';
import { InteractionStateMachine } from './modules/interaction/state_machine.js';
import { MicroAnimations } from './modules/interaction/micro_animations.js';
import { OverlayMessages } from './modules/interaction/overlay_messages.js';
import { DiagnosticsMode } from './modules/interaction/diagnostics_mode.js';
import { BehaviorMemory } from './modules/core/behavior_memory.js';
import { EntropyController } from './modules/core/entropy_controller.js';
import { CoreStateMachine } from './modules/core/state_machine.js';
import { NarrativeEngine } from './modules/core/narrative_engine.js';
import { TimeContext } from './modules/utils/time_context.js';
import { loadState, saveState } from './modules/utils/persistence.js';
import { SemanticEngine } from './modules/text/semantic_engine.js';
import { LogBuffer } from './modules/text/log_buffer.js';
import { LogRenderer } from './modules/text/log_renderer.js';
import { buildCalendarData, renderCalendar as renderCalendarCanvas } from './modules/ui/render_calendar.js';
import {
  setupHiDPICanvas,
  clamp,
  formatSpeed,
  formatTemperature,
  formatPercent,
  formatMemoryPair,
  formatDateTime,
} from './modules/utils.js';

const bgCanvas = document.getElementById('bg-canvas');
const fgCanvas = document.getElementById('fg-canvas');
const overlay = document.getElementById('hud-overlay');
const debugOverlay = document.getElementById('debug-overlay');
const hudCanvas = document.createElement('canvas');

const trackTitleEl = document.getElementById('track-title');
const trackArtistEl = document.getElementById('track-artist');
const trackStatusEl = document.getElementById('track-status');
const coverEl = document.getElementById('cover');
const systemTextPanelEl = document.getElementById('system-text-panel');
const systemTextEl = document.getElementById('system-text');
const systemTextTitleEl = document.getElementById('title-system-text');
const clockTimeEl = document.getElementById('clock-time');
const clockDateEl = document.getElementById('clock-date');
const calendarHeaderEl = document.getElementById('calendar-header');
const calendarGridEl = document.getElementById('calendar-grid');
const calendarEl = document.querySelector('.calendar');
const weatherTempEl = document.getElementById('weather-temp');
const weatherCityEl = document.getElementById('weather-city');
const weatherCondEl = document.getElementById('weather-cond');
const weatherForecastEl = document.getElementById('weather-forecast');
const weatherIconEl = document.getElementById('weather-icon');
const metricsEls = {
  cpu: {
    value: document.getElementById('cpu-value'),
    temp: document.getElementById('cpu-temp'),
    bar: document.getElementById('cpu-bar'),
  },
  gpu: {
    value: document.getElementById('gpu-value'),
    temp: document.getElementById('gpu-temp'),
    bar: document.getElementById('gpu-bar'),
  },
  ram: {
    value: document.getElementById('ram-value'),
    temp: document.getElementById('ram-extra'),
    bar: document.getElementById('ram-bar'),
  },
  vram: {
    value: document.getElementById('vram-value'),
    temp: document.getElementById('vram-extra'),
    bar: document.getElementById('vram-bar'),
  },
};
const netDownEl = document.getElementById('net-down');
const netUpEl = document.getElementById('net-up');
const netIpEl = document.getElementById('net-ip');
const diskCEl = document.getElementById('disk-c');
const diskDEl = document.getElementById('disk-d');
const hwStatusEl = document.getElementById('hw-status');
const hwUpdateEl = document.getElementById('hw-update');
const cpuCoresEl = document.getElementById('cpu-cores');

const panelNowPlayingEl = document.getElementById('panel-nowplaying');
const panelWeatherEl = document.getElementById('panel-weather');
const panelClockEl = document.getElementById('panel-clock');
const panelMetricsEl = document.getElementById('panel-performance');
const panelNetworkEl = document.getElementById('panel-network');
const panelDisksEl = document.getElementById('panel-disks');

const blockElements = {
  nowPlaying: panelNowPlayingEl,
  systemText: systemTextPanelEl,
  weather: panelWeatherEl,
  time: panelClockEl,
  calendar: panelClockEl,
  system: panelMetricsEl,
  network: panelNetworkEl,
  disks: panelDisksEl,
  waveform: null,
};

const titleEls = {
  nowPlaying: document.getElementById('title-nowplaying'),
  systemText: document.getElementById('title-system-text'),
  weather: document.getElementById('title-weather'),
  clock: document.getElementById('title-clock'),
  metrics: document.getElementById('title-metrics'),
  network: document.getElementById('title-network'),
  disks: document.getElementById('title-disks'),
};

const labelEls = {
  cpu: document.getElementById('label-cpu'),
  gpu: document.getElementById('label-gpu'),
  ram: document.getElementById('label-ram'),
  vram: document.getElementById('label-vram'),
  down: document.getElementById('label-down'),
  up: document.getElementById('label-up'),
  ip: document.getElementById('label-ip'),
  diskC: document.getElementById('label-disk-c'),
  diskD: document.getElementById('label-disk-d'),
};

let bgCtx, fgCtx, hudCtx, dimensions;
let clockTimer = null;
let ipTimer = null;
let lastCoverSrc = null;
let lastTrackKey = null;
let blocks = {};
let blockLabels = {};
let textTargets = [];
let lastPerfOnline = null;
let lastMetrics = null;
let calendarOffset = 0;
let lastFrame = performance.now();
let profileOverride = null;
let glitchUpdateTimer = 0;
let logDisplayState = { level: 0, jitter: 0, flicker: 0 };
const systemEventTracker = createEventTracker();
const userEventTracker = createEventTracker();
let idleDuration = 0;
let wasIdle = false;
let clickTimes = [];
let hoverTextTime = 0;
let lastHoverTextAt = 0;
let lastWeatherSignature = null;
let lastDiskUsage = { c: null, d: null };
let lastNetDown = null;
let lastBigEventActive = false;
let lastLongIdleAt = 0;
let calendarData = null;
const jitterTimers = new WeakMap();

const state = {
  colors: {
    background: '#04070a',
    primary: '#8dfc4f',
    secondary: '#3fe7ff',
  },
  baseColors: {
    background: '#04070a',
    primary: '#8dfc4f',
    secondary: '#3fe7ff',
  },
  lineThickness: 4,
  gridEnabled: true,
  gridDensity: 32,
  gridAlpha: 0.18,
  gridAlphaBase: 0.18,
  bgEQAlpha: 0.35,
  bgEQAlphaBase: 0.35,
  layoutPreset: 'Left HUD',
  audio: {
    bars: [],
    waveform: [],
    waveformEnabled: true,
    waveformHeight: 0.25,
  },
  showSeconds: true,
  language: 'en-US',
  textScale: 1.25,
  units: 'metric',
  visualProfile: 'ENGINEERING',
  activeProfile: 'ENGINEERING',
  entropyLevel: 0.45,
  behaviorMemoryEnabled: true,
  narrativeEventsEnabled: true,
  degradationEnabled: true,
  timeOfDayAdaptive: true,
  hiddenGesturesEnabled: true,
  weatherEnabled: true,
  externalIpEnabled: true,
  glitchConfig: {
    glitchesEnabled: true,
    glitchIntervalMinSec: 10,
    glitchIntervalMaxSec: 20,
    glitchIntensity: 1,
    musicReactiveGlitches: true,
    maxSimultaneousGlitches: 2,
    allowScreenWideEffects: true,
    bigEventChance: 0.2,
    chromaticAberrationEnabled: true,
    alienAlphabetStrength: 0.7,
    alienSymbolSet: DEFAULT_SYMBOL_SET,
    debugGlitchOverlay: false,
  },
  interactivity: {
    interactivityEnabled: true,
    hoverEffectsEnabled: true,
    clickEffectsEnabled: true,
    cursorTrailEnabled: true,
    parallaxEnabled: true,
    interactiveControlsEnabled: true,
    hiddenGesturesEnabled: true,
    idleTimeoutSec: 60,
    uiResponsiveness: 1,
    tooltipsEnabled: false,
    diagnosticsEnabled: false,
  },
  log: {
    enabled: true,
    maxEntries: 300,
    showTimestamp: true,
    fontScale: 1.2,
    persist: true,
  },
  semanticText: {
    enabled: true,
    frequency: 1,
    verbosity: 0.9,
    sarcasm: 0.7,
    degradationStrength: 0.6,
    languageProfile: 'engineering',
    idleMode: true,
  },
  layerOffsets: {
    grid: { x: 0, y: 0 },
    panels: { x: 0, y: 0 },
    text: { x: 0, y: 0 },
  },
  systemModifiers: {
    contrast: 1,
    textJitter: 0,
    glitchBoost: 0,
    responseScale: 1,
  },
  profileGlitchScale: 1,
  profileResponseScale: 1,
  profileContrast: 1,
  idleGlitchScale: 1,
  idleIntervalScale: 1,
  thresholds: {
    cpuHigh: 80,
    gpuHigh: 80,
    netHigh: 80,
  },
  cache: {
    weather: null,
    perf: null,
    perfOnline: false,
    track: null,
    ip: null,
  },
  hudLayout: null,
};

const PROFILE_STORAGE_KEY = 'hud_profile_v1';
const persistedProfile = loadState(PROFILE_STORAGE_KEY, null);
if (persistedProfile) state.visualProfile = persistedProfile;

const I18N = {
  'en-US': {
    titles: {
      nowPlaying: 'NOW PLAYING',
      systemText: 'INTERNAL LOG',
      weather: 'WEATHER',
      clock: 'LOCAL TIME',
      calendar: 'CALENDAR',
      metrics: 'SYSTEM LOAD',
      network: 'NETWORK',
      disks: 'DISKS',
      waveform: 'WAVEFORM',
    },
    labels: {
      cpu: 'CPU',
      gpu: 'GPU',
      ram: 'RAM',
      vram: 'VRAM',
      down: 'DOWN',
      up: 'UP',
      ip: 'IP',
      diskC: 'DISK C:',
      diskD: 'DISK D:',
    },
    nowPlaying: {
      noData: 'NO TRACK DATA',
      noArtist: 'ARTIST',
      status: {
        playing: 'PLAYING',
        paused: 'PAUSED',
        stopped: 'STOPPED',
        idle: 'IDLE',
      },
    },
    weather: {
      city: 'TBILISI',
      noData: 'NO WEATHER DATA',
      today: 'TODAY',
      conditions: {
        clear: 'CLEAR',
        partly: 'PARTLY CLOUDY',
        cloudy: 'CLOUDY',
        rain: 'RAIN',
        drizzle: 'DRIZZLE',
        snow: 'SNOW',
        storm: 'STORM',
        fog: 'FOG',
        unknown: 'WEATHER',
      },
    },
    network: {
      ipUnavailable: 'IP UNAVAILABLE',
      ipDisabled: 'IP DISABLED',
    },
    messages: {
      trackAcquired: 'TRACK ACQUIRED',
      hwOnline: 'HW ONLINE',
      hwOffline: 'HW OFFLINE',
      hudWake: 'HUD WAKE',
      sensitivity: 'SENSITIVITY',
      thermalSpike: 'THERMAL SPIKE',
      gpuOverload: 'GPU OVERLOAD',
      linkSaturated: 'LINK SATURATED',
      attentionAcquired: 'ATTENTION ACQUIRED',
      selfRecovery: 'SELF-RECOVERY',
      anomalyDetected: 'ANOMALY DETECTED',
      unexpectedTraffic: 'UNEXPECTED TRAFFIC',
      sensorDesync: 'SENSOR DESYNC',
      dataConfirmed: 'DATA CONFIRMED',
      blockPinned: 'BLOCK PINNED',
      blockUnpinned: 'PIN RELEASED',
      signalInstability: 'SIGNAL INSTABILITY',
      realigningData: 'REALIGNING DATA',
      stable: 'STABLE',
      sensorSync: 'SENSOR SYNC',
      linkResync: 'LINK RESYNC',
      linkStable: 'LINK STABLE',
      audioResync: 'AUDIO RESYNC',
      audioStable: 'AUDIO STABLE',
      memoryReallocation: 'MEMORY REALLOCATION',
      indexComplete: 'INDEX COMPLETE',
      observationPass: 'OBSERVATION PASS',
      engineeringMode: 'ENGINEERING MODE',
      signatureTrace: 'SIGNATURE TRACE',
      lockConfirmed: 'LOCK CONFIRMED',
      processBackgroundIndexing: 'BACKGROUND INDEXING',
      processSignalCalibration: 'SIGNAL CALIBRATION',
      processMemoryReallocation: 'MEMORY REALLOCATION',
      processSensorSync: 'SENSOR SYNC',
      processDataCompression: 'DATA COMPRESSION',
    },
    interaction: {
      tooltip: 'INTERACTION ACTIVE',
      pin: 'PIN',
      menu: {
        grid: 'TOGGLE GRID',
        glitch: 'TOGGLE GLITCHES',
        diag: 'TOGGLE DIAGNOSTICS',
        reset: 'RESET LAYOUT',
      },
      events: {
        calibration: 'CALIBRATION MODE',
        dataRealign: 'DATA REALIGN',
        linkResync: 'LINK RESYNC',
        audioResync: 'AUDIO RESYNC',
        selfTest: 'HUD SELF-TEST',
        refreshSweep: 'PANEL REFRESH',
      },
    },
    hw: {
      online: 'HW ONLINE',
      offline: 'HW OFFLINE',
      cached: 'HW OFFLINE (CACHED)',
      waiting: 'HW WAITING',
      last: 'LAST',
    },
  },
  'ru-RU': {
    titles: {
      nowPlaying: 'СЕЙЧАС ИГРАЕТ',
      systemText: 'ВНУТРЕННИЙ ЛОГ',
      weather: 'ПОГОДА',
      clock: 'МЕСТНОЕ ВРЕМЯ',
      calendar: 'КАЛЕНДАРЬ',
      metrics: 'НАГРУЗКА СИСТЕМЫ',
      network: 'СЕТЬ',
      disks: 'ДИСКИ',
      waveform: 'ВОЛНА',
    },
    labels: {
      cpu: 'CPU',
      gpu: 'GPU',
      ram: 'RAM',
      vram: 'VRAM',
      down: 'ЗАГРУЗКА',
      up: 'ОТДАЧА',
      ip: 'IP',
      diskC: 'ДИСК C:',
      diskD: 'ДИСК D:',
    },
    nowPlaying: {
      noData: 'НЕТ ДАННЫХ',
      noArtist: 'ИСПОЛНИТЕЛЬ',
      status: {
        playing: 'ИГРАЕТ',
        paused: 'ПАУЗА',
        stopped: 'СТОП',
        idle: 'ОЖИДАНИЕ',
      },
    },
    weather: {
      city: 'ТБИЛИСИ',
      noData: 'НЕТ ДАННЫХ ПОГОДЫ',
      today: 'СЕГОДНЯ',
      conditions: {
        clear: 'ЯСНО',
        partly: 'ПЕРЕМЕННО',
        cloudy: 'ОБЛАЧНО',
        rain: 'ДОЖДЬ',
        drizzle: 'МОРОСЬ',
        snow: 'СНЕГ',
        storm: 'ГРОЗА',
        fog: 'ТУМАН',
        unknown: 'ПОГОДА',
      },
    },
    network: {
      ipUnavailable: 'IP НЕДОСТУПЕН',
      ipDisabled: 'IP ВЫКЛ',
    },
    messages: {
      trackAcquired: 'ТРЕК ПОЛУЧЕН',
      hwOnline: 'ЖЕЛЕЗО В СЕТИ',
      hwOffline: 'ЖЕЛЕЗО ОФФЛАЙН',
      hudWake: 'ИНТЕРФЕЙС АКТИВЕН',
      sensitivity: 'ЧУВСТВИТЕЛЬНОСТЬ',
      thermalSpike: 'ТЕМПЕРАТУРНЫЙ ПИК',
      gpuOverload: 'ГПУ ПЕРЕГРУЗКА',
      linkSaturated: 'КАНАЛ ЗАГРУЖЕН',
      attentionAcquired: 'ВНИМАНИЕ ПОЛУЧЕНО',
      selfRecovery: 'САМОВОССТАНОВЛЕНИЕ',
      anomalyDetected: 'АНОМАЛИЯ ОБНАРУЖЕНА',
      unexpectedTraffic: 'НЕОЖИДАННЫЙ ТРАФИК',
      sensorDesync: 'ДЕСИНХРОН СЕНСОРОВ',
      dataConfirmed: 'ДАННЫЕ ПОДТВЕРЖДЕНЫ',
      blockPinned: 'БЛОК ЗАКРЕПЛЕН',
      blockUnpinned: 'СНЯТО ЗАКРЕПЛЕНИЕ',
      signalInstability: 'НЕСТАБИЛЬНЫЙ СИГНАЛ',
      realigningData: 'ВЫРАВНИВАНИЕ ДАННЫХ',
      stable: 'СТАБИЛЬНО',
      sensorSync: 'СИНХРОН СЕНСОРОВ',
      linkResync: 'РЕСИНК ЛИНКА',
      linkStable: 'ЛИНК СТАБИЛЕН',
      audioResync: 'РЕСИНК АУДИО',
      audioStable: 'АУДИО СТАБИЛЬНО',
      memoryReallocation: 'ПЕРЕРАСПРЕДЕЛЕНИЕ ПАМЯТИ',
      indexComplete: 'ИНДЕКС ГОТОВ',
      observationPass: 'НАБЛЮДЕНИЕ',
      engineeringMode: 'ИНЖЕНЕРНЫЙ РЕЖИМ',
      signatureTrace: 'СИГНАТУРА ОБНАРУЖЕНА',
      lockConfirmed: 'БЛОКИРОВКА ПОДТВЕРЖДЕНА',
      processBackgroundIndexing: 'ФОНОВАЯ ИНДЕКСАЦИЯ',
      processSignalCalibration: 'КАЛИБРОВКА СИГНАЛА',
      processMemoryReallocation: 'ПЕРЕРАСПРЕДЕЛЕНИЕ ПАМЯТИ',
      processSensorSync: 'СИНХРОНИЗАЦИЯ СЕНСОРОВ',
      processDataCompression: 'СЖАТИЕ ДАННЫХ',
    },
    interaction: {
      tooltip: 'ИНТЕРАКТИВНО',
      pin: 'ФИКС',
      menu: {
        grid: 'СЕТКА',
        glitch: 'ГЛИТЧИ',
        diag: 'ДИАГНОСТИКА',
        reset: 'СБРОС РАЗМЕТКИ',
      },
      events: {
        calibration: 'КАЛИБРОВКА',
        dataRealign: 'ВЫРАВНИВАНИЕ ДАННЫХ',
        linkResync: 'РЕСИНК ЛИНКА',
        audioResync: 'РЕСИНК АУДИО',
        selfTest: 'HUD САМОДИАГНОСТИКА',
        refreshSweep: 'ОБНОВЛЕНИЕ ПАНЕЛИ',
      },
    },
    hw: {
      online: 'ЖЕЛЕЗО В СЕТИ',
      offline: 'ЖЕЛЕЗО ОФФЛАЙН',
      cached: 'ЖЕЛЕЗО ОФФЛАЙН (КЭШ)',
      waiting: 'ЖЕЛЕЗО ОЖИДАНИЕ',
      last: 'ПОСЛЕДНЕЕ',
    },
  },
};

const VISUAL_PROFILES = {
  ENGINEERING: { contrast: 1, gridAlpha: 0.18, bgEQAlpha: 1, glitchScale: 1, responseScale: 1 },
  DIAGNOSTIC: { contrast: 1.12, gridAlpha: 0.22, bgEQAlpha: 1.15, glitchScale: 1.15, responseScale: 1.2 },
  OBSERVATION: { contrast: 0.92, gridAlpha: 0.14, bgEQAlpha: 0.85, glitchScale: 0.85, responseScale: 0.9 },
  MINIMAL: { contrast: 0.82, gridAlpha: 0.1, bgEQAlpha: 0.6, glitchScale: 0.65, responseScale: 0.75 },
};

const audioEngine = new AudioEngine({
  barsCount: 48,
  smoothing: 0.35,
  sensitivity: 1.1,
});

let logBuffer = new LogBuffer({
  maxEntries: state.log.maxEntries,
  persist: state.log.persist,
  storageKey: getLogStorageKey(state.language),
});
const logRenderer = new LogRenderer({
  fontScale: state.log.fontScale,
  textScale: state.textScale,
  showTimestamp: state.log.showTimestamp,
  locale: state.language,
});

const eventBus = new EventBus();
const audioDriver = new AudioDriver();
const timeContext = new TimeContext();
const behaviorMemory = new BehaviorMemory({ enabled: state.behaviorMemoryEnabled });
const entropyController = new EntropyController({
  base: state.entropyLevel,
  timeAdaptive: state.timeOfDayAdaptive,
});
const coreStateMachine = new CoreStateMachine(eventBus, {
  degradationEnabled: state.degradationEnabled,
  timeOfDayAdaptive: state.timeOfDayAdaptive,
});
const narrativeEngine = new NarrativeEngine(eventBus, { enabled: state.narrativeEventsEnabled });
const semanticEngine = new SemanticEngine({
  enabled: state.semanticText.enabled,
  frequency: state.semanticText.frequency,
  verbosity: state.semanticText.verbosity,
  sarcasm: state.semanticText.sarcasm,
  degradationStrength: state.semanticText.degradationStrength,
  languageProfile: state.semanticText.languageProfile,
  idleMode: state.semanticText.idleMode,
  language: state.language,
});
const inputManager = new InputManager(window, { idleTimeoutSec: state.interactivity.idleTimeoutSec });
const interactionFX = new InteractionFX(eventBus, {
  ...state.interactivity,
  textScale: state.textScale,
  symbolSet: state.glitchConfig.alienSymbolSet,
});
const stateMachine = new InteractionStateMachine(eventBus, { idleTimeoutSec: state.interactivity.idleTimeoutSec });
const microAnimations = new MicroAnimations(eventBus, state.thresholds, { textScale: state.textScale });
const overlayMessages = new OverlayMessages(eventBus, resolveMessageKey);
const diagnostics = new DiagnosticsMode(eventBus, debugOverlay);

const glitchSystem = new GlitchSystem(state.glitchConfig, blocks, blockLabels, textTargets);

registerWallpaperAudio(audioEngine, arr => {
  glitchSystem.onAudioFrame(arr);
  audioDriver.onAudioFrame(arr);
});

const weatherService = new WeatherService(
  { provider: 'open-meteo', units: state.units },
  updateWeatherUI
);
const perfMonitor = new PerformanceMonitor('http://127.0.0.1:5000/performance', updatePerfUI, 5);
const nowPlayingService = new NowPlayingService(updateNowPlayingUI);

function init() {
  resize();
  window.addEventListener('resize', resize);

  setTextScale(state.textScale);
  setCoverPlaceholder();
  resetSystemText();

  weatherService.start();
  perfMonitor.start();
  applyLanguage();
  applyVisualProfile(state.visualProfile);
  setupClockTimer();
  startExternalIp();

  updateDiagnosticsMode();

  eventBus.on('menu:select', item => handleMenuAction(item));
  eventBus.on('message', payload => {
    const text = payload?.text || (payload?.key ? resolveMessageKey(payload.key) : '');
    if (text) showSystemText(text);
  });
  eventBus.on('message:key', payload => {
    const text = payload?.key ? resolveMessageKey(payload.key) : '';
    if (text) showSystemText(text);
  });
  eventBus.on('calendar:scroll', evt => handleCalendarScroll(evt));
  eventBus.on('audio:sensitivity', evt => handleAudioSensitivity(evt));
  eventBus.on('glitch:manual', () => glitchSystem.triggerBigEvent());
  eventBus.on('block:pulse', evt => handleBlockPulse(evt));
  eventBus.on('block:pin', evt => handleBlockPin(evt));
  eventBus.on('block:uncertain', evt => handleBlockUncertain(evt));
  eventBus.on('gesture:hidden', evt => handleHiddenGesture(evt));
  eventBus.on('gesture:circle', evt => handleCircleGesture(evt));
  eventBus.on('diagnostic:flash', evt => handleDiagnosticFlash(evt));
  eventBus.on('profile:temp', evt => handleTemporaryProfile(evt));
  eventBus.on('core:state', evt => handleCoreState(evt));
  eventBus.on('state:change', evt => handleStateChange(evt));
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      if (!state.interactivity.diagnosticsEnabled) return;
      diagnostics.toggle();
    }
  });
  window.addEventListener('beforeunload', () => logBuffer.flush());

  // Kick off render loop
  requestAnimationFrame(loop);
}

function getStrings() {
  return I18N[state.language] || I18N['en-US'];
}

function getLogStorageKey(locale) {
  return `hud_log_v1_${locale || 'en-US'}`;
}

function resolveMessageKey(key) {
  if (!key) return '';
  const strings = getStrings();
  return strings.messages?.[key] || key;
}

function updateDiagnosticsMode() {
  const showInput = state.interactivity.diagnosticsEnabled;
  const showGlitch = state.glitchConfig.debugGlitchOverlay;
  diagnostics.setMode({ showInput, showGlitch });
  diagnostics.setEnabled(showInput || showGlitch);
}

function setText(el, value) {
  if (!el) return;
  const next = value ?? '';
  if (el.textContent !== next) {
    el.textContent = next;
  }
  if (el.dataset && el.dataset.glitch === '1') {
    el.dataset.glitchRaw = next;
  }
}

function applyJitterText(el, actualText, jitterText, chance = 0) {
  if (!el) return;
  setText(el, actualText);
  if (chance <= 0 || jitterTimers.has(el)) return;
  if (Math.random() > chance) return;
  el.textContent = jitterText;
  const timer = setTimeout(() => {
    jitterTimers.delete(el);
    setText(el, actualText);
  }, 160);
  jitterTimers.set(el, timer);
}

function applyLanguage() {
  const strings = getStrings();
  document.documentElement.lang = state.language;
  setText(titleEls.nowPlaying, strings.titles.nowPlaying);
  setText(titleEls.systemText, strings.titles.systemText);
  setText(titleEls.weather, strings.titles.weather);
  setText(titleEls.clock, strings.titles.clock);
  setText(titleEls.metrics, strings.titles.metrics);
  setText(titleEls.network, strings.titles.network);
  setText(titleEls.disks, strings.titles.disks);

  setText(labelEls.cpu, strings.labels.cpu);
  setText(labelEls.gpu, strings.labels.gpu);
  setText(labelEls.ram, strings.labels.ram);
  setText(labelEls.vram, strings.labels.vram);
  setText(labelEls.down, strings.labels.down);
  setText(labelEls.up, strings.labels.up);
  setText(labelEls.ip, strings.labels.ip);
  setText(labelEls.diskC, strings.labels.diskC);
  setText(labelEls.diskD, strings.labels.diskD);

  const menuItems = [
    { id: 'grid', label: strings.interaction.menu.grid },
    { id: 'glitch', label: strings.interaction.menu.glitch },
    { id: 'diag', label: strings.interaction.menu.diag },
    { id: 'reset', label: strings.interaction.menu.reset },
  ];
  interactionFX.setConfig({
    tooltipText: strings.interaction.tooltip,
    pinLabel: strings.interaction.pin,
    menuItems,
    eventLabels: strings.interaction.events,
    symbolSet: state.glitchConfig.alienSymbolSet,
    textScale: state.textScale,
  });
  microAnimations.setMessages(strings.messages);
  overlayMessages.setResolver(resolveMessageKey);

  setText(weatherCityEl, strings.weather.city);
  if (!state.cache.weather) setText(weatherCondEl, strings.weather.noData);
  if (!state.cache.perf) {
    setText(hwStatusEl, strings.hw.waiting);
    setText(hwUpdateEl, `${strings.hw.last}: --`);
  }

  if (state.cache.track) updateNowPlayingUI(state.cache.track);
  else updateNowPlayingUI(nowPlayingService.getState());
  if (state.cache.weather) updateWeatherUI(state.cache.weather);
  if (state.cache.perf) updatePerfUI({ data: state.cache.perf, online: state.cache.perfOnline });
  updateExternalIpUI(state.cache.ip);
  updateClock(true);
  updateBlockRegistry();
}

function applyVisualProfile(profile, options = {}) {
  const key = String(profile || 'ENGINEERING').toUpperCase();
  const preset = VISUAL_PROFILES[key] || VISUAL_PROFILES.ENGINEERING;
  state.activeProfile = key;
  if (!options.temporary) {
    state.visualProfile = key;
    saveState(PROFILE_STORAGE_KEY, key);
  }
  state.profileGlitchScale = preset.glitchScale;
  state.profileResponseScale = preset.responseScale;
  state.profileContrast = preset.contrast;
  state.gridAlphaBase = preset.gridAlpha;
  state.gridAlpha = preset.gridAlpha;
  state.bgEQAlpha = state.bgEQAlphaBase * preset.bgEQAlpha;
  document.documentElement.style.setProperty('--hud-contrast', `${preset.contrast}`);
  document.documentElement.style.setProperty('--grid-alpha', `${preset.gridAlpha}`);
  document.documentElement.style.setProperty('--bg-eq-alpha', `${state.bgEQAlpha}`);
  interactionFX.setConfig({ uiResponsiveness: state.interactivity.uiResponsiveness * preset.responseScale });
}

function cycleProfile() {
  const order = ['ENGINEERING', 'DIAGNOSTIC', 'OBSERVATION', 'MINIMAL'];
  const idx = Math.max(0, order.indexOf(state.visualProfile));
  const next = order[(idx + 1) % order.length];
  applyVisualProfile(next);
}

function setupClockTimer() {
  if (clockTimer) clearInterval(clockTimer);
  const interval = state.showSeconds ? 500 : 1000;
  clockTimer = setInterval(updateClock, interval);
  updateClock(true);
}

function startExternalIp() {
  stopExternalIp();
  if (!state.externalIpEnabled) {
    updateExternalIpUI(null, true);
    return;
  }
  fetchExternalIp();
}

function stopExternalIp() {
  if (ipTimer) clearTimeout(ipTimer);
  ipTimer = null;
}

async function fetchExternalIp() {
  if (!state.externalIpEnabled) return;
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (!res.ok) throw new Error('ip fetch failed');
    const data = await res.json();
    state.cache.ip = { value: data.ip, fetchedAt: Date.now() };
    updateExternalIpUI(state.cache.ip);
    scheduleExternalIp(20 * 60 * 1000);
  } catch (err) {
    state.cache.ip = null;
    updateExternalIpUI(null);
    scheduleExternalIp(10 * 60 * 1000);
  }
}

function scheduleExternalIp(delayMs) {
  if (ipTimer) clearTimeout(ipTimer);
  ipTimer = setTimeout(fetchExternalIp, delayMs);
}

function updateExternalIpUI(ipData, disabled = false) {
  if (!netIpEl) return;
  const strings = getStrings();
  if (disabled || !state.externalIpEnabled) {
    setText(netIpEl, strings.network.ipDisabled);
    return;
  }
  if (ipData?.value) {
    coreStateMachine.reportDataStatus('network', true);
    setText(netIpEl, ipData.value);
    return;
  }
  coreStateMachine.reportDataStatus('network', false);
  setText(netIpEl, strings.network.ipUnavailable);
}

function handleMenuAction(item) {
  if (!item) return;
  if (item.id === 'grid') {
    state.gridEnabled = !state.gridEnabled;
    return;
  }
  if (item.id === 'glitch') {
    state.glitchConfig.glitchesEnabled = !state.glitchConfig.glitchesEnabled;
    glitchSystem.setConfig({ glitchesEnabled: state.glitchConfig.glitchesEnabled });
    return;
  }
  if (item.id === 'diag') {
    diagnostics.toggle();
    return;
  }
  if (item.id === 'reset') {
    updateHudLayout();
  }
}

function handleBlockPulse(evt) {
  const id = evt?.id || evt?.blockId;
  if (!id) return;
  interactionFX.triggerPulse(id, evt?.intensity ?? 1);
}

function handleBlockPin(evt) {
  const id = evt?.blockId;
  if (!id) return;
  if (evt.pinned) behaviorMemory.recordFocus(id);
  const strings = getStrings();
  eventBus.emit('message', {
    text: evt.pinned ? strings.messages.blockPinned : strings.messages.blockUnpinned,
    ttl: 0.8,
  });
}

function handleBlockUncertain(evt) {
  const id = evt?.id || evt?.blockId;
  if (!id) return;
  coreStateMachine.reportDataStatus(id, false);
}

function handleHiddenGesture(evt) {
  const id = evt?.blockId;
  if (!id) return;
  behaviorMemory.recordFocus(id);
  interactionFX.triggerPulse(id, 0.7);
}

function handleCircleGesture(evt) {
  if (!state.hiddenGesturesEnabled) return;
  cycleProfile();
}

function handleDiagnosticFlash() {
  interactionFX.triggerPulse('system', 1.2);
  glitchSystem.triggerBigEvent();
}

function handleTemporaryProfile(evt) {
  if (!evt?.profile) return;
  const duration = Math.max(2, evt.duration || 6);
  profileOverride = {
    profile: evt.profile,
    expiresAt: performance.now() + duration * 1000,
  };
  applyVisualProfile(evt.profile, { temporary: true });
}

function handleCoreState() {}

function handleCalendarScroll(evt) {
  if (!evt) return;
  const dir = evt.delta > 0 ? 1 : -1;
  calendarOffset = clamp(calendarOffset + dir, -12, 12);
  updateClock(true);
}

function handleAudioSensitivity(evt) {
  if (!evt) return;
  const delta = evt.delta;
  const current = audioEngine.options.sensitivity;
  const next = clamp(current + (delta > 0 ? -0.05 : 0.05), 0.2, 3);
  audioEngine.updateSettings({ sensitivity: next });
  const strings = getStrings();
  eventBus.emit('message', { text: `${strings.messages.sensitivity} ${next.toFixed(2)}`, ttl: 0.8 });
}

function handleStateChange(evt) {
  if (!evt) return;
  if (evt.to === 'IDLE') {
    state.idleGlitchScale = 0.7;
    state.idleIntervalScale = 1.4;
  } else if (evt.from === 'IDLE') {
    state.idleGlitchScale = 1;
    state.idleIntervalScale = 1;
    const strings = getStrings();
    eventBus.emit('message', { text: strings.messages.hudWake, ttl: 1.0 });
  }
}

function applySystemModifiers(coreState) {
  if (!coreState) return;
  const mods = coreState.modifiers || {};
  state.systemModifiers = mods;
  const contrast = clamp(state.profileContrast * (mods.contrast ?? 1), 0.6, 1.3);
  const degrade = clamp(coreState.degradation ?? 0, 0, 1);
  const gridAlpha = clamp(state.gridAlphaBase * (1 - degrade * 0.35), 0.05, 0.4);
  state.gridAlpha = gridAlpha;
  document.documentElement.style.setProperty('--hud-contrast', `${contrast}`);
  document.documentElement.style.setProperty('--degrade', `${degrade}`);
  document.documentElement.style.setProperty('--grid-alpha', `${gridAlpha}`);
  applyConfidence(coreState.confidence);
}

function applyConfidence(confidence = {}) {
  Object.entries(blockElements).forEach(([id, el]) => {
    if (!el) return;
    const entry = confidence[id];
    const stateValue = entry?.state || 'stable';
    el.classList.toggle('uncertain', stateValue === 'uncertain');
    el.classList.toggle('confirming', stateValue === 'confirming');
  });
}

function updateLayerOffsets(parallax = { x: 0, y: 0 }, mods = {}) {
  const grid = mods.gridOffset || { x: 0, y: 0 };
  const panels = mods.panelOffset || { x: 0, y: 0 };
  const text = mods.textOffset || { x: 0, y: 0 };
  state.layerOffsets = {
    grid: { x: parallax.x * 0.35 + grid.x, y: parallax.y * 0.35 + grid.y },
    panels: { x: parallax.x * 0.6 + panels.x, y: parallax.y * 0.6 + panels.y },
    text: { x: parallax.x * 0.9 + text.x, y: parallax.y * 0.9 + text.y },
  };
  document.documentElement.style.setProperty('--text-layer-x', `${state.layerOffsets.text.x.toFixed(2)}px`);
  document.documentElement.style.setProperty('--text-layer-y', `${state.layerOffsets.text.y.toFixed(2)}px`);
}

function updateGlitchRuntime(dt, entropy, mods = {}) {
  if (!state.glitchConfig.glitchesEnabled) return;
  glitchUpdateTimer += dt;
  if (glitchUpdateTimer < 0.5) return;
  glitchUpdateTimer = 0;
  const entropyMods = entropyController.getModifiers();
  const glitchScale = state.profileGlitchScale * state.idleGlitchScale;
  const intervalScale =
    entropyMods.glitchIntervalScale * state.idleIntervalScale * (1 - clamp(mods.glitchBoost || 0, 0, 0.6) * 0.4);
  const intensityScale = entropyMods.glitchIntensityScale * glitchScale * (1 + (mods.glitchBoost || 0));
  const min = state.glitchConfig.glitchIntervalMinSec * intervalScale;
  const max = state.glitchConfig.glitchIntervalMaxSec * intervalScale;
  const intensity = clamp(state.glitchConfig.glitchIntensity * intensityScale, 0.2, 2.2);
  glitchSystem.setConfig({
    glitchIntervalMinSec: min,
    glitchIntervalMaxSec: max,
    glitchIntensity: intensity,
  });
  interactionFX.setConfig({
    uiResponsiveness: state.interactivity.uiResponsiveness * state.profileResponseScale * (0.9 + entropy * 0.3),
  });
}

function applyTimeTone(timeState) {
  if (!state.timeOfDayAdaptive) {
    state.colors.background = state.baseColors.background;
    state.colors.primary = state.baseColors.primary;
    state.colors.secondary = state.baseColors.secondary;
    return;
  }
  let factor = 1;
  if (timeState.phase === 'night') factor = 0.82;
  else if (timeState.phase === 'evening') factor = 0.9;
  const accent = timeState.phase === 'night' ? 0.88 : timeState.phase === 'evening' ? 0.94 : 1;
  const bg = scaleColor(state.baseColors.background, factor);
  state.colors.background = bg;
  state.colors.primary = scaleColor(state.baseColors.primary, accent);
  state.colors.secondary = scaleColor(state.baseColors.secondary, accent);
  document.documentElement.style.setProperty('--primary', state.colors.primary);
  document.documentElement.style.setProperty('--secondary', state.colors.secondary);
  document.documentElement.style.setProperty('--bg', state.colors.background);
}

function scaleColor(color, factor) {
  if (!color) return color;
  let r = 0;
  let g = 0;
  let b = 0;
  if (color.startsWith('rgb')) {
    const nums = color
      .replace(/[^\d,]/g, '')
      .split(',')
      .map(n => parseInt(n.trim(), 10));
    [r, g, b] = nums;
  } else {
    const c = color.replace('#', '');
    const bigint = parseInt(c, 16);
    r = (bigint >> 16) & 255;
    g = (bigint >> 8) & 255;
    b = bigint & 255;
  }
  r = clamp(Math.round(r * factor), 0, 255);
  g = clamp(Math.round(g * factor), 0, 255);
  b = clamp(Math.round(b * factor), 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function showSystemText(text) {
  if (!text) return;
  logBuffer.push(text, 'semantic');
}

function updateSystemTextDisplay(dt, displayState = {}) {
  logDisplayState = displayState;
}

function resetSystemText(force = false) {
  if (force || !state.log.persist) logBuffer.clear();
  logDisplayState = { level: 0, jitter: 0, flicker: 0 };
}

function triggerSystemEvent(key, ttl = 6) {
  systemEventTracker.trigger(key, ttl);
}

function triggerUserEvent(key, ttl = 4) {
  userEventTracker.trigger(key, ttl);
}

function updateUserInputEvents(dt, inputState, hit) {
  const now = performance.now();
  if (inputState.idle) idleDuration += dt;
  else idleDuration = 0;

  if (wasIdle && !inputState.idle) triggerUserEvent('wake', 6);

  if (inputState.click) {
    triggerUserEvent('click', 4);
    if (wasIdle) triggerUserEvent('firstClickAfterIdle', 6);
    clickTimes.push(now);
  }

  clickTimes = clickTimes.filter(t => now - t < 2000);
  if (clickTimes.length >= 4) {
    triggerUserEvent('rapidClicks', 6);
    clickTimes = [];
  }

  if (idleDuration > 30 && state.semanticText.idleMode && now - lastLongIdleAt > 30000) {
    triggerUserEvent('longIdle', 8);
    lastLongIdleAt = now;
  }

  if (hit.hoveredBlockId === 'systemText') {
    hoverTextTime += dt;
    if (hoverTextTime > 1.4 && now - lastHoverTextAt > 15000) {
      triggerUserEvent('hoverText', 4);
      lastHoverTextAt = now;
      hoverTextTime = 0;
    }
  } else {
    hoverTextTime = 0;
  }

  wasIdle = inputState.idle;
}

function parseDiskUsage(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const match = raw.match(/([\d.]+)\s*[A-Za-z]+\s*\/\s*([\d.]+)/);
  if (!match) return null;
  return {
    used: Number(match[1]),
    total: Number(match[2]),
  };
}

function getElementRect(el) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (!rect || !isFinite(rect.width) || rect.width === 0) return null;
  return {
    x: rect.left,
    y: rect.top,
    w: rect.width,
    h: rect.height,
  };
}

function createEventTracker() {
  const events = new Map();
  return {
    trigger(name, ttl = 4) {
      const until = performance.now() + ttl * 1000;
      events.set(name, { until });
    },
    snapshot() {
      const now = performance.now();
      const active = {};
      events.forEach((value, key) => {
        if (value.until > now) active[key] = true;
        else events.delete(key);
      });
      return active;
    },
  };
}

function resize() {
  const bg = setupHiDPICanvas(bgCanvas);
  const fg = setupHiDPICanvas(fgCanvas);
  const hud = setupHiDPICanvas(hudCanvas);
  bgCtx = bg.ctx;
  fgCtx = fg.ctx;
  hudCtx = hud.ctx;
  dimensions = { width: bg.width, height: bg.height };
  updateHudLayout();
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  audioEngine.tick(now);
  state.audio = audioEngine.getState();
  audioDriver.update(dt);
  const audioAgg = audioDriver.getState();

  const timeState = timeContext.update(now);
  if (timeState.dateChanged) {
    eventBus.emit('block:pulse', { id: 'system', intensity: 1.1 });
  }
  applyTimeTone(timeState);

  if (profileOverride && now > profileOverride.expiresAt) {
    profileOverride = null;
    applyVisualProfile(state.visualProfile);
  }

  inputManager.update(dt);
  const inputState = inputManager.getState();
  inputState.click = inputManager.consumeClick();
  inputState.doubleClick = inputManager.consumeDoubleClick();
  inputState.wheel = inputManager.consumeWheel();

  const hit = hitTest(inputState.pos.x, inputState.pos.y, blocks);
  updateUserInputEvents(dt, inputState, hit);
  behaviorMemory.update(dt);
  if (hit.isInside) behaviorMemory.recordHover(hit.hoveredBlockId, dt);
  if (inputState.click && hit.isInside) behaviorMemory.recordClick(hit.hoveredBlockId);
  behaviorMemory.applyToBlocks(blocks);
  const behaviorSummary = behaviorMemory.getSummary();

  const entropy = entropyController.update(dt, {
    audio: audioAgg,
    time: timeState,
    behavior: behaviorSummary,
    input: inputState,
    anomaly: coreStateMachine.anomaly?.active,
  });

  const coreState = coreStateMachine.update(dt, {
    input: inputState,
    audio: audioAgg,
    metrics: state.cache.perf?.psutil,
    perfOnline: state.cache.perfOnline,
    entropy,
    time: timeState,
  });

  narrativeEngine.update(dt, {
    entropy,
    time: timeState,
    audio: audioAgg,
    metrics: state.cache.perf?.psutil,
    profile: state.activeProfile,
  });

  applySystemModifiers(coreState);
  interactionFX.update(dt, inputState, hit, audioAgg);
  stateMachine.update(dt, audioAgg, inputState);
  updateLayerOffsets(interactionFX.getParallax(), coreState.modifiers);
  glitchSystem.update(dt, now);
  const glitchDebug = glitchSystem.getDebugInfo();
  const bigEventActive = (glitchDebug.active || []).some(id => id >= 39);
  if (bigEventActive) triggerSystemEvent('glitchEvent', 4);
  if (lastBigEventActive && !bigEventActive) triggerSystemEvent('recovery', 6);
  lastBigEventActive = bigEventActive;
  const systemEvents = systemEventTracker.snapshot();
  const userEvents = {
    ...userEventTracker.snapshot(),
    idle: inputState.idle,
    idleDuration,
    hoverText: hit.hoveredBlockId === 'systemText',
  };
  const semanticText = semanticEngine.update(dt, {
    systemState: coreState.state,
    entropyLevel: entropy,
    audioState: audioAgg,
    glitchState: { activeGlitches: glitchDebug.active || [], recentBigEvent: bigEventActive },
    behaviorMemory: behaviorSummary,
    systemEvents,
    userInputEvents: userEvents,
  });
  if (semanticText) showSystemText(semanticText);
  if (state.semanticText.enabled) {
    updateSystemTextDisplay(dt, semanticEngine.getDisplayState());
  } else {
    updateSystemTextDisplay(dt, { level: 0, jitter: 0, flicker: 0 });
  }
  microAnimations.update(dt);
  overlayMessages.update(dt);

  updateGlitchRuntime(dt, entropy, coreState.modifiers);
  state.parallax = interactionFX.getParallax();

  drawBackground(bgCtx, { ...state, dimensions });
  drawForeground(hudCtx, { ...state, dimensions });
  if (calendarData && blocks.calendar?.rect) {
    renderCalendarCanvas(hudCtx, blocks.calendar.rect, calendarData, {
      colors: state.colors,
      lineWidth: state.lineThickness,
      textScale: state.textScale,
    });
  }
  if (state.log.enabled && blocks.systemText?.rect) {
    logRenderer.render(hudCtx, blocks.systemText.rect, logBuffer.getEntries(), {
      textScale: state.textScale,
      fontScale: state.log.fontScale,
      showTimestamp: state.log.showTimestamp,
      locale: state.language,
      displayState: logDisplayState,
      color: 'rgba(232, 255, 247, 0.88)',
      secondary: state.colors.secondary,
    });
  }

  fgCtx.clearRect(0, 0, dimensions.width, dimensions.height);
  fgCtx.drawImage(hudCanvas, 0, 0);

  interactionFX.render(fgCtx, hudCanvas);
  microAnimations.render(fgCtx, blocks);
  glitchSystem.render(fgCtx, hudCanvas, fgCanvas);
  narrativeEngine.render(fgCtx, dimensions.width, dimensions.height);
  overlayMessages.render(fgCtx, dimensions.width, dimensions.height);
  diagnostics.update({
    hoveredBlock: hit.hoveredBlockId,
    mouseSpeed: Math.hypot(inputState.velocity.x, inputState.velocity.y),
    audio: audioAgg,
    activeGlitches: glitchDebug.active,
    nextGlitch: glitchDebug.nextIn,
    fps: Math.round(1 / Math.max(0.001, dt)),
  });
  diagnostics.render(fgCtx, blocks, hit.hoveredBlockId);

  requestAnimationFrame(loop);
}

function updateNowPlayingUI(track) {
  const nextTrack = track || state.cache.track || nowPlayingService.getState();
  state.cache.track = nextTrack;
  const strings = getStrings();
  const hasData = !!nextTrack?.hasData;
  const rawTitle = nextTrack?.title;
  const title =
    hasData && rawTitle && rawTitle !== 'No track data' ? rawTitle : strings.nowPlaying.noData;
  const artist = hasData ? nextTrack.artist || strings.nowPlaying.noArtist : strings.nowPlaying.noArtist;
  const playback = nextTrack?.playbackState || 'stopped';
  const status = hasData
    ? strings.nowPlaying.status[playback] || strings.nowPlaying.status.stopped
    : strings.nowPlaying.status.idle;

  setText(trackTitleEl, title);
  setText(trackArtistEl, artist);
  setText(trackStatusEl, status);

  const trackKey = `${title}::${artist}`;
  const trackChanged = trackKey !== lastTrackKey;
  if (trackChanged) {
    lastTrackKey = trackKey;
    if (hasData) eventBus.emit('message', { text: strings.messages.trackAcquired, ttl: 1.2 });
    if (hasData) eventBus.emit('block:pulse', { id: 'weather', intensity: 0.7 });
    if (hasData) triggerSystemEvent('trackChange', 8);
    if (coverEl) {
      coverEl.classList.remove('pulse');
      void coverEl.offsetWidth;
      coverEl.classList.add('pulse');
    }
  }

  const coverSrc = normalizeCover(nextTrack?.cover);
  if (coverSrc) {
    setCoverImage(coverSrc);
  } else if (trackChanged || !lastCoverSrc) {
    setCoverPlaceholder();
  }
}

function setCoverPlaceholder() {
  if (!coverEl) return;
  coverEl.innerHTML = '';
  coverEl.classList.remove('has-cover');
  coverEl.classList.add('placeholder');
  lastCoverSrc = null;
}

function setCoverImage(src) {
  if (!coverEl || !src) return;
  if (lastCoverSrc === src && coverEl.querySelector('img')) return;
  coverEl.innerHTML = '';
  coverEl.classList.remove('placeholder');
  coverEl.classList.remove('has-cover');
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  img.onload = () => {
    lastCoverSrc = src;
    coverEl.classList.add('has-cover');
  };
  img.onerror = () => {
    lastCoverSrc = null;
    setCoverPlaceholder();
  };
  coverEl.appendChild(img);
}

function updateWeatherUI(data) {
  const strings = getStrings();
  setText(weatherCityEl, strings.weather.city);
  if (!data) {
    coreStateMachine.reportDataStatus('weather', false);
    setText(weatherCondEl, strings.weather.noData);
    setText(weatherTempEl, '--°');
    weatherForecastEl.innerHTML = '';
    if (weatherIconEl) weatherIconEl.innerHTML = '';
    lastWeatherSignature = null;
    return;
  }
  state.cache.weather = data;
  coreStateMachine.reportDataStatus('weather', true);
  const temp = data.current.temp;
  const signature = `${data.current.icon || 'unknown'}-${Math.round(temp || 0)}`;
  if (lastWeatherSignature && signature !== lastWeatherSignature) {
    triggerSystemEvent('weatherChange', 10);
  }
  lastWeatherSignature = signature;
  setText(weatherTempEl, formatTemperature(temp, state.language, 0));
  const condition = strings.weather.conditions[data.current.icon] || strings.weather.conditions.unknown;
  setText(weatherCondEl, condition);
  setWeatherIcon(data.current.icon);
  weatherForecastEl.innerHTML = '';
  const weekdayFormatter = new Intl.DateTimeFormat(state.language, { weekday: 'short' });
  data.forecast.slice(0, 3).forEach((day, idx) => {
    if (!day) return;
    const card = document.createElement('div');
    card.className = 'forecast-card';
    const title = document.createElement('div');
    title.className = 'forecast-title';
    title.textContent = idx === 0 ? strings.weather.today : weekdayFormatter.format(day.day);
    const high = document.createElement('div');
    high.className = 'forecast-high';
    high.textContent = Number.isFinite(day.tempMax) ? formatTemperature(day.tempMax, state.language, 0) : '--';
    const low = document.createElement('div');
    low.className = 'forecast-low';
    low.textContent = Number.isFinite(day.tempMin) ? formatTemperature(day.tempMin, state.language, 0) : '--';
    card.append(title, high, low);
    weatherForecastEl.appendChild(card);
  });
}

const WEATHER_ICONS = {
  clear: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="10" />
      <line x1="32" y1="4" x2="32" y2="14" />
      <line x1="32" y1="50" x2="32" y2="60" />
      <line x1="4" y1="32" x2="14" y2="32" />
      <line x1="50" y1="32" x2="60" y2="32" />
      <line x1="12" y1="12" x2="19" y2="19" />
      <line x1="45" y1="45" x2="52" y2="52" />
      <line x1="12" y1="52" x2="19" y2="45" />
      <line x1="45" y1="19" x2="52" y2="12" />
    </svg>
  `,
  partly: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="20" cy="20" r="7" />
      <line x1="20" y1="6" x2="20" y2="12" />
      <line x1="6" y1="20" x2="12" y2="20" />
      <line x1="10" y1="10" x2="14" y2="14" />
      <path d="M18 46h26a9 9 0 0 0 0-18 13 13 0 0 0-25-3 8 8 0 0 0-1 21z" />
    </svg>
  `,
  cloudy: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 46h28a10 10 0 0 0 0-20 14 14 0 0 0-27-4 9 9 0 0 0-1 24z" />
    </svg>
  `,
  rain: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 38h28a10 10 0 0 0 0-20 14 14 0 0 0-27-4 9 9 0 0 0-1 24z" />
      <line x1="22" y1="44" x2="22" y2="58" />
      <line x1="32" y1="44" x2="32" y2="58" />
      <line x1="42" y1="44" x2="42" y2="58" />
    </svg>
  `,
  drizzle: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 38h28a10 10 0 0 0 0-20 14 14 0 0 0-27-4 9 9 0 0 0-1 24z" />
      <line x1="26" y1="44" x2="26" y2="54" />
      <line x1="38" y1="44" x2="38" y2="54" />
    </svg>
  `,
  snow: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 38h28a10 10 0 0 0 0-20 14 14 0 0 0-27-4 9 9 0 0 0-1 24z" />
      <line x1="24" y1="48" x2="24" y2="58" />
      <line x1="20" y1="53" x2="28" y2="53" />
      <line x1="32" y1="48" x2="32" y2="58" />
      <line x1="28" y1="53" x2="36" y2="53" />
      <line x1="40" y1="48" x2="40" y2="58" />
      <line x1="36" y1="53" x2="44" y2="53" />
    </svg>
  `,
  storm: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 38h28a10 10 0 0 0 0-20 14 14 0 0 0-27-4 9 9 0 0 0-1 24z" />
      <polyline points="30,42 24,56 32,56 26,64" />
      <line x1="40" y1="44" x2="40" y2="58" />
    </svg>
  `,
  fog: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <line x1="10" y1="24" x2="54" y2="24" />
      <line x1="6" y1="34" x2="58" y2="34" />
      <line x1="12" y1="44" x2="52" y2="44" />
    </svg>
  `,
  unknown: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="12" />
    </svg>
  `,
};

function setWeatherIcon(iconKey) {
  if (!weatherIconEl) return;
  const key = iconKey && WEATHER_ICONS[iconKey] ? iconKey : 'unknown';
  weatherIconEl.innerHTML = WEATHER_ICONS[key];
}

function normalizeCover(raw) {
  if (!raw) return null;
  let value = raw;
  if (typeof raw === 'object') {
    const mime = raw.mimeType || raw.mimetype || raw.type;
    const data = raw.data || raw.base64 || raw.buffer;
    if (data && mime) {
      return `data:${mime};base64,${data}`;
    }
    value = raw.url || raw.src || raw.path || data || '';
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^data:image\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^file:\/\//i.test(trimmed)) return trimmed;
  if (/^(steam|local):/i.test(trimmed)) return trimmed;
  if (/^blob:/i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return `file:///${trimmed.replace(/\\/g, '/')}`;
  }
  if (/^\/9j\//.test(trimmed)) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  if (/^iVBOR/.test(trimmed)) {
    return `data:image/png;base64,${trimmed}`;
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 64) {
    return `data:image/png;base64,${trimmed}`;
  }
  return trimmed;
}

function updatePerfUI({ data, online }) {
  const strings = getStrings();
  state.cache.perf = data;
  state.cache.perfOnline = online;
  if (!data) {
    coreStateMachine.reportDataStatus('system', false);
    coreStateMachine.reportDataStatus('network', false);
    setText(hwStatusEl, online ? strings.hw.waiting : strings.hw.offline);
    setText(hwUpdateEl, `${strings.hw.last}: --`);
    updateCpuCores([]);
    return;
  }
  const p = data.psutil || {};
  coreStateMachine.reportDataStatus('system', true);
  coreStateMachine.reportDataStatus('network', true);

  setGauge(metricsEls.cpu, p.cpu, formatTemperature(p.cpu_temp, state.language, 0), state.language);
  setGauge(metricsEls.gpu, p.gpu_usage, formatTemperature(p.gpu_temp, state.language, 0), state.language);
  setGauge(metricsEls.ram, p.memory, formatMemoryPair(p.memory_gb, state.language), state.language);
  setGauge(metricsEls.vram, p.vram_usage, formatMemoryPair(p.vram_gb, state.language), state.language);

  updateCpuCores(p.cpu_percore);

  setText(netDownEl, formatSpeed(p.download_speed, state.language));
  setText(netUpEl, formatSpeed(p.upload_speed, state.language));
  setText(diskCEl, p.c_disk || '--');
  setText(diskDEl, p.d_disk || '--');

  if (lastMetrics) {
    const cpuDelta = Math.abs((p.cpu ?? 0) - (lastMetrics.cpu ?? 0));
    const gpuDelta = Math.abs((p.gpu_usage ?? 0) - (lastMetrics.gpu_usage ?? 0));
    const netDelta = Math.abs((p.download_speed ?? 0) - (lastMetrics.download_speed ?? 0));
    if (cpuDelta > 18 || gpuDelta > 18) {
      eventBus.emit('block:pulse', { id: 'network', intensity: 0.9 });
    }
    if (netDelta > 60000) {
      eventBus.emit('block:pulse', { id: 'system', intensity: 0.8 });
    }
    if (cpuDelta > 22) triggerSystemEvent('cpuSpike', 8);
    if (gpuDelta > 22) triggerSystemEvent('gpuSpike', 8);
  }
  lastMetrics = { ...p };

  if (lastNetDown !== null) {
    if (lastNetDown > 50000 && (p.download_speed ?? 0) < 5000) {
      triggerSystemEvent('netDrop', 8);
    }
    if (lastNetDown < 5000 && (p.download_speed ?? 0) > 25000) {
      triggerSystemEvent('netRestore', 8);
    }
  }
  lastNetDown = p.download_speed ?? lastNetDown;

  const diskCUsage = parseDiskUsage(p.c_disk);
  if (diskCUsage && lastDiskUsage.c) {
    const diff = Math.abs(diskCUsage.used - lastDiskUsage.c.used);
    if (diskCUsage.total > 0 && diff / diskCUsage.total > 0.02) {
      triggerSystemEvent('diskAnomaly', 12);
    }
  }
  if (diskCUsage) lastDiskUsage.c = diskCUsage;
  const diskDUsage = parseDiskUsage(p.d_disk);
  if (diskDUsage && lastDiskUsage.d) {
    const diff = Math.abs(diskDUsage.used - lastDiskUsage.d.used);
    if (diskDUsage.total > 0 && diff / diskDUsage.total > 0.02) {
      triggerSystemEvent('diskAnomaly', 12);
    }
  }
  if (diskDUsage) lastDiskUsage.d = diskDUsage;

  microAnimations.updateMetrics({
    cpu: p.cpu,
    gpu: p.gpu_usage,
    net: Number.isFinite(p.download_speed) ? p.download_speed / 1024 : 0,
  });

  if (lastPerfOnline !== online) {
    lastPerfOnline = online;
    triggerSystemEvent(online ? 'endpointOnline' : 'endpointOffline', 10);
    eventBus.emit('message', {
      text: online ? strings.messages.hwOnline : strings.messages.hwOffline,
      ttl: 1.2,
    });
  }

  const status = online ? strings.hw.online : strings.hw.cached;
  setText(hwStatusEl, status);
  const stamp = p.timestamp || data.timestamp;
  setText(hwUpdateEl, `${strings.hw.last}: ${formatHwTimestamp(stamp)}`);
}

function setGauge(target, percent, subText, locale) {
  if (!target) return;
  const hasValue = Number.isFinite(percent);
  const safe = hasValue ? clamp(percent, 0, 100) : 0;
  const display = hasValue ? formatPercent(safe, locale) : '--%';
  const jitterChance = clamp((state.systemModifiers?.textJitter || 0) * 0.25, 0, 0.25);
  if (hasValue && jitterChance > 0) {
    const jittered = formatPercent(clamp(safe + (Math.random() < 0.5 ? -1 : 1), 0, 100), locale);
    applyJitterText(target.value, display, jittered, jitterChance);
  } else {
    setText(target.value, display);
  }
  setText(target.temp, subText || '--');
  if (target.bar) target.bar.style.width = `${safe}%`;
}

function updateCpuCores(cores) {
  if (!cpuCoresEl) return;
  if (!Array.isArray(cores) || cores.length === 0) {
    cpuCoresEl.innerHTML = '';
    return;
  }
  if (cpuCoresEl.children.length !== cores.length) {
    cpuCoresEl.innerHTML = '';
    cores.forEach(() => {
      const bar = document.createElement('div');
      bar.className = 'core-bar';
      cpuCoresEl.appendChild(bar);
    });
  }
  cores.forEach((value, idx) => {
    const bar = cpuCoresEl.children[idx];
    if (!bar) return;
    const safe = clamp(value || 0, 0, 100);
    bar.style.height = `${safe}%`;
  });
}

function formatHwTimestamp(timestamp) {
  if (timestamp === null || timestamp === undefined || !isFinite(timestamp)) return '--';
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const date = new Date(ms);
  return date.toLocaleTimeString(state.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function updateClock(force = false) {
  const now = new Date();
  const { time, date } = formatDateTime(now, state.language, state.showSeconds);
  setText(clockTimeEl, time);
  setText(clockDateEl, date);
  const calendarKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${calendarOffset}`;
  if (force || calendarKey !== updateClock.lastCalendarKey || updateClock.lastLocale !== state.language) {
    calendarData = buildCalendarData(now, state.language, calendarOffset);
    updateClock.lastCalendarKey = calendarKey;
    updateClock.lastLocale = state.language;
  }
}

function updateDebug() {
  if (!state.debugOverlay) {
    debugOverlay.hidden = true;
    return;
  }
  debugOverlay.hidden = false;
  const now = performance.now();
  const delta = updateDebug.last ? now - updateDebug.last : 16.7;
  const fps = Math.round(1000 / delta);
  updateDebug.last = now;
  debugOverlay.textContent = [
    `FPS: ${fps}`,
    `Bars: ${state.audio.bars.length}`,
    `Waveform: ${state.audio.waveform.length}`,
    `Weather provider: ${weatherService.options.provider}`,
    `Audio API: ${typeof window.wallpaperRegisterAudioListener === 'function'}`,
    `Media API: ${
      !!(
        window.wallpaperRegisterMediaInformationListener ||
        window.wallpaperRegisterMediaPropertiesListener ||
        window.wallpaperRegisterSongInfoListener
      )
    }`,
  ].join('\n');
}

// Wallpaper Engine property integration
window.wallpaperPropertyListener = {
  applyUserProperties: props => {
    const get = key => props[key] ?? props[key.toLowerCase()] ?? props[key.toUpperCase()];
    const boolVal = prop => {
      const v = prop?.value;
      if (typeof v === 'string') return v.toLowerCase() === 'true';
      return !!v;
    };
    const numVal = prop => (prop ? Number(prop.value) : undefined);

    const primary = get('themecolorprimary');
    if (primary) updateColor('primary', primary.value);
    const secondary = get('themecolorsecondary');
    if (secondary) updateColor('secondary', secondary.value);
    const background = get('backgroundcolor');
    if (background) updateColor('background', background.value);

    const lineThickness = get('linethickness');
    if (lineThickness) {
      state.lineThickness = numVal(lineThickness);
      document.documentElement.style.setProperty('--line', `${state.lineThickness}px`);
    }
    const gridEnabled = get('gridenabled');
    if (gridEnabled) state.gridEnabled = boolVal(gridEnabled);
    const gridDensity = get('griddensity');
    if (gridDensity) {
      state.gridDensity = numVal(gridDensity);
      updateHudLayout();
    }

    const audioSensitivity = get('audiosensitivity');
    if (audioSensitivity) audioEngine.updateSettings({ sensitivity: numVal(audioSensitivity) });
    const audioSmoothing = get('audiosmoothing');
    if (audioSmoothing) audioEngine.updateSettings({ smoothing: numVal(audioSmoothing) });
    const barsCount = get('barscount');
    if (barsCount) audioEngine.updateSettings({ barsCount: numVal(barsCount) });
    const waveformEnabled = get('waveformenabled');
    if (waveformEnabled) audioEngine.updateSettings({ waveformEnabled: boolVal(waveformEnabled) });
    const waveformHeight = get('waveformheight');
    if (waveformHeight) audioEngine.updateSettings({ waveformHeight: numVal(waveformHeight) });
    const bgEqAlpha = get('backgroundequalizeralpha');
    if (bgEqAlpha) {
      state.bgEQAlphaBase = numVal(bgEqAlpha);
      const preset = VISUAL_PROFILES[state.activeProfile] || VISUAL_PROFILES.ENGINEERING;
      state.bgEQAlpha = state.bgEQAlphaBase * preset.bgEQAlpha;
      document.documentElement.style.setProperty('--bg-eq-alpha', `${state.bgEQAlpha}`);
    }

    const nowPlayingEnabled = get('nowplayingenabled');
    if (nowPlayingEnabled) {
      panelNowPlayingEl.style.display = boolVal(nowPlayingEnabled) ? 'block' : 'none';
    }
    const coverSize = get('coversize');
    if (coverSize) {
      const s = numVal(coverSize);
      document.documentElement.style.setProperty('--cover-size', `${s}px`);
      coverEl.style.width = `${s}px`;
      coverEl.style.height = `${s}px`;
    }
    const coverPosition = get('coverposition');
    if (coverPosition) setCoverPosition(coverPosition.value);
    const coverStyle = get('coverstyle');
    if (coverStyle) setCoverStyle(coverStyle.value);
    const layoutPreset = get('layoutpreset');
    if (layoutPreset) setLayout(layoutPreset.value);

    const hwInterval = get('hwpollintervalsec');
    if (hwInterval) perfMonitor.setInterval(numVal(hwInterval));

    const weatherEnabled = get('weatherenabled');
    if (weatherEnabled) {
      const enabled = boolVal(weatherEnabled);
      state.weatherEnabled = enabled;
      panelWeatherEl.style.display = enabled ? 'block' : 'none';
      enabled ? weatherService.start() : weatherService.stop();
    }
    const weatherProvider = get('weatherprovider');
    const weatherApiKey = get('weatherapikey');
    const units = get('units');
    if (weatherProvider || weatherApiKey || units) {
      const opts = {
        provider: weatherProvider?.value || weatherService.options.provider,
        apiKey: weatherApiKey?.value || weatherService.options.apiKey,
        units: units?.value || weatherService.options.units,
      };
      if (units?.value) state.units = units.value;
      if (state.weatherEnabled) weatherService.updateOptions(opts);
      else Object.assign(weatherService.options, opts);
    }

    const language = get('language');
    if (language) setLanguage(language.value);
    const textScale = get('textscale');
    if (textScale) setTextScale(numVal(textScale));
    const semanticTextEnabled = get('semantictextenabled');
    if (semanticTextEnabled) {
      state.semanticText.enabled = boolVal(semanticTextEnabled);
      semanticEngine.setConfig({ enabled: state.semanticText.enabled });
      if (!state.semanticText.enabled) resetSystemText();
    }
    const semanticTextFrequency = get('semantictextfrequency');
    if (semanticTextFrequency) {
      state.semanticText.frequency = numVal(semanticTextFrequency);
      semanticEngine.setConfig({ frequency: state.semanticText.frequency });
    }
    const semanticTextVerbosity = get('semantictextverbosity');
    if (semanticTextVerbosity) {
      state.semanticText.verbosity = clamp(numVal(semanticTextVerbosity), 0.4, 1.4);
      semanticEngine.setConfig({ verbosity: state.semanticText.verbosity });
    }
    const semanticTextSarcasm = get('semantictextsarcasm');
    if (semanticTextSarcasm) {
      state.semanticText.sarcasm = clamp(numVal(semanticTextSarcasm), 0, 1);
      semanticEngine.setConfig({ sarcasm: state.semanticText.sarcasm });
    }
    const semanticTextDegradation = get('semantictextdegradationstrength');
    if (semanticTextDegradation) {
      state.semanticText.degradationStrength = clamp(numVal(semanticTextDegradation), 0, 1);
      semanticEngine.setConfig({ degradationStrength: state.semanticText.degradationStrength });
    }
    const semanticTextLanguageProfile = get('semantictextlanguageprofile');
    if (semanticTextLanguageProfile) {
      state.semanticText.languageProfile = semanticTextLanguageProfile.value;
      semanticEngine.setConfig({ languageProfile: state.semanticText.languageProfile });
    }
    const semanticTextIdleMode = get('semantictextidlemode');
    if (semanticTextIdleMode) {
      state.semanticText.idleMode = boolVal(semanticTextIdleMode);
      semanticEngine.setConfig({ idleMode: state.semanticText.idleMode });
    }

    const logEnabled = get('logenabled');
    if (logEnabled) {
      state.log.enabled = boolVal(logEnabled);
    }
    const logMaxEntries = get('logmaxentries');
    if (logMaxEntries) {
      state.log.maxEntries = clamp(numVal(logMaxEntries), 50, 500);
      logBuffer.setMaxEntries(state.log.maxEntries);
    }
    const logShowTimestamp = get('logshowtimestamp');
    if (logShowTimestamp) {
      state.log.showTimestamp = boolVal(logShowTimestamp);
      logRenderer.setConfig({ showTimestamp: state.log.showTimestamp });
    }
    const logFontScale = get('logfontscale');
    if (logFontScale) {
      state.log.fontScale = clamp(numVal(logFontScale), 0.8, 1.6);
      logRenderer.setConfig({ fontScale: state.log.fontScale });
    }
    const logPersist = get('logpersistbetweensessions');
    if (logPersist) {
      state.log.persist = boolVal(logPersist);
      logBuffer.setPersist(state.log.persist);
      if (state.log.persist) logBuffer.setStorageKey(getLogStorageKey(state.language));
    }
    const visualProfile = get('visualprofile');
    if (visualProfile) applyVisualProfile(visualProfile.value);
    const entropyLevel = get('entropylevel');
    if (entropyLevel) {
      state.entropyLevel = clamp(numVal(entropyLevel), 0, 1);
      entropyController.setBase(state.entropyLevel);
    }
    const behaviorMemoryEnabled = get('behaviormemoryenabled');
    if (behaviorMemoryEnabled) {
      state.behaviorMemoryEnabled = boolVal(behaviorMemoryEnabled);
      behaviorMemory.setEnabled(state.behaviorMemoryEnabled);
    }
    const narrativeEventsEnabled = get('narrativeeventsenabled');
    if (narrativeEventsEnabled) {
      state.narrativeEventsEnabled = boolVal(narrativeEventsEnabled);
      narrativeEngine.setEnabled(state.narrativeEventsEnabled);
    }
    const degradationEnabled = get('degradationenabled');
    if (degradationEnabled) {
      state.degradationEnabled = boolVal(degradationEnabled);
      coreStateMachine.setOptions({ degradationEnabled: state.degradationEnabled });
    }
    const timeOfDayAdaptive = get('timeofdayadaptive');
    if (timeOfDayAdaptive) {
      state.timeOfDayAdaptive = boolVal(timeOfDayAdaptive);
      entropyController.setTimeAdaptive(state.timeOfDayAdaptive);
      coreStateMachine.setOptions({ timeOfDayAdaptive: state.timeOfDayAdaptive });
    }

    const glitchesEnabled = get('glitchesenabled');
    if (glitchesEnabled) {
      state.glitchConfig.glitchesEnabled = boolVal(glitchesEnabled);
      glitchSystem.setConfig({ glitchesEnabled: state.glitchConfig.glitchesEnabled });
    }
    const glitchIntervalMin = get('glitchintervalminsec');
    if (glitchIntervalMin) {
      state.glitchConfig.glitchIntervalMinSec = numVal(glitchIntervalMin);
      glitchSystem.setConfig({ glitchIntervalMinSec: state.glitchConfig.glitchIntervalMinSec });
    }
    const glitchIntervalMax = get('glitchintervalmaxsec');
    if (glitchIntervalMax) {
      state.glitchConfig.glitchIntervalMaxSec = numVal(glitchIntervalMax);
      glitchSystem.setConfig({ glitchIntervalMaxSec: state.glitchConfig.glitchIntervalMaxSec });
    }
    const glitchIntensity = get('glitchintensity');
    if (glitchIntensity) {
      state.glitchConfig.glitchIntensity = clamp(numVal(glitchIntensity), 0.2, 2);
      glitchSystem.setConfig({ glitchIntensity: state.glitchConfig.glitchIntensity });
    }
    const musicReactive = get('musicreactiveglitches');
    if (musicReactive) {
      state.glitchConfig.musicReactiveGlitches = boolVal(musicReactive);
      glitchSystem.setConfig({ musicReactiveGlitches: state.glitchConfig.musicReactiveGlitches });
    }
    const maxSimultaneous = get('maxsimultaneousglitches');
    if (maxSimultaneous) {
      state.glitchConfig.maxSimultaneousGlitches = numVal(maxSimultaneous);
      glitchSystem.setConfig({ maxSimultaneousGlitches: state.glitchConfig.maxSimultaneousGlitches });
    }
    const allowScreenWide = get('allowscreenwideeffects');
    if (allowScreenWide) {
      state.glitchConfig.allowScreenWideEffects = boolVal(allowScreenWide);
      glitchSystem.setConfig({ allowScreenWideEffects: state.glitchConfig.allowScreenWideEffects });
    }
    const bigEventChance = get('bigeventchance');
    if (bigEventChance) {
      state.glitchConfig.bigEventChance = clamp(numVal(bigEventChance), 0, 1);
      glitchSystem.setConfig({ bigEventChance: state.glitchConfig.bigEventChance });
    }
    const chromatic = get('chromaticaberrationenabled');
    if (chromatic) {
      state.glitchConfig.chromaticAberrationEnabled = boolVal(chromatic);
      glitchSystem.setConfig({ chromaticAberrationEnabled: state.glitchConfig.chromaticAberrationEnabled });
    }
    const alienStrength = get('alienalphabetstrength');
    if (alienStrength) {
      state.glitchConfig.alienAlphabetStrength = clamp(numVal(alienStrength), 0, 1);
      glitchSystem.setConfig({ alienAlphabetStrength: state.glitchConfig.alienAlphabetStrength });
    }
    const alienSet = get('aliensymbolset');
    if (alienSet && alienSet.value) {
      state.glitchConfig.alienSymbolSet = alienSet.value;
      glitchSystem.setConfig({ alienSymbolSet: state.glitchConfig.alienSymbolSet });
      interactionFX.setConfig({ symbolSet: state.glitchConfig.alienSymbolSet });
    }
    const debugGlitchOverlay = get('debugglitchoverlay');
    if (debugGlitchOverlay) {
      state.glitchConfig.debugGlitchOverlay = boolVal(debugGlitchOverlay);
      glitchSystem.setConfig({ debugGlitchOverlay: state.glitchConfig.debugGlitchOverlay });
      updateDiagnosticsMode();
    }

    const interactivityEnabled = get('interactivityenabled');
    if (interactivityEnabled) {
      state.interactivity.interactivityEnabled = boolVal(interactivityEnabled);
      interactionFX.setConfig({ interactivityEnabled: state.interactivity.interactivityEnabled });
    }
    const hoverEffectsEnabled = get('hovereffectsenabled');
    if (hoverEffectsEnabled) {
      state.interactivity.hoverEffectsEnabled = boolVal(hoverEffectsEnabled);
      interactionFX.setConfig({ hoverEffectsEnabled: state.interactivity.hoverEffectsEnabled });
    }
    const clickEffectsEnabled = get('clickeffectsenabled');
    if (clickEffectsEnabled) {
      state.interactivity.clickEffectsEnabled = boolVal(clickEffectsEnabled);
      interactionFX.setConfig({ clickEffectsEnabled: state.interactivity.clickEffectsEnabled });
    }
    const cursorTrailEnabled = get('cursortrailenabled');
    if (cursorTrailEnabled) {
      state.interactivity.cursorTrailEnabled = boolVal(cursorTrailEnabled);
      interactionFX.setConfig({ cursorTrailEnabled: state.interactivity.cursorTrailEnabled });
    }
    const parallaxEnabled = get('parallaxenabled');
    if (parallaxEnabled) {
      state.interactivity.parallaxEnabled = boolVal(parallaxEnabled);
      interactionFX.setConfig({ parallaxEnabled: state.interactivity.parallaxEnabled });
    }
    const interactiveControlsEnabled = get('interactivecontrolsenabled');
    if (interactiveControlsEnabled) {
      state.interactivity.interactiveControlsEnabled = boolVal(interactiveControlsEnabled);
      interactionFX.setConfig({ interactiveControlsEnabled: state.interactivity.interactiveControlsEnabled });
    }
    const hiddenGesturesEnabled = get('hiddengesturesenabled');
    if (hiddenGesturesEnabled) {
      state.hiddenGesturesEnabled = boolVal(hiddenGesturesEnabled);
      state.interactivity.hiddenGesturesEnabled = state.hiddenGesturesEnabled;
      interactionFX.setConfig({ hiddenGesturesEnabled: state.hiddenGesturesEnabled });
    }
    const idleTimeoutSec = get('idletimeoutsec');
    if (idleTimeoutSec) {
      state.interactivity.idleTimeoutSec = numVal(idleTimeoutSec);
      inputManager.options.idleTimeoutSec = state.interactivity.idleTimeoutSec;
    }
    const uiResponsiveness = get('uiresponsiveness');
    if (uiResponsiveness) {
      state.interactivity.uiResponsiveness = numVal(uiResponsiveness);
      interactionFX.setConfig({ uiResponsiveness: state.interactivity.uiResponsiveness });
    }
    const tooltipsEnabled = get('tooltipsenabled');
    if (tooltipsEnabled) {
      state.interactivity.tooltipsEnabled = boolVal(tooltipsEnabled);
      interactionFX.setConfig({ tooltipsEnabled: state.interactivity.tooltipsEnabled });
    }
    const diagnosticsEnabled = get('diagnosticsenabled');
    if (diagnosticsEnabled) {
      state.interactivity.diagnosticsEnabled = boolVal(diagnosticsEnabled);
      updateDiagnosticsMode();
    }
    const thresholdCpu = get('thresholdscpuhigh');
    if (thresholdCpu) state.thresholds.cpuHigh = numVal(thresholdCpu);
    const thresholdGpu = get('thresholdsgpuhigh');
    if (thresholdGpu) state.thresholds.gpuHigh = numVal(thresholdGpu);
    const thresholdNet = get('thresholdsnethigh');
    if (thresholdNet) state.thresholds.netHigh = numVal(thresholdNet);
    microAnimations.updateThresholds(state.thresholds);

    const externalIpEnabled = get('externalipenabled');
    if (externalIpEnabled) {
      state.externalIpEnabled = boolVal(externalIpEnabled);
      state.externalIpEnabled ? startExternalIp() : stopExternalIp();
      updateExternalIpUI(state.cache.ip, !state.externalIpEnabled);
    }

    const showSeconds = get('showseconds');
    if (showSeconds) {
      state.showSeconds = boolVal(showSeconds);
      setupClockTimer();
    }
  },
};

function updateHudLayout() {
  if (!dimensions) return;
  const { width, height } = dimensions;
  const rawSpacing = Math.min(width, height) / state.gridDensity;
  const grid = Math.max(16, Math.min(28, Math.round(rawSpacing)));
  const pad = grid;
  const gap = grid;
  const safeTop = Math.round(grid * 0.9);
  const safeBottom = Math.round(grid * 2.8);
  const safeLeft = Math.round(grid * 0.9);
  const safeRight = Math.round(grid * 0.9);
  const availableWidth = Math.max(0, width - safeLeft - safeRight);
  const availableHeight = Math.max(0, height - safeTop - safeBottom);
  const usableWidth = availableWidth - pad * 2;
  const usableHeight = availableHeight - pad * 2;

  let col = Math.floor((usableWidth - gap * 2) / 3 / grid) * grid;
  if (!isFinite(col) || col <= 0) {
    const base = Math.floor(Math.max(0, usableWidth - gap * 2) / 3 / grid) * grid;
    col = Math.max(grid * 3, base || grid * 3);
  }
  let hudWidth = col * 3 + gap * 2 + pad * 2;
  if (hudWidth > availableWidth) {
    const maxCol = Math.floor((availableWidth - pad * 2 - gap * 2) / 3 / grid) * grid;
    col = Math.max(grid * 3, maxCol);
    hudWidth = col * 3 + gap * 2 + pad * 2;
  }

  const ratios = [0.9, 1, 0.7];
  const sum = ratios.reduce((a, b) => a + b, 0);
  const heightForRows = Math.max(0, usableHeight - gap * 2);
  let rowTop = Math.floor((heightForRows * ratios[0]) / sum / grid) * grid;
  let rowMid = Math.floor((heightForRows * ratios[1]) / sum / grid) * grid;
  let rowBottom = heightForRows - rowTop - rowMid;
  rowBottom = Math.max(grid * 3, Math.floor(rowBottom / grid) * grid);
  let hudHeight = rowTop + rowMid + rowBottom + gap * 2 + pad * 2;
  if (hudHeight > availableHeight) {
    const maxRow = Math.floor((availableHeight - pad * 2 - gap * 2) / grid) * grid;
    rowBottom = Math.max(grid * 3, maxRow - rowTop - rowMid);
    hudHeight = rowTop + rowMid + rowBottom + gap * 2 + pad * 2;
  }

  const rawOffsetX = safeLeft + Math.round((availableWidth - hudWidth) / 2 / grid) * grid;
  const rawOffsetY = safeTop + Math.round((availableHeight - hudHeight) / 2 / grid) * grid;
  const maxOffsetX = Math.max(0, width - hudWidth);
  const maxOffsetY = Math.max(0, height - hudHeight);
  const offsetX = clamp(rawOffsetX, 0, maxOffsetX);
  const offsetY = clamp(rawOffsetY, 0, maxOffsetY);

  state.hudLayout = {
    x: offsetX,
    y: offsetY,
    pad,
    gap,
    col,
    rowTop,
    rowMid,
    rowBottom,
    width: hudWidth,
    height: hudHeight,
  };

  const root = document.documentElement;
  root.style.setProperty('--hud-pad', `${pad}px`);
  root.style.setProperty('--hud-gap', `${gap}px`);
  root.style.setProperty('--hud-col', `${col}px`);
  root.style.setProperty('--hud-row-top', `${rowTop}px`);
  root.style.setProperty('--hud-row-mid', `${rowMid}px`);
  root.style.setProperty('--hud-row-bottom', `${rowBottom}px`);
  root.style.setProperty('--hud-width', `${hudWidth}px`);
  root.style.setProperty('--hud-height', `${hudHeight}px`);
  root.style.setProperty('--hud-x', `${offsetX}px`);
  root.style.setProperty('--hud-y', `${offsetY}px`);

  updateBlockRegistry();
}

function updateBlockRegistry() {
  if (!state.hudLayout || !dimensions) return;
  const layout = state.hudLayout;
  const x1 = layout.x + layout.pad;
  const y1 = layout.y + layout.pad;
  const x2 = x1 + layout.col + layout.gap;
  const x3 = x2 + layout.col + layout.gap;
  const y2 = y1 + layout.rowTop + layout.gap;
  const y3 = y2 + layout.rowMid + layout.gap;
  const leftHeight = layout.rowTop + layout.rowMid + layout.rowBottom + layout.gap * 2;

  const timeRect = { x: x3, y: y1, w: layout.col, h: layout.rowTop };
  const calendarRect =
    getElementRect(calendarEl) || {
      x: x3 + 12,
      y: y1 + layout.rowTop * 0.35,
      w: layout.col - 24,
      h: layout.rowTop * 0.6,
    };
  const waveformRect = {
    x: layout.x,
    y: layout.y + layout.height * 0.32,
    w: layout.width,
    h: layout.rowMid * 0.5,
  };
  const systemTextRect =
    getElementRect(systemTextPanelEl) || {
      x: x1 + layout.col * 0.06,
      y: y1 + leftHeight * 0.44,
      w: layout.col * 0.88,
      h: leftHeight * 0.48,
    };

  blocks = {
    nowPlaying: { rect: { x: x1, y: y1, w: layout.col, h: leftHeight }, importance: 3, priority: 4 },
    systemText: { rect: systemTextRect, importance: 2.2, priority: 6 },
    weather: { rect: { x: x2, y: y1, w: layout.col, h: layout.rowTop }, importance: 2, priority: 3 },
    time: { rect: timeRect, importance: 2, priority: 3 },
    calendar: { rect: calendarRect, importance: 1, priority: 2 },
    system: { rect: { x: x2, y: y2, w: layout.col * 2 + layout.gap, h: layout.rowMid }, importance: 3, priority: 5 },
    network: { rect: { x: x2, y: y3, w: layout.col, h: layout.rowBottom }, importance: 2, priority: 2 },
    disks: { rect: { x: x3, y: y3, w: layout.col, h: layout.rowBottom }, importance: 2, priority: 2 },
    waveform: { rect: waveformRect, importance: 1, priority: 1 },
  };

  const strings = getStrings();
  blockLabels = {
    nowPlaying: strings.titles.nowPlaying,
    systemText: strings.titles.systemText,
    weather: strings.titles.weather,
    time: strings.titles.clock,
    calendar: strings.titles.calendar,
    system: strings.titles.metrics,
    network: strings.titles.network,
    disks: strings.titles.disks,
    waveform: strings.titles.waveform,
  };

  textTargets = Array.from(document.querySelectorAll('[data-glitch="1"]'));
  glitchSystem.setBlocks(blocks, blockLabels, textTargets);
  interactionFX.setBlocks(blocks, blockElements);
}

function updateColor(key, arr) {
  let col = arr;
  if (Array.isArray(arr)) {
    col = `rgb(${arr[0]}, ${arr[1]}, ${arr[2]})`;
  } else if (typeof arr === 'string') {
    if (arr.includes(' ') && !arr.includes('rgb')) {
      const parts = arr.trim().split(/\s+/).map(Number);
      if (parts.length >= 3) {
        const [r, g, b] = parts.map(v => Math.round(v * 255));
        col = `rgb(${r}, ${g}, ${b})`;
      }
    }
  }
  state.colors[key] = col;
  if (state.baseColors && state.baseColors[key] !== undefined) {
    state.baseColors[key] = col;
  }
  if (key === 'background') document.documentElement.style.setProperty('--bg', col);
  if (key === 'primary') document.documentElement.style.setProperty('--primary', col);
  if (key === 'secondary') document.documentElement.style.setProperty('--secondary', col);
}

function setLanguage(locale) {
  const normalized = I18N[locale]
    ? locale
    : locale && locale.toLowerCase().startsWith('ru')
    ? 'ru-RU'
    : 'en-US';
  state.language = normalized;
  semanticEngine.setConfig({ language: state.language });
  logBuffer.setStorageKey(getLogStorageKey(state.language));
  logRenderer.setConfig({ locale: state.language });
  resetSystemText(true);
  applyLanguage();
  setupClockTimer();
}

function setTextScale(scale) {
  if (!isFinite(scale)) return;
  state.textScale = clamp(scale, 0.8, 1.8);
  document.documentElement.style.setProperty('--text-scale', `${state.textScale}`);
  interactionFX.setConfig({ textScale: state.textScale });
  microAnimations.setTextScale(state.textScale);
  logRenderer.setConfig({ textScale: state.textScale });
}

function setCoverPosition(value) {
  if (!panelNowPlayingEl) return;
  panelNowPlayingEl.classList.toggle('cover-right', value === 'right');
}

function setCoverStyle(value) {
  if (!coverEl) return;
  coverEl.classList.toggle('rounded', value === 'rounded');
}

function setLayout(layout) {
  state.layoutPreset = layout;
  overlay.classList.remove('layout-left', 'layout-right', 'layout-top');
  if (layout === 'Left HUD') overlay.classList.add('layout-left');
  else if (layout === 'Right HUD') overlay.classList.add('layout-right');
  else overlay.classList.add('layout-top');
}

init();






