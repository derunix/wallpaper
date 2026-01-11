# Neon Circuit HUD (Wallpaper Engine)

Audio-reactive neon HUD wallpaper for Wallpaper Engine. Web-based (HTML/CSS/JS) with a Canvas2D UI, system telemetry, and a reactive internal log.

## Features
- Now Playing panel with track title and artist
- Internal log with semantic text generation and glitch-aware language
- Weather panel (Open-Meteo or OpenWeather)
- System metrics (CPU/GPU/RAM/VRAM, network, disks) via local endpoint
- Glitch system with local + global effects and audio reactivity
- Configurable colors, layout, and behavior in Wallpaper Engine properties

## Requirements
- Wallpaper Engine (Windows)
- Network access for weather and now playing (if enabled)
- Optional local performance endpoint at `http://127.0.0.1:5000/performance`

## Install in Wallpaper Engine
1. Clone the repository.
2. In Wallpaper Engine: open `project.json` (or the project folder) as a Web wallpaper.
3. Adjust properties in the Wallpaper Engine UI as needed.

## Local preview
You can open `index.html` in a browser, but Wallpaper Engine APIs (now playing, audio, and some interactions) will not be available.

## Performance endpoint
The HUD polls `http://127.0.0.1:5000/performance` for JSON data. If the endpoint is not available, metrics fall back to last known values.

Example payload (fields used by the HUD):
```json
{
  "psutil": {
    "cpu": 32,
    "cpu_temp": 61,
    "cpu_percore": [12, 25, 43, 9],
    "gpu_usage": 18,
    "gpu_temp": 45,
    "memory": 54,
    "memory_gb": "9.2/16",
    "vram_usage": 22,
    "vram_gb": "2.1/8",
    "download_speed": 102400,
    "upload_speed": 20480,
    "c_disk": "112/476",
    "d_disk": "88/931"
  }
}
```

## Notes
- `project.json` references `lg.jpg` as the preview image. Add that file if you plan to publish to the Workshop.
