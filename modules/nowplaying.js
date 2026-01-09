// Now Playing integration with Wallpaper Engine APIs when available.

const fallbackState = {
  title: 'No track data',
  artist: '',
  cover: null,
  playbackState: 'stopped',
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
      if (data.cover !== undefined) next.cover = data.cover || null;
      else if (trackChanged) next.cover = null;
      if (data.playbackState) next.playbackState = data.playbackState;
      const hasPayload = !!(data.title || data.artist || data.cover);
      next.hasData = hasPayload || next.hasData;
      this.state = next;
      this.onUpdate?.(this.state);
    };

    if (window.wallpaperRegisterMediaInformationListener) {
      window.wallpaperRegisterMediaInformationListener(info => {
        const cover = info?.cover || info?.thumbnail;
        updateAndPush({
          title: info?.title || fallbackState.title,
          artist: info?.artist || info?.albumArtist || '',
          cover: cover || undefined,
          playbackState: resolvePlaybackState(info),
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
        const cover = props?.thumbnail || props?.cover;
        updateAndPush({
          title: props?.title || fallbackState.title,
          artist: props?.artist || props?.albumArtist || '',
          cover: cover || undefined,
          playbackState: resolvePlaybackState(props),
        });
      });
      hasListener = true;
    }

    if (window.wallpaperRegisterMediaThumbnailListener) {
      window.wallpaperRegisterMediaThumbnailListener(thumb => {
        if (!thumb) return;
        updateAndPush({ cover: thumb });
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
      window.wallpaperRequestMediaThumbnail ||
      window.wallpaperRequestSongInfo ||
      window.wallpaperRequestMediaPlaybackState
    ) {
      const request = () => {
        window.wallpaperRequestMediaProperties?.();
        window.wallpaperRequestMediaThumbnail?.();
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
