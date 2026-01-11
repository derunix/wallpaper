// Now Playing integration with Wallpaper Engine APIs when available.

const fallbackState = {
  title: 'No track data',
  artist: '',
  album: '',
  playbackState: 'stopped',
  durationSec: null,
  positionSec: null,
  isPlaying: false,
  hasData: false,
};

export class NowPlayingService {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.state = { ...fallbackState };
    this.poller = null;
    this._init();
  }

  _init() {
    let hasListener = false;
    const updateAndPush = data => {
      const next = { ...this.state };
      const prevTitle = this.state.title;
      const prevArtist = this.state.artist;
      if (data.title !== undefined) next.title = data.title || fallbackState.title;
      if (data.artist !== undefined) next.artist = data.artist || '';
      const trackChanged =
        (data.title !== undefined && next.title !== prevTitle) ||
        (data.artist !== undefined && next.artist !== prevArtist);
      if (data.album !== undefined) next.album = data.album || '';
      if (data.playbackState) next.playbackState = data.playbackState;
      if (data.durationSec !== undefined) next.durationSec = data.durationSec;
      if (data.positionSec !== undefined) next.positionSec = data.positionSec;
      next.isPlaying = next.playbackState === 'playing';
      const hasPayload = !!(data.title || data.artist || data.album);
      next.hasData = hasPayload || next.hasData;
      this.state = next;
      this.onUpdate?.(this.state);
    };

    if (window.wallpaperRegisterMediaInformationListener) {
      window.wallpaperRegisterMediaInformationListener(info => {
        updateAndPush({
          title: info?.title || fallbackState.title,
          artist: info?.artist || info?.albumArtist || '',
          album: info?.albumTitle || info?.albumName || info?.album || '',
          playbackState: resolvePlaybackState(info),
          durationSec: normalizeSeconds(info?.duration ?? info?.durationSec ?? info?.length ?? info?.trackLength),
          positionSec: normalizeSeconds(info?.position ?? info?.positionSec ?? info?.elapsed ?? info?.trackPosition),
        });
      });
      hasListener = true;
    }

    if (window.wallpaperRegisterSongInfoListener) {
      window.wallpaperRegisterSongInfoListener((title, artist) => {
        updateAndPush({ title: title || fallbackState.title, artist: artist || '' });
      });
      hasListener = true;
    }

    if (window.wallpaperRegisterMediaPropertiesListener) {
      window.wallpaperRegisterMediaPropertiesListener(props => {
        updateAndPush({
          title: props?.title || fallbackState.title,
          artist: props?.artist || props?.albumArtist || '',
          album: props?.albumTitle || props?.albumName || props?.album || '',
          playbackState: resolvePlaybackState(props),
          durationSec: normalizeSeconds(props?.duration ?? props?.durationSec ?? props?.length ?? props?.trackLength),
          positionSec: normalizeSeconds(props?.position ?? props?.positionSec ?? props?.elapsed ?? props?.trackPosition),
        });
      });
      hasListener = true;
    }

    if (window.wallpaperRegisterMediaPlaybackStateListener) {
      window.wallpaperRegisterMediaPlaybackStateListener(state => {
        updateAndPush({ playbackState: resolvePlaybackState({ state }) });
      });
      hasListener = true;
    }

    if (
      window.wallpaperRequestMediaProperties ||
      window.wallpaperRequestSongInfo ||
      window.wallpaperRequestMediaPlaybackState
    ) {
      const request = () => {
        window.wallpaperRequestMediaProperties?.();
        window.wallpaperRequestSongInfo?.();
        window.wallpaperRequestMediaPlaybackState?.();
      };
      request();
      this.poller = setInterval(request, 1500);
    }

    // No API available, set fallback once.
    if (!hasListener) this.onUpdate?.(this.state);
  }

  getState() {
    return this.state;
  }
}

function resolvePlaybackState(info) {
  if (!info) return 'stopped';
  if (info.isPaused === true) return 'paused';
  if (info.isPaused === false) return 'playing';
  const raw = info.state ?? info.playbackState ?? info.playback_status ?? info.status;
  if (raw === undefined || raw === null) return 'stopped';
  if (typeof raw === 'string') {
    const v = raw.toLowerCase();
    if (v.includes('pause')) return 'paused';
    if (v.includes('play')) return 'playing';
    if (v.includes('stop')) return 'stopped';
  }
  if (typeof raw === 'number') {
    if (raw === 1) return 'playing';
    if (raw === 2) return 'paused';
    if (raw === 0) return 'stopped';
  }
  return 'stopped';
}

function normalizeSeconds(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return null;
  if (text.includes(':')) {
    const parts = text.split(':').map(Number).filter(n => Number.isFinite(n));
    if (!parts.length) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}
