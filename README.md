# Felt

Most weather apps show forecasts as a forward-only list of numbers. "70°F tomorrow"
doesn't mean much in isolation — your sense of warm or cold is set by the days you
just lived through.

**Felt anchors the forecast in recent observations.** It plots the past 3 days of
hourly temperatures and the next 5 days of forecast on a single continuous chart,
with "now" marked clearly in the middle. Past hours are drawn in a muted gray-blue;
the forecast is drawn in a brighter, warmer color. You glance at tomorrow's curve
and your body already knows what those numbers feel like.

This is a tiny PWA — no framework, no tracking, no API key.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default `http://localhost:5173`) and grant location
access when prompted.

## Build

```bash
npm run build
npm run preview   # serve the production bundle
```

The built site is in `dist/` and is fully static — drop it on any host.

## How it works

- **Geolocation** comes from `navigator.geolocation`. Felt asks once on load and
  surfaces a clear retry path on denial or failure.
- **Weather data** comes from [Open-Meteo](https://open-meteo.com/), which is free
  and key-less. The endpoint returns hourly temperatures for `past_days=3` (model
  reanalysis) and `forecast_days=5`, in Fahrenheit, in the location's local time
  zone.
- **Charting** uses [uPlot](https://github.com/leeoniya/uPlot). Two series share
  the boundary point at "now" so the past and forecast lines connect visually.
- **PWA** is wired via `vite-plugin-pwa`. The service worker network-firsts
  Open-Meteo with a 1-hour cache, so a hand-held viewport offline still shows
  the last forecast. Installable on Android, iOS, and desktop Chromium.

## What's deliberately not here (yet)

Feels-like, daily highs/lows, multiple locations, manual location entry, °C
toggle, precipitation, wind, settings page. v1 is intentionally one chart, one
location, one purpose.

## Regenerating icons

The PWA icons in `public/icons/` are generated procedurally:

```bash
npm run icons
```

Edit `tools/gen-icons.mjs` to change colors, sizes, or the glyph.

## License

[MIT](./LICENSE) © tokedo, 2026.
