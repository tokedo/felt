import './styles.css';

import { fetchForecast, ForecastError } from './api.js';
import { renderChart, type ChartHandle } from './chart.js';
import { formatCoords, getCurrentCoords, LocationError } from './location.js';
import { createUI } from './ui.js';

const ui = createUI();
let chart: ChartHandle | null = null;

async function load(): Promise<void> {
  if (chart) {
    chart.destroy();
    chart = null;
  }
  ui.setLoading('Locating you…');

  let coords;
  try {
    coords = await getCurrentCoords();
  } catch (err) {
    handleLocationError(err);
    return;
  }

  ui.setLocation(formatCoords(coords));
  ui.setLoading(formatCoords(coords));

  let forecast;
  try {
    forecast = await fetchForecast(coords);
  } catch (err) {
    handleForecastError(err);
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const currentTemp = pickCurrentTemp(forecast.times, forecast.temps, nowSec);
  if (currentTemp == null) {
    ui.showError(
      'Forecast data was empty.',
      'The weather service responded but did not include a current temperature.',
      () => void load()
    );
    return;
  }

  const localTime = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: forecast.timezone
  }).format(new Date());

  ui.setLocation(formatCoords(coords));
  ui.setNow(currentTemp, localTime);

  const target = document.getElementById('chart');
  if (!target) throw new Error('Chart container missing.');
  chart = renderChart(target, forecast, nowSec);
}

function handleLocationError(err: unknown): void {
  if (err instanceof LocationError) {
    switch (err.kind) {
      case 'denied':
        ui.showError(
          'Location permission denied.',
          'Felt needs your location to fetch the right forecast. Enable location access in your browser settings, then retry.',
          () => void load()
        );
        return;
      case 'unsupported':
        ui.showError(
          'Geolocation is not supported in this browser.',
          'Try opening Felt in a browser that supports geolocation.'
        );
        return;
      case 'timeout':
        ui.showError(
          'Locating you took too long.',
          'Check your connection or location services and try again.',
          () => void load()
        );
        return;
      case 'unavailable':
      default:
        ui.showError(
          'Could not determine your location.',
          err.message,
          () => void load()
        );
        return;
    }
  }
  ui.showError('Unexpected error while locating you.', String(err), () => void load());
}

function handleForecastError(err: unknown): void {
  if (err instanceof ForecastError) {
    ui.showError('Could not load the forecast.', err.message, () => void load());
    return;
  }
  if ((err as { name?: string }).name === 'AbortError') return;
  ui.showError('Unexpected error while loading the forecast.', String(err), () => void load());
}

function pickCurrentTemp(times: number[], temps: number[], nowSec: number): number | null {
  let best: { dt: number; temp: number } | null = null;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const v = temps[i];
    if (t == null || v == null || !Number.isFinite(v)) continue;
    const dt = Math.abs(t - nowSec);
    if (best == null || dt < best.dt) best = { dt, temp: v };
  }
  return best ? best.temp : null;
}

void load();
