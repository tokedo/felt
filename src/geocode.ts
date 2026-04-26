import type { Coords } from './location.js';

export interface GeocodeResult {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

const ENDPOINT = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const CACHE_PREFIX = 'felt:geocode:';

/**
 * Reverse-geocode coordinates to a place. Returns null on any failure
 * (network, rate limit, parse) — callers should fall back to coords.
 *
 * Results are cached in localStorage keyed by coords rounded to 3 decimal
 * places (~100 m), so revisits from the same place skip the network.
 */
export async function reverseGeocode(
  coords: Coords,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  const key = cacheKey(coords);

  const cached = readCache(key);
  if (cached) return cached;

  const url = new URL(ENDPOINT);
  url.searchParams.set('latitude', coords.lat.toFixed(4));
  url.searchParams.set('longitude', coords.lon.toFixed(4));
  url.searchParams.set('localityLanguage', 'en');

  try {
    const res = await fetch(url.toString(), { signal: signal ?? null });
    if (!res.ok) return null;
    const body = (await res.json()) as GeocodeResult;
    writeCache(key, body);
    return body;
  } catch {
    return null;
  }
}

/**
 * Pick a display string per spec:
 *   - "City, Region" if both `city` and `principalSubdivision` exist;
 *   - else first non-empty in [city, locality, principalSubdivision, countryName];
 *   - else null.
 */
export function formatPlace(g: GeocodeResult): string | null {
  if (g.city && g.principalSubdivision && g.city !== g.principalSubdivision) {
    return `${g.city}, ${g.principalSubdivision}`;
  }
  return g.city || g.locality || g.principalSubdivision || g.countryName || null;
}

function cacheKey({ lat, lon }: Coords): string {
  return `${CACHE_PREFIX}${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function readCache(key: string): GeocodeResult | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as GeocodeResult;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: GeocodeResult): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode / quota — ignore
  }
}
