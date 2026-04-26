import type { Coords } from './location.js';

export interface Forecast {
  /** Unix seconds for each hourly sample. */
  times: number[];
  /** Temperature in °F, aligned with `times`. */
  temps: number[];
  /** IANA timezone returned by Open-Meteo (e.g. "America/Los_Angeles"). */
  timezone: string;
}

export class ForecastError extends Error {
  readonly reason?: unknown;
  constructor(message: string, reason?: unknown) {
    super(message);
    this.name = 'ForecastError';
    if (reason !== undefined) this.reason = reason;
  }
}

interface OpenMeteoResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
  };
  timezone?: string;
  reason?: string;
  error?: boolean;
}

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export async function fetchForecast({ lat, lon }: Coords, signal?: AbortSignal): Promise<Forecast> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('latitude', lat.toFixed(4));
  url.searchParams.set('longitude', lon.toFixed(4));
  url.searchParams.set('hourly', 'temperature_2m');
  url.searchParams.set('past_days', '3');
  url.searchParams.set('forecast_days', '5');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('timezone', 'auto');

  let res: Response;
  try {
    res = await fetch(url.toString(), { signal: signal ?? null });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw err;
    throw new ForecastError('Network error while fetching weather.', err);
  }

  if (!res.ok) {
    throw new ForecastError(`Weather service returned ${res.status}.`);
  }

  let body: OpenMeteoResponse;
  try {
    body = (await res.json()) as OpenMeteoResponse;
  } catch (err) {
    throw new ForecastError('Weather service returned an invalid response.', err);
  }

  if (body.error) {
    throw new ForecastError(body.reason ?? 'Weather service reported an error.');
  }

  const rawTimes = body.hourly?.time;
  const rawTemps = body.hourly?.temperature_2m;
  const timezone = body.timezone;

  if (!rawTimes || !rawTemps || !timezone || rawTimes.length === 0 || rawTimes.length !== rawTemps.length) {
    throw new ForecastError('Weather service returned incomplete data.');
  }

  // Open-Meteo returns local-time ISO strings (no timezone suffix) when timezone=auto.
  // Convert them to absolute unix seconds using the returned IANA zone.
  const times = rawTimes.map((iso) => localIsoToUnixSeconds(iso, timezone));
  const temps = rawTemps.slice();

  return { times, temps, timezone };
}

/**
 * Convert an Open-Meteo hourly timestamp like "2026-04-26T14:00" interpreted
 * in the given IANA zone into absolute unix seconds.
 *
 * Why: when timezone=auto, Open-Meteo strips the offset and returns wall-clock
 * times in the location's zone. Parsing them with `new Date()` would incorrectly
 * treat them as the viewer's local time.
 */
function localIsoToUnixSeconds(localIso: string, timeZone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localIso);
  if (!m) throw new ForecastError(`Unrecognized timestamp from API: ${localIso}`);
  const [, y, mo, d, h, mi] = m as unknown as [string, string, string, string, string, string];

  // Treat the wall-clock components as if they were UTC, then correct by the
  // zone's offset at that instant. Two passes handle DST boundaries correctly.
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, 0);
  const offset1 = zoneOffsetMs(guess, timeZone);
  const refined = guess - offset1;
  const offset2 = zoneOffsetMs(refined, timeZone);
  return Math.round((guess - offset2) / 1000);
}

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  // Format the UTC instant in the target zone, then re-parse as if UTC; the
  // difference is the zone's offset (positive east of UTC).
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const y = +get('year');
  const mo = +get('month');
  const d = +get('day');
  let h = +get('hour');
  if (h === 24) h = 0; // some runtimes report 24 instead of 0
  const mi = +get('minute');
  const s = +get('second');
  return Date.UTC(y, mo - 1, d, h, mi, s) - utcMs;
}
