import { AudioEngine, registerWallpaperAudio } from './modules/audio.js';
import { NowPlayingService } from './modules/nowplaying.js';
import { WeatherService } from './modules/services/weather_service.js';
import { PerfService } from './modules/services/perf_service.js';
import { ExternalIpService } from './modules/services/ip_service.js';
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
import { SemanticEngine } from './modules/text_ai/semantic_engine.js';
import { MusicContext } from './modules/text/music_context.js';
import { LogBuffer } from './modules/text/log_buffer.js';
import { LogRenderer } from './modules/text/log_renderer.js';
import { buildCalendarData, getCalendarHover } from './modules/ui/render_calendar.js';
import { PerfProfiler } from './modules/core/perf_profiler.js';
import { fetchTracker } from './modules/core/fetch_tracker.js';
import { allocationDetector } from './modules/core/allocation_detector.js';
import { Scheduler } from './modules/core/scheduler.js';
import { createStateStore } from './modules/core/state_store.js';
import { MainLoop } from './modules/core/main_loop.js';
import { runSelfChecks } from './modules/core/self_checks.js';
import { CORE_CONFIG } from './modules/core/config.js';
import { settings } from './settings.js';
import { installWallpaperPropertyListener } from './we_properties.js';
import { HudRenderer } from './modules/render/hud_renderer.js';
import { TextRenderer } from './modules/render/text_renderer.js';
import { FxRenderer } from './modules/render/fx_renderer.js';
import { computeHudLayout, applyHudCssVars, computeBlockRegistry, getElementRect } from './modules/render/layout.js';
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
const systemTextPanelEl = document.getElementById('system-text-panel');
const clockTimeEl = document.getElementById('clock-time');
const clockDateEl = document.getElementById('clock-date');
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
const diskCBarEl = document.getElementById('disk-c-bar');
const diskDBarEl = document.getElementById('disk-d-bar');
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
let lastTrackKey = null;
let blocks = {};
let blockLabels = {};
let textTargets = [];
let lastPerfOnline = null;
let lastMetrics = null;
let calendarOffset = 0;
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
let lastBigEventAt = 0;
let lastLongIdleAt = 0;
let calendarData = null;
const jitterTimers = new WeakMap();
let glitchVisual = { intensity: 0, target: 0 };
let calendarHover = null;
let mainLoop = null;
let renderLoopActive = false;
let lastOkTs = performance.now();
let lastFrameDelta = 0;
let frameCounter = 0;
let fpsSample = { acc: 0, count: 0, lastStamp: performance.now(), fps: 60 };
let watchdogTimer = null;
let softResetCount = 0;
let lastSoftResetAt = 0;
let softResetInProgress = false;
let lastSoftResetReason = 'none';
const WATCHDOG_INTERVAL_MS = CORE_CONFIG.watchdogIntervalMs;
const WATCHDOG_STALL_MS = CORE_CONFIG.watchdogStallMs;
const frameState = {
  now: 0,
  dt: 0,
  audioAgg: null,
  timeState: null,
  musicState: null,
  glitchDebug: null,
  bigEventActive: false,
  lastBigEventAgeSec: 0,
  hit: null,
  inputState: null,
  coreState: null,
  entropy: 0,
  calendarHover: null,
};

const stateStore = createStateStore({
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
    localGlitchesEnabled: true,
    localGlitchIntervalMinSec: 6,
    localGlitchIntervalMaxSec: 16,
    localGlitchIntensityBoost: 1,
    localGlitchFrequencyBoost: 1,
    allowTwoBlockGlitches: true,
    electricEffectsEnabled: true,
    electricIntensity: 1.2,
    electricArcCooldown: 20,
    electricLadderSpeed: 1,
    electricAudioReactive: true,
    maxSimultaneousLocal: 2,
    maxSimultaneousGlitches: 2,
    allowScreenWideEffects: true,
    bigEventChance: 0.2,
    chromaticAberrationEnabled: true,
    themePrimary: '#8dfc4f',
    themeSecondary: '#3fe7ff',
    alienAlphabetStrength: 1,
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
    perfProfilerEnabled: false,
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
    textModeStrategy: 'auto',
    smartCandidateCount: 40,
    degradationSensitivity: 1,
    robotModeThreshold: 1,
    apologyEnabled: true,
    preemptiveWarnings: true,
    whiningIntensity: 1.2,
    alienAlphabetStrength: 1,
    debugTextAI: false,
  },
  mood: {
    reactiveText: true,
    reactiveVisuals: true,
    aggressiveness: 1,
    debug: false,
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
});
const state = stateStore.state;

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
        idle: '',
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
const textRenderer = new TextRenderer(logRenderer);
const fxCanvas = document.createElement('canvas');
const hudRenderer = new HudRenderer(bgCanvas, hudCanvas);
hudRenderer.setTextCanvas(textRenderer.canvas);
const fxRenderer = new FxRenderer(fxCanvas);

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
  textModeStrategy: state.semanticText.textModeStrategy,
  smartCandidateCount: state.semanticText.smartCandidateCount,
  degradationSensitivity: state.semanticText.degradationSensitivity,
  robotModeThreshold: state.semanticText.robotModeThreshold,
  apologyEnabled: state.semanticText.apologyEnabled,
  preemptiveWarnings: state.semanticText.preemptiveWarnings,
  whiningIntensity: state.semanticText.whiningIntensity,
  alienAlphabetStrength: state.semanticText.alienAlphabetStrength,
  debugTextAI: state.semanticText.debugTextAI,
  moodReactiveText: state.mood.reactiveText,
  language: state.language,
});
const musicContext = new MusicContext();
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
const perfProfiler = new PerfProfiler({ logIntervalMs: CORE_CONFIG.perfLogIntervalMs });

const glitchSystem = new GlitchSystem(state.glitchConfig, blocks, blockLabels, textTargets);

registerWallpaperAudio(audioEngine, arr => {
  glitchSystem.onAudioFrame(arr);
  audioDriver.onAudioFrame(arr);
});

const scheduler = new Scheduler();
const weatherService = new WeatherService({ provider: 'open-meteo', units: state.units }, updateWeatherUI);
const perfService = new PerfService('http://172.25.160.1:8085/data.json', updatePerfUI);
const ipService = new ExternalIpService(updateExternalIpUI);
const nowPlayingService = new NowPlayingService(updateNowPlayingUI);

const schedulerTasks = {
  weather: scheduler.addTask('weather', {
    intervalMs: weatherService.options.refreshMinutes * 60 * 1000,
    jitterMs: 60000,
    handler: () =>
      weatherService.fetch().catch(err => {
        updateWeatherUI(weatherService.getCache());
        throw err;
      }),
  }),
  perf: scheduler.addTask('perf', {
    intervalMs: 5000,
    jitterMs: 500,
    handler: () =>
      perfService.fetch().catch(() => {
        perfService.fail();
      }),
  }),
  ip: scheduler.addTask('ip', {
    intervalMs: 45 * 60 * 1000,
    jitterMs: 5 * 60 * 1000,
    handler: () =>
      ipService
        .fetch()
        .then(data => {
          state.cache.ip = data;
          return data;
        })
        .catch(err => {
          state.cache.ip = null;
          updateExternalIpUI(null);
          throw err;
        }),
  }),
};

function init() {
  resize();
  window.addEventListener('resize', resize);

  setTextScale(state.textScale);
  resetSystemText();
  scheduler.setEnabled('weather', state.weatherEnabled);
  scheduler.setEnabled('perf', true);
  scheduler.setEnabled('ip', state.externalIpEnabled);
  applyLanguage();
  applyVisualProfile(state.visualProfile);
  setupClockTimer();
  updateExternalIpUI(state.cache.ip, !state.externalIpEnabled);

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
  eventBus.on('gesture:circle', () => handleCircleGesture());
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

  runSelfChecks({ semanticEngine });

  startWatchdog();
  startRenderLoop();
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
  const showMood = state.mood.debug;
  const showTextAI = state.semanticText.debugTextAI;
  const showPerf = state.interactivity.perfProfilerEnabled || state.interactivity.diagnosticsEnabled;
  diagnostics.setMode({ showInput, showGlitch, showMood, showTextAI, showPerf });
  diagnostics.setEnabled(showInput || showGlitch || showMood || showTextAI || showPerf);
  perfProfiler.setEnabled(showPerf);
  allocationDetector.setEnabled(showPerf);
}

function resolveMoodMultipliers(moodClass = 'steady', aggressiveness = 1) {
  const agg = clamp(aggressiveness, 0.5, 2);
  const base = {
    calm: { freqMul: 0.8, intensityMul: 0.88, bigEventBoost: 0 },
    steady: { freqMul: 1, intensityMul: 1, bigEventBoost: 0 },
    tense: { freqMul: 1.15, intensityMul: 1.12, bigEventBoost: 0.08 },
    chaotic: { freqMul: 1.35, intensityMul: 1.28, bigEventBoost: 0.14 },
  }[moodClass] || { freqMul: 1, intensityMul: 1, bigEventBoost: 0 };

  const freqMul = clamp(1 + (base.freqMul - 1) * agg, 0.7, 1.6);
  const intensityMul = clamp(1 + (base.intensityMul - 1) * agg, 0.8, 1.5);
  const bigEventBoost = clamp((base.bigEventBoost || 0) * agg, 0, 0.3);

  return {
    freqMul,
    intensityMul,
    bigEventBoost,
    chaotic: moodClass === 'chaotic',
  };
}

function parseDiskPercent(str) {
  if (!str) return 0;
  const pctMatch = str.match(/^(\d+(?:\.\d+)?)%/);
  if (pctMatch) return parseFloat(pctMatch[1]);
  const gbMatch = str.match(/([\d.]+)\s*GB\s*\/\s*([\d.]+)\s*GB/i);
  if (gbMatch) {
    const used = parseFloat(gbMatch[1]);
    const total = parseFloat(gbMatch[2]);
    return total > 0 ? (used / total) * 100 : 0;
  }
  return 0;
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
  stateStore.markDirty(['hudStatic', 'text']);
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

function handleCircleGesture() {
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

function updateGlitchVisual(dt, glitchDebug, audioAgg, bigEventActive) {
  const root = document.documentElement;
  if (!state.glitchConfig.glitchesEnabled) {
    glitchVisual.intensity = Math.max(0, glitchVisual.intensity - dt * 3);
    root.style.setProperty('--glitch-intensity', glitchVisual.intensity.toFixed(3));
    document.body.classList.toggle('glitch-active', glitchVisual.intensity > 0.05);
    return;
  }

  const activeCount = glitchDebug?.active?.length || 0;
  const meta = glitchDebug?.activeMeta || [];
  const hasScreen = meta.some(entry => entry.category === 'screen');
  const hasBig = bigEventActive || meta.some(entry => entry.category === 'big');
  const audioEnergy = clamp(audioAgg?.energy || 0, 0, 1);
  const audioBoost = audioEnergy * 0.35 + (audioAgg?.peak ? 0.55 : 0);
  const activityBoost = activeCount * 0.25 + (hasScreen ? 0.45 : 0) + (hasBig ? 0.7 : 0);
  const userIntensity = clamp(state.glitchConfig.glitchIntensity, 0.2, 2.2);
  const userScale = 0.6 + Math.pow(userIntensity, 1.35) * 0.35;
  const target = clamp((0.18 + activityBoost + audioBoost) * userScale, 0, 2.4);

  glitchVisual.target = target;
  const lerp = (a, b, t) => a + (b - a) * t;
  const eased = clamp(dt * 6, 0.05, 0.35);
  glitchVisual.intensity = lerp(glitchVisual.intensity, glitchVisual.target, eased);

  root.style.setProperty('--glitch-intensity', glitchVisual.intensity.toFixed(3));
  document.body.classList.toggle('glitch-active', glitchVisual.intensity > 0.08);
}

function applyTimeTone(timeState) {
  if (!state.timeOfDayAdaptive) {
    state.colors.background = state.baseColors.background;
    state.colors.primary = state.baseColors.primary;
    state.colors.secondary = state.baseColors.secondary;
    return;
  }
  const prevBg = state.colors.background;
  const prevPrimary = state.colors.primary;
  const prevSecondary = state.colors.secondary;
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
  if (glitchSystem) {
    state.glitchConfig.themePrimary = state.colors.primary;
    state.glitchConfig.themeSecondary = state.colors.secondary;
    glitchSystem.setConfig({
      themePrimary: state.colors.primary,
      themeSecondary: state.colors.secondary,
    });
  }
  if (
    prevBg !== state.colors.background ||
    prevPrimary !== state.colors.primary ||
    prevSecondary !== state.colors.secondary
  ) {
    stateStore.markDirty(['hudStatic', 'text']);
  }
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

function showSystemText(payload) {
  if (!payload) return;
  if (typeof payload === 'string') {
    logBuffer.push(payload, 'semantic');
    stateStore.markDirty('text');
    return;
  }
  const text = payload.text;
  if (!text) return;
  logBuffer.push(
    {
      text,
      ts: payload.ts || Date.now(),
      mode: payload.mode || '',
      intent: payload.intent || '',
      level: 'semantic',
    },
    'semantic'
  );
  stateStore.markDirty('text');
}

function updateSystemTextDisplay(displayState = {}) {
  logDisplayState = displayState;
}

function resetSystemText(force = false) {
  if (force || !state.log.persist) logBuffer.clear();
  logDisplayState = { level: 0, jitter: 0, flicker: 0 };
  stateStore.markDirty('text');
}

function triggerSystemEvent(key, ttl = 6, payload = null) {
  systemEventTracker.trigger(key, ttl, payload);
}

function triggerUserEvent(key, ttl = 4, payload = null) {
  userEventTracker.trigger(key, ttl, payload);
}

function triggerLocalGlitch(options = {}) {
  if (!state.glitchConfig.glitchesEnabled || !state.glitchConfig.localGlitchesEnabled) return false;
  return glitchSystem.triggerLocal(options);
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
    if (hit.isInside && state.interactivity.clickEffectsEnabled) {
      triggerLocalGlitch({ blockId: hit.hoveredBlockId });
    }
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

function createEventTracker() {
  const events = new Map();
  return {
    trigger(name, ttl = 4, payload = null) {
      const until = performance.now() + ttl * 1000;
      const prev = events.get(name);
      const count = (prev?.count || 0) + 1;
      events.set(name, { until, payload, count });
    },
    snapshot() {
      const now = performance.now();
      const active = {};
      events.forEach((value, key) => {
        if (value.until > now) {
          active[key] = value.payload ? { active: true, payload: value.payload, count: value.count } : true;
        }
        else events.delete(key);
      });
      return active;
    },
  };
}

function resize() {
  const fg = setupHiDPICanvas(fgCanvas);
  fgCtx = fg.ctx;
  dimensions = hudRenderer.resize();
  state.dimensions = dimensions;
  bgCtx = hudRenderer.bgCtx;
  hudCtx = hudRenderer.hudCtx;
  textRenderer.resize(dimensions.width, dimensions.height);
  fxRenderer.resize();
  updateHudLayout();
}

function sanitizeContext(ctx, resetTransform = true) {
  if (!ctx) return;
  if (resetTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
}

function clearCanvas(ctx) {
  if (!ctx) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function stopRenderLoop() {
  if (!renderLoopActive) return;
  renderLoopActive = false;
  mainLoop?.stop();
}

function startRenderLoop() {
  if (renderLoopActive) return;
  renderLoopActive = true;
  lastOkTs = performance.now();
  if (!mainLoop) {
    mainLoop = new MainLoop({
      update: updateFrame,
      render: renderFrame,
      onError: err => {
        console.error('[HUD] render loop exception', err);
        softReset('exception');
      },
    });
  }
  mainLoop.start();
}

function startWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    if (!renderLoopActive || softResetInProgress) return;
    const now = performance.now();
    const stalled = now - lastOkTs > WATCHDOG_STALL_MS;
    if (stalled && now - lastSoftResetAt > 2000) {
      softReset('watchdog');
    }
  }, WATCHDOG_INTERVAL_MS);
}

function softReset(reason = 'unknown') {
  if (softResetInProgress) return;
  const now = performance.now();
  if (now - lastSoftResetAt < 1000) return;
  softResetInProgress = true;
  lastSoftResetAt = now;
  softResetCount += 1;
  lastSoftResetReason = reason;
  console.warn(`[HUD] soft reset: ${reason}`);

  try {
    stopRenderLoop();

    sanitizeContext(bgCtx, true);
    sanitizeContext(fgCtx, true);
    sanitizeContext(hudCtx, true);
    clearCanvas(bgCtx);
    clearCanvas(fgCtx);
    clearCanvas(hudCtx);

    resize();
    sanitizeContext(bgCtx, false);
    sanitizeContext(fgCtx, false);
    sanitizeContext(hudCtx, false);

    glitchSystem.reset?.();
    interactionFX.resetTransient?.({ keepPins: true, keepDetail: true });
    microAnimations.reset?.();
    overlayMessages.reset?.();
    semanticEngine.resetTransient?.();
    audioDriver.reset?.();
    glitchUpdateTimer = 0;

    logDisplayState = { level: 0, jitter: 0, flicker: 0 };
    frameCounter = 0;
    fpsSample = { acc: 0, count: 0, lastStamp: performance.now(), fps: 60 };

    hudRenderer.markStaticDirty();
    textRenderer.markDirty();
    stateStore.markDirty(['hudStatic', 'text']);

    lastOkTs = performance.now();
    startRenderLoop();
  } finally {
    softResetInProgress = false;
  }
}

function updateFrame(dt, now) {
  if (!renderLoopActive) return;
  perfProfiler.beginFrame(now);
  perfProfiler.start('update', now);
  allocationDetector.resetFrame();
  lastFrameDelta = dt * 1000;
  frameState.now = now;
  frameState.dt = dt;

  audioEngine.tick(now);
  state.audio = audioEngine.getState();
  audioDriver.update(dt);
  const audioAgg = audioDriver.getState();

  const timeState = timeContext.update(now);
  if (timeState.dateChanged) {
    eventBus.emit('block:pulse', { id: 'system', intensity: 1.1 });
  }
  applyTimeTone(timeState);
  scheduler.update(now);

  const trackState = state.cache.track || nowPlayingService.getState();
  const musicState = musicContext.update(
    {
      trackTitle: trackState?.title,
      artistName: trackState?.artist,
      albumName: trackState?.album,
      durationSec: trackState?.durationSec,
      positionSec: trackState?.positionSec,
      isPlaying: trackState?.playbackState === 'playing',
    },
    audioAgg,
    timeState,
    now,
    { moodAggressiveness: state.mood.aggressiveness }
  );
  if (musicState?.novelty?.isNewTrack && musicState.hasData) {
    triggerSystemEvent('TRACK_CHANGE', 8, {
      title: musicState.trackTitle,
      artist: musicState.artistName,
      keywords: musicState.extractedKeywords,
      topics: musicState.topicsWeights,
    });
  }

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
  if (hit.hoveredBlockId === 'calendar' && blocks.calendar?.rect && calendarData) {
    calendarHover = getCalendarHover(
      blocks.calendar.rect,
      calendarData,
      { textScale: state.textScale },
      inputState.pos.x,
      inputState.pos.y
    );
  } else {
    calendarHover = null;
  }
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
  if (state.mood.reactiveVisuals) {
    const moodClass = musicState?.mood?.moodClass || 'steady';
    glitchSystem.setMoodMultipliers(resolveMoodMultipliers(moodClass, state.mood.aggressiveness));
  } else {
    glitchSystem.setMoodMultipliers({ freqMul: 1, intensityMul: 1, bigEventBoost: 0, chaotic: false });
  }
  glitchSystem.update(dt, now);
  const glitchDebug = glitchSystem.getDebugInfo();
  const bigEventActive =
    (glitchDebug.activeMeta || []).some(entry => entry.category === 'big') ||
    (glitchDebug.active || []).some(id => id >= 39);
  if (bigEventActive) triggerSystemEvent('glitchEvent', 4);
  if (lastBigEventActive && !bigEventActive) triggerSystemEvent('recovery', 6);
  lastBigEventActive = bigEventActive;
  if (bigEventActive) lastBigEventAt = now;
  const lastBigEventAgeSec = lastBigEventAt ? (now - lastBigEventAt) / 1000 : 999;
  const systemEvents = systemEventTracker.snapshot();
  const userEvents = {
    ...userEventTracker.snapshot(),
    idle: inputState.idle,
    idleDuration,
    hoverText: hit.hoveredBlockId === 'systemText',
  };
  perfProfiler.start('textGen');
  const semanticText = semanticEngine.update(dt, {
    systemState: coreState.state,
    entropyLevel: entropy,
    audioState: audioAgg,
    glitchState: {
      activeGlitches: glitchDebug.active || [],
      recentBigEvent: bigEventActive,
      bigEventActive,
      activeCount: glitchDebug.active?.length || 0,
      lastBigEventAgeSec,
      glitchIntensity: state.glitchConfig.glitchIntensity,
      alienAlphabetStrength: state.glitchConfig.alienAlphabetStrength,
    },
    performanceState: {
      fpsEstimate: fpsSample.fps || Math.round(1 / Math.max(0.001, dt)),
      lastFrameDeltaMs: lastFrameDelta,
    },
    metrics: {
      cpu: state.cache.perf?.psutil?.cpu,
      gpu: state.cache.perf?.psutil?.gpu_usage,
      mem: state.cache.perf?.psutil?.memory,
      cpu_temp: state.cache.perf?.psutil?.cpu_temp,
      vram: state.cache.perf?.psutil?.vram_usage,
      down: formatSpeed(state.cache.perf?.psutil?.download_speed, state.language),
      up: formatSpeed(state.cache.perf?.psutil?.upload_speed, state.language),
    },
    behaviorMemory: behaviorSummary,
    systemEvents,
    userInputEvents: userEvents,
    timeState,
    musicContext: musicState,
    moodAggressiveness: state.mood.aggressiveness,
  });
  perfProfiler.end('textGen');
  if (semanticText) showSystemText(semanticText);
  if (state.semanticText.enabled) {
    updateSystemTextDisplay(semanticEngine.getDisplayState());
  } else {
    updateSystemTextDisplay({ level: 0, jitter: 0, flicker: 0 });
  }
  microAnimations.update(dt);
  overlayMessages.update(dt);

  updateGlitchRuntime(dt, entropy, coreState.modifiers);
  state.parallax = interactionFX.getParallax();
  updateGlitchVisual(dt, glitchDebug, audioAgg, bigEventActive);

  frameState.audioAgg = audioAgg;
  frameState.timeState = timeState;
  frameState.musicState = musicState;
  frameState.glitchDebug = glitchDebug;
  frameState.bigEventActive = bigEventActive;
  frameState.lastBigEventAgeSec = lastBigEventAgeSec;
  frameState.hit = hit;
  frameState.inputState = inputState;
  frameState.coreState = coreState;
  frameState.entropy = entropy;
  frameState.calendarHover = calendarHover;

  perfProfiler.end('update', now);
}

function renderFrame(dt, now) {
  if (!renderLoopActive) return;
  const audioAgg = frameState.audioAgg;
  const musicState = frameState.musicState;
  const glitchDebug = frameState.glitchDebug || { active: [], activeMeta: [], nextIn: 0 };
  const hit = frameState.hit || { hoveredBlockId: null };
  const inputState = frameState.inputState || { velocity: { x: 0, y: 0 } };

  if (stateStore.isDirty('hudStatic')) {
    hudRenderer.markStaticDirty();
    stateStore.clearDirty('hudStatic');
  }
  if (stateStore.isDirty('text')) {
    textRenderer.markDirty();
    stateStore.clearDirty('text');
  }

  perfProfiler.start('renderHUD');
  textRenderer.render(now, {
    logEntries: logBuffer.getEntries(),
    logRect: blocks.systemText?.rect,
    logEnabled: state.log.enabled,
    logDisplayState: logDisplayState,
    calendarData,
    calendarRect: blocks.calendar?.rect,
    calendarHover: frameState.calendarHover,
    colors: state.colors,
    lineWidth: state.lineThickness,
    textScale: state.textScale,
    fontScale: state.log.fontScale,
    showTimestamp: state.log.showTimestamp,
    locale: state.language,
    logColor: 'rgba(255, 255, 255, 0.98)',
    logSecondary: 'rgba(132, 255, 226, 0.7)',
  });
  hudRenderer.render(state, {});
  perfProfiler.end('renderHUD');

  fgCtx.clearRect(0, 0, dimensions.width, dimensions.height);
  fgCtx.drawImage(hudCanvas, 0, 0);

  perfProfiler.start('renderFX');
  fxRenderer.render(fgCtx, {
    hudCanvas,
    mainCanvas: fgCanvas,
    blocks,
    interactionFX,
    microAnimations,
    glitchSystem,
    narrativeEngine,
    overlayMessages,
  });
  perfProfiler.end('renderFX');

  frameCounter += 1;
  fpsSample.acc += dt;
  fpsSample.count += 1;
  if (now - fpsSample.lastStamp >= 1000) {
    fpsSample.fps = Math.round(fpsSample.count / Math.max(0.001, fpsSample.acc));
    fpsSample.acc = 0;
    fpsSample.count = 0;
    fpsSample.lastStamp = now;
  }

  const activeTimers = (clockTimer ? 1 : 0) + (watchdogTimer ? 1 : 0) + scheduler.getTaskCount();
  perfProfiler.setCounters({
    activeEffects: glitchDebug.active?.length || 0,
    activeTimers,
    activeFetches: fetchTracker.active,
    logSize: logBuffer.getEntries().length,
  });
  perfProfiler.endFrame(now);
  perfProfiler.maybeLog(now);
  const perfStats = perfProfiler.getStats();
  allocationDetector.maybeWarn(now);
  const allocStats = allocationDetector.getStats();

  const sinceOk = (now - lastOkTs) / 1000;
  diagnostics.update({
    hoveredBlock: hit.hoveredBlockId,
    mouseSpeed: Math.hypot(inputState.velocity.x, inputState.velocity.y),
    audio: audioAgg,
    mood: musicState?.mood,
    textAI: semanticEngine.getDebugInfo?.(),
    activeGlitches: glitchDebug.active,
    nextGlitch: glitchDebug.nextIn,
    profiler: perfStats,
    allocations: allocStats,
    frameCount: frameCounter,
    fps: fpsSample.fps || Math.round(1 / Math.max(0.001, dt)),
    watchdog: {
      status: now - lastOkTs > WATCHDOG_STALL_MS ? 'STALLED' : 'OK',
      sinceOk,
      lastFrameMs: lastFrameDelta,
      softResets: softResetCount,
      lastResetReason: lastSoftResetReason,
    },
  });
  diagnostics.render(fgCtx, blocks, hit.hoveredBlockId);

  lastOkTs = performance.now();
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
  }
}

function updateWeatherUI(data) {
  perfProfiler.start('weather');
  const strings = getStrings();
  setText(weatherCityEl, strings.weather.city);
  if (!data) {
    coreStateMachine.reportDataStatus('weather', false);
    setText(weatherCondEl, strings.weather.noData);
    setText(weatherTempEl, '--°');
    weatherForecastEl.innerHTML = '';
    if (weatherIconEl) weatherIconEl.innerHTML = '';
    lastWeatherSignature = null;
    perfProfiler.end('weather');
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
  perfProfiler.end('weather');
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

function updatePerfUI({ data, online }) {
  perfProfiler.start('perf');
  const strings = getStrings();
  state.cache.perf = data;
  state.cache.perfOnline = online;
  if (!data) {
    coreStateMachine.reportDataStatus('system', false);
    coreStateMachine.reportDataStatus('network', false);
    setText(hwStatusEl, online ? strings.hw.waiting : strings.hw.offline);
    setText(hwUpdateEl, '--');
    updateCpuCores([]);
    perfProfiler.end('perf');
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
  if (diskCBarEl) diskCBarEl.style.width = parseDiskPercent(p.c_disk) + '%';
  if (diskDBarEl) diskDBarEl.style.width = parseDiskPercent(p.d_disk) + '%';

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
    if (cpuDelta > 22) {
      triggerSystemEvent('cpuSpike', 8);
      triggerLocalGlitch({ tags: ['electric'], blockId: 'system' });
    }
    if (gpuDelta > 22) {
      triggerSystemEvent('gpuSpike', 8);
      triggerLocalGlitch({ tags: ['electric'], blockId: 'system' });
    }
  }
  lastMetrics = { ...p };

  if (lastNetDown !== null) {
    if (lastNetDown > 50000 && (p.download_speed ?? 0) < 5000) {
      triggerSystemEvent('netDrop', 8);
      triggerLocalGlitch({ tags: ['link', 'signal'], preferPair: true, blockId: 'network' });
    }
    if (lastNetDown < 5000 && (p.download_speed ?? 0) > 25000) {
      triggerSystemEvent('netRestore', 8);
      triggerLocalGlitch({ tags: ['link', 'signal'], preferPair: true, blockId: 'network' });
    }
  }
  lastNetDown = p.download_speed ?? lastNetDown;

  const diskCUsage = parseDiskUsage(p.c_disk);
  if (diskCUsage && lastDiskUsage.c) {
    const diff = Math.abs(diskCUsage.used - lastDiskUsage.c.used);
    if (diskCUsage.total > 0 && diff / diskCUsage.total > 0.02) {
      triggerSystemEvent('diskAnomaly', 12);
      triggerLocalGlitch({ tags: ['signal'], blockId: 'disks' });
    }
  }
  if (diskCUsage) lastDiskUsage.c = diskCUsage;
  const diskDUsage = parseDiskUsage(p.d_disk);
  if (diskDUsage && lastDiskUsage.d) {
    const diff = Math.abs(diskDUsage.used - lastDiskUsage.d.used);
    if (diskDUsage.total > 0 && diff / diskDUsage.total > 0.02) {
      triggerSystemEvent('diskAnomaly', 12);
      triggerLocalGlitch({ tags: ['signal'], blockId: 'disks' });
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

  setText(hwStatusEl, online ? strings.hw.online : strings.hw.cached);
  const stamp = p.timestamp || data.timestamp;
  setText(hwUpdateEl, formatHwTimestamp(stamp));
  perfProfiler.end('perf');
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
    stateStore.markDirty('text');
  }
}

// Wallpaper Engine property integration
function applySettingsToSubsystems(changedKeys) {
  if (!changedKeys || !changedKeys.size) return;
  const has = key => changedKeys.has(key);
  const hasAny = (...keys) => keys.some(has);

  if (has('themecolorprimary')) updateColor('primary', settings.getColor255('themecolorprimary'));
  if (has('themecolorsecondary')) updateColor('secondary', settings.getColor255('themecolorsecondary'));
  if (has('backgroundcolor')) updateColor('background', settings.getColor255('backgroundcolor'));

  if (has('linethickness')) {
    state.lineThickness = settings.getNumber('linethickness');
    document.documentElement.style.setProperty('--line', `${state.lineThickness}px`);
    stateStore.markDirty(['hudStatic', 'text']);
  }
  if (has('gridenabled')) {
    state.gridEnabled = settings.getBool('gridenabled');
    stateStore.markDirty('hudStatic');
  }
  if (has('griddensity')) {
    state.gridDensity = settings.getNumber('griddensity');
    updateHudLayout();
  }

  if (has('audiosensitivity')) audioEngine.updateSettings({ sensitivity: settings.getNumber('audiosensitivity') });
  if (has('audiosmoothing')) audioEngine.updateSettings({ smoothing: settings.getNumber('audiosmoothing') });
  if (has('barscount')) audioEngine.updateSettings({ barsCount: settings.getNumber('barscount') });
  if (has('waveformenabled')) audioEngine.updateSettings({ waveformEnabled: settings.getBool('waveformenabled') });
  if (has('waveformheight')) audioEngine.updateSettings({ waveformHeight: settings.getNumber('waveformheight') });
  if (has('backgroundequalizeralpha')) {
    state.bgEQAlphaBase = settings.getNumber('backgroundequalizeralpha');
    const preset = VISUAL_PROFILES[state.activeProfile] || VISUAL_PROFILES.ENGINEERING;
    state.bgEQAlpha = state.bgEQAlphaBase * preset.bgEQAlpha;
    document.documentElement.style.setProperty('--bg-eq-alpha', `${state.bgEQAlpha}`);
  }

  if (has('nowplayingenabled')) {
    panelNowPlayingEl.style.display = settings.getBool('nowplayingenabled') ? 'block' : 'none';
  }
  if (has('nowplayingcoversize')) {
    const size = clamp(settings.getNumber('nowplayingcoversize'), 24, 160);
    document.documentElement.style.setProperty('--now-playing-cover-size', `${size}px`);
    const coverEl = document.querySelector('.now-playing-cover');
    if (coverEl) {
      coverEl.style.width = `${size}px`;
      coverEl.style.height = `${size}px`;
    }
  }
  if (has('layoutpreset')) setLayout(settings.getString('layoutpreset'));

  if (has('hwpollintervalsec')) {
    scheduler.setInterval('perf', settings.getNumber('hwpollintervalsec') * 1000);
  }
  if (has('hwmonitorurl')) {
    const url = settings.getString('hwmonitorurl');
    if (url) perfService.setUrl(url);
  }

  if (has('weatherenabled')) {
    const enabled = settings.getBool('weatherenabled');
    state.weatherEnabled = enabled;
    panelWeatherEl.style.display = enabled ? 'block' : 'none';
    scheduler.setEnabled('weather', enabled);
    if (enabled) schedulerTasks.weather.nextAt = performance.now();
  }
  if (hasAny('weatherprovider', 'weatherapikey', 'weatherlat', 'weatherlon', 'units')) {
    const opts = {
      provider: settings.getString('weatherprovider') || weatherService.options.provider,
      apiKey: settings.getString('weatherapikey') || weatherService.options.apiKey,
      units: settings.getString('units') || weatherService.options.units,
      lat: settings.getNumber('weatherlat'),
      lon: settings.getNumber('weatherlon'),
    };
    if (opts.units) state.units = opts.units;
    weatherService.setOptions(opts);
    scheduler.setInterval('weather', weatherService.options.refreshMinutes * 60 * 1000);
    if (state.weatherEnabled) schedulerTasks.weather.nextAt = performance.now();
  }

  if (has('language')) {
    const locale = settings.getString('language');
    if (locale) setLanguage(locale);
  }
  if (has('textscale')) setTextScale(settings.getNumber('textscale'));

  if (has('semantictextenabled')) {
    state.semanticText.enabled = settings.getBool('semantictextenabled');
    semanticEngine.setConfig({ enabled: state.semanticText.enabled });
    if (!state.semanticText.enabled) resetSystemText();
  }
  if (has('semantictextfrequency')) {
    state.semanticText.frequency = settings.getNumber('semantictextfrequency');
    semanticEngine.setConfig({ frequency: state.semanticText.frequency });
  }
  if (has('semantictextverbosity')) {
    state.semanticText.verbosity = clamp(settings.getNumber('semantictextverbosity'), 0.4, 1.4);
    semanticEngine.setConfig({ verbosity: state.semanticText.verbosity });
  }
  if (has('semantictextsarcasm')) {
    state.semanticText.sarcasm = clamp(settings.getNumber('semantictextsarcasm'), 0, 1);
    semanticEngine.setConfig({ sarcasm: state.semanticText.sarcasm });
  }
  if (has('semantictextdegradationstrength')) {
    state.semanticText.degradationStrength = clamp(settings.getNumber('semantictextdegradationstrength'), 0, 1);
    semanticEngine.setConfig({ degradationStrength: state.semanticText.degradationStrength });
  }
  if (has('semantictextlanguageprofile')) {
    state.semanticText.languageProfile = settings.getString('semantictextlanguageprofile');
    semanticEngine.setConfig({ languageProfile: state.semanticText.languageProfile });
  }
  if (has('semantictextidlemode')) {
    state.semanticText.idleMode = settings.getBool('semantictextidlemode');
    semanticEngine.setConfig({ idleMode: state.semanticText.idleMode });
  }
  if (has('textmodestrategy')) {
    state.semanticText.textModeStrategy = settings.getString('textmodestrategy');
    semanticEngine.setConfig({ textModeStrategy: state.semanticText.textModeStrategy });
  }
  if (has('smartcandidatecount')) {
    state.semanticText.smartCandidateCount = clamp(settings.getNumber('smartcandidatecount'), 10, 80);
    semanticEngine.setConfig({ smartCandidateCount: state.semanticText.smartCandidateCount });
  }
  if (has('degradationsensitivity')) {
    state.semanticText.degradationSensitivity = clamp(settings.getNumber('degradationsensitivity'), 0.5, 2);
    semanticEngine.setConfig({ degradationSensitivity: state.semanticText.degradationSensitivity });
  }
  if (has('robotmodethreshold')) {
    state.semanticText.robotModeThreshold = clamp(settings.getNumber('robotmodethreshold'), 0.5, 2);
    semanticEngine.setConfig({ robotModeThreshold: state.semanticText.robotModeThreshold });
  }
  if (has('apologyenabled')) {
    state.semanticText.apologyEnabled = settings.getBool('apologyenabled');
    semanticEngine.setConfig({ apologyEnabled: state.semanticText.apologyEnabled });
  }
  if (has('preemptivewarnings')) {
    state.semanticText.preemptiveWarnings = settings.getBool('preemptivewarnings');
    semanticEngine.setConfig({ preemptiveWarnings: state.semanticText.preemptiveWarnings });
  }
  if (has('whiningintensity')) {
    state.semanticText.whiningIntensity = clamp(settings.getNumber('whiningintensity'), 0, 2);
    semanticEngine.setConfig({ whiningIntensity: state.semanticText.whiningIntensity });
  }
  if (has('debugtextai')) {
    state.semanticText.debugTextAI = settings.getBool('debugtextai');
    semanticEngine.setConfig({ debugTextAI: state.semanticText.debugTextAI });
    updateDiagnosticsMode();
  }

  if (has('moodreactivetext')) {
    state.mood.reactiveText = settings.getBool('moodreactivetext');
    semanticEngine.setConfig({ moodReactiveText: state.mood.reactiveText });
  }
  if (has('moodreactivevisuals')) {
    state.mood.reactiveVisuals = settings.getBool('moodreactivevisuals');
  }
  if (has('moodaggressiveness')) {
    state.mood.aggressiveness = clamp(settings.getNumber('moodaggressiveness'), 0.5, 2);
  }
  if (has('mooddebug')) {
    state.mood.debug = settings.getBool('mooddebug');
    updateDiagnosticsMode();
  }

  if (has('logenabled')) {
    state.log.enabled = settings.getBool('logenabled');
    stateStore.markDirty('text');
  }
  if (has('logmaxentries')) {
    state.log.maxEntries = clamp(settings.getNumber('logmaxentries'), 50, 500);
    logBuffer.setMaxEntries(state.log.maxEntries);
    stateStore.markDirty('text');
  }
  if (has('logshowtimestamp')) {
    state.log.showTimestamp = settings.getBool('logshowtimestamp');
    logRenderer.setConfig({ showTimestamp: state.log.showTimestamp });
    stateStore.markDirty('text');
  }
  if (has('logfontscale')) {
    state.log.fontScale = clamp(settings.getNumber('logfontscale'), 0.8, 1.6);
    logRenderer.setConfig({ fontScale: state.log.fontScale });
    stateStore.markDirty('text');
  }
  if (has('logpersistbetweensessions')) {
    state.log.persist = settings.getBool('logpersistbetweensessions');
    logBuffer.setPersist(state.log.persist);
    if (state.log.persist) logBuffer.setStorageKey(getLogStorageKey(state.language));
  }
  if (has('visualprofile')) applyVisualProfile(settings.getString('visualprofile'));
  if (has('entropylevel')) {
    state.entropyLevel = clamp(settings.getNumber('entropylevel'), 0, 1);
    entropyController.setBase(state.entropyLevel);
  }
  if (has('behaviormemoryenabled')) {
    state.behaviorMemoryEnabled = settings.getBool('behaviormemoryenabled');
    behaviorMemory.setEnabled(state.behaviorMemoryEnabled);
  }
  if (has('narrativeeventsenabled')) {
    state.narrativeEventsEnabled = settings.getBool('narrativeeventsenabled');
    narrativeEngine.setEnabled(state.narrativeEventsEnabled);
  }
  if (has('degradationenabled')) {
    state.degradationEnabled = settings.getBool('degradationenabled');
    coreStateMachine.setOptions({ degradationEnabled: state.degradationEnabled });
  }
  if (has('timeofdayadaptive')) {
    state.timeOfDayAdaptive = settings.getBool('timeofdayadaptive');
    entropyController.setTimeAdaptive(state.timeOfDayAdaptive);
    coreStateMachine.setOptions({ timeOfDayAdaptive: state.timeOfDayAdaptive });
  }

  if (has('glitchesenabled')) {
    state.glitchConfig.glitchesEnabled = settings.getBool('glitchesenabled');
    glitchSystem.setConfig({ glitchesEnabled: state.glitchConfig.glitchesEnabled });
  }
  if (has('glitchintervalminsec')) {
    state.glitchConfig.glitchIntervalMinSec = settings.getNumber('glitchintervalminsec');
    glitchSystem.setConfig({ glitchIntervalMinSec: state.glitchConfig.glitchIntervalMinSec });
  }
  if (has('glitchintervalmaxsec')) {
    state.glitchConfig.glitchIntervalMaxSec = settings.getNumber('glitchintervalmaxsec');
    glitchSystem.setConfig({ glitchIntervalMaxSec: state.glitchConfig.glitchIntervalMaxSec });
  }
  if (has('glitchintensity')) {
    state.glitchConfig.glitchIntensity = clamp(settings.getNumber('glitchintensity'), 0.2, 2);
    glitchSystem.setConfig({ glitchIntensity: state.glitchConfig.glitchIntensity });
  }
  if (has('musicreactiveglitches')) {
    state.glitchConfig.musicReactiveGlitches = settings.getBool('musicreactiveglitches');
    glitchSystem.setConfig({ musicReactiveGlitches: state.glitchConfig.musicReactiveGlitches });
  }
  if (has('localglitchesenabled')) {
    state.glitchConfig.localGlitchesEnabled = settings.getBool('localglitchesenabled');
    glitchSystem.setConfig({ localGlitchesEnabled: state.glitchConfig.localGlitchesEnabled });
  }
  if (has('localglitchintensityboost')) {
    state.glitchConfig.localGlitchIntensityBoost = clamp(settings.getNumber('localglitchintensityboost'), 0, 2);
    glitchSystem.setConfig({ localGlitchIntensityBoost: state.glitchConfig.localGlitchIntensityBoost });
  }
  if (has('localglitchfrequencyboost')) {
    state.glitchConfig.localGlitchFrequencyBoost = clamp(settings.getNumber('localglitchfrequencyboost'), 0, 2);
    glitchSystem.setConfig({ localGlitchFrequencyBoost: state.glitchConfig.localGlitchFrequencyBoost });
  }
  if (has('allowtwoblockglitches')) {
    state.glitchConfig.allowTwoBlockGlitches = settings.getBool('allowtwoblockglitches');
    glitchSystem.setConfig({ allowTwoBlockGlitches: state.glitchConfig.allowTwoBlockGlitches });
  }
  if (has('electriceffectsenabled')) {
    state.glitchConfig.electricEffectsEnabled = settings.getBool('electriceffectsenabled');
    glitchSystem.setConfig({ electricEffectsEnabled: state.glitchConfig.electricEffectsEnabled });
  }
  if (has('electricintensity')) {
    state.glitchConfig.electricIntensity = clamp(settings.getNumber('electricintensity'), 0.5, 2);
    glitchSystem.setConfig({ electricIntensity: state.glitchConfig.electricIntensity });
  }
  if (has('electricarccooldown')) {
    state.glitchConfig.electricArcCooldown = clamp(settings.getNumber('electricarccooldown'), 5, 60);
    glitchSystem.setConfig({ electricArcCooldown: state.glitchConfig.electricArcCooldown });
  }
  if (has('electricladderspeed')) {
    state.glitchConfig.electricLadderSpeed = clamp(settings.getNumber('electricladderspeed'), 0.5, 2);
    glitchSystem.setConfig({ electricLadderSpeed: state.glitchConfig.electricLadderSpeed });
  }
  if (has('electricaudioreactive')) {
    state.glitchConfig.electricAudioReactive = settings.getBool('electricaudioreactive');
    glitchSystem.setConfig({ electricAudioReactive: state.glitchConfig.electricAudioReactive });
  }
  if (has('maxsimultaneousglitches')) {
    state.glitchConfig.maxSimultaneousGlitches = settings.getNumber('maxsimultaneousglitches');
    glitchSystem.setConfig({ maxSimultaneousGlitches: state.glitchConfig.maxSimultaneousGlitches });
  }
  if (has('allowscreenwideeffects')) {
    state.glitchConfig.allowScreenWideEffects = settings.getBool('allowscreenwideeffects');
    glitchSystem.setConfig({ allowScreenWideEffects: state.glitchConfig.allowScreenWideEffects });
  }
  if (has('bigeventchance')) {
    state.glitchConfig.bigEventChance = clamp(settings.getNumber('bigeventchance'), 0, 1);
    glitchSystem.setConfig({ bigEventChance: state.glitchConfig.bigEventChance });
  }
  if (has('chromaticaberrationenabled')) {
    state.glitchConfig.chromaticAberrationEnabled = settings.getBool('chromaticaberrationenabled');
    glitchSystem.setConfig({ chromaticAberrationEnabled: state.glitchConfig.chromaticAberrationEnabled });
  }
  if (has('alienalphabetstrength')) {
    const value = clamp(settings.getNumber('alienalphabetstrength'), 0, 2);
    state.glitchConfig.alienAlphabetStrength = value;
    state.semanticText.alienAlphabetStrength = value;
    glitchSystem.setConfig({ alienAlphabetStrength: state.glitchConfig.alienAlphabetStrength });
    semanticEngine.setConfig({ alienAlphabetStrength: state.semanticText.alienAlphabetStrength });
  }
  if (has('aliensymbolset')) {
    const value = settings.getString('aliensymbolset');
    if (value) {
      state.glitchConfig.alienSymbolSet = value;
      glitchSystem.setConfig({ alienSymbolSet: state.glitchConfig.alienSymbolSet });
      interactionFX.setConfig({ symbolSet: state.glitchConfig.alienSymbolSet });
    }
  }
  if (has('debugglitchoverlay')) {
    state.glitchConfig.debugGlitchOverlay = settings.getBool('debugglitchoverlay');
    glitchSystem.setConfig({ debugGlitchOverlay: state.glitchConfig.debugGlitchOverlay });
    updateDiagnosticsMode();
  }

  if (has('interactivityenabled')) {
    state.interactivity.interactivityEnabled = settings.getBool('interactivityenabled');
    interactionFX.setConfig({ interactivityEnabled: state.interactivity.interactivityEnabled });
  }
  if (has('hovereffectsenabled')) {
    state.interactivity.hoverEffectsEnabled = settings.getBool('hovereffectsenabled');
    interactionFX.setConfig({ hoverEffectsEnabled: state.interactivity.hoverEffectsEnabled });
  }
  if (has('clickeffectsenabled')) {
    state.interactivity.clickEffectsEnabled = settings.getBool('clickeffectsenabled');
    interactionFX.setConfig({ clickEffectsEnabled: state.interactivity.clickEffectsEnabled });
  }
  if (has('cursortrailenabled')) {
    state.interactivity.cursorTrailEnabled = settings.getBool('cursortrailenabled');
    interactionFX.setConfig({ cursorTrailEnabled: state.interactivity.cursorTrailEnabled });
  }
  if (has('parallaxenabled')) {
    state.interactivity.parallaxEnabled = settings.getBool('parallaxenabled');
    interactionFX.setConfig({ parallaxEnabled: state.interactivity.parallaxEnabled });
  }
  if (has('interactivecontrolsenabled')) {
    state.interactivity.interactiveControlsEnabled = settings.getBool('interactivecontrolsenabled');
    interactionFX.setConfig({ interactiveControlsEnabled: state.interactivity.interactiveControlsEnabled });
  }
  if (has('hiddengesturesenabled')) {
    state.hiddenGesturesEnabled = settings.getBool('hiddengesturesenabled');
    state.interactivity.hiddenGesturesEnabled = state.hiddenGesturesEnabled;
    interactionFX.setConfig({ hiddenGesturesEnabled: state.hiddenGesturesEnabled });
  }
  if (has('idletimeoutsec')) {
    state.interactivity.idleTimeoutSec = settings.getNumber('idletimeoutsec');
    inputManager.options.idleTimeoutSec = state.interactivity.idleTimeoutSec;
  }
  if (has('uiresponsiveness')) {
    state.interactivity.uiResponsiveness = settings.getNumber('uiresponsiveness');
    interactionFX.setConfig({ uiResponsiveness: state.interactivity.uiResponsiveness });
  }
  if (has('tooltipsenabled')) {
    state.interactivity.tooltipsEnabled = settings.getBool('tooltipsenabled');
    interactionFX.setConfig({ tooltipsEnabled: state.interactivity.tooltipsEnabled });
  }
  if (has('diagnosticsenabled')) {
    state.interactivity.diagnosticsEnabled = settings.getBool('diagnosticsenabled');
    updateDiagnosticsMode();
  }
  if (has('perfprofilerenabled')) {
    state.interactivity.perfProfilerEnabled = settings.getBool('perfprofilerenabled');
    updateDiagnosticsMode();
  }
  if (has('thresholdscpuhigh')) state.thresholds.cpuHigh = settings.getNumber('thresholdscpuhigh');
  if (has('thresholdsgpuhigh')) state.thresholds.gpuHigh = settings.getNumber('thresholdsgpuhigh');
  if (has('thresholdsnethigh')) state.thresholds.netHigh = settings.getNumber('thresholdsnethigh');
  if (hasAny('thresholdscpuhigh', 'thresholdsgpuhigh', 'thresholdsnethigh')) {
    microAnimations.updateThresholds(state.thresholds);
  }

  if (has('externalipenabled')) {
    state.externalIpEnabled = settings.getBool('externalipenabled');
    scheduler.setEnabled('ip', state.externalIpEnabled);
    if (state.externalIpEnabled) schedulerTasks.ip.nextAt = performance.now();
    updateExternalIpUI(state.cache.ip, !state.externalIpEnabled);
  }

  if (has('showseconds')) {
    state.showSeconds = settings.getBool('showseconds');
    setupClockTimer();
  }
}

installWallpaperPropertyListener(applySettingsToSubsystems);

function updateHudLayout() {
  if (!dimensions) return;
  const layout = computeHudLayout(dimensions, state.gridDensity);
  if (!layout) return;
  state.hudLayout = layout;
  applyHudCssVars(layout);
  stateStore.markDirty(['layout', 'hudStatic', 'text']);
  updateBlockRegistry();
}

function updateBlockRegistry() {
  if (!state.hudLayout || !dimensions) return;
  const strings = getStrings();
  const rects = {
    calendar: getElementRect(calendarEl),
    systemText: getElementRect(systemTextPanelEl),
  };
  const registry = computeBlockRegistry(state.hudLayout, rects, strings);
  blocks = registry.blocks;
  blockLabels = registry.blockLabels;
  textTargets = registry.textTargets;
  stateStore.markDirty('text');

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
  stateStore.markDirty(['hudStatic', 'text']);
  if (glitchSystem && (key === 'primary' || key === 'secondary')) {
    state.glitchConfig.themePrimary = state.colors.primary;
    state.glitchConfig.themeSecondary = state.colors.secondary;
    glitchSystem.setConfig({
      themePrimary: state.colors.primary,
      themeSecondary: state.colors.secondary,
    });
  }
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
  stateStore.markDirty('text');
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
  stateStore.markDirty('text');
}

function setLayout(layout) {
  state.layoutPreset = layout;
  overlay.classList.remove('layout-left', 'layout-right', 'layout-top');
  if (layout === 'Left HUD') overlay.classList.add('layout-left');
  else if (layout === 'Right HUD') overlay.classList.add('layout-right');
  else overlay.classList.add('layout-top');
}

init();






