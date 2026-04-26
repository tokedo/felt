export interface Coords {
  lat: number;
  lon: number;
}

export type LocationErrorKind = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class LocationError extends Error {
  readonly kind: LocationErrorKind;
  constructor(kind: LocationErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'LocationError';
  }
}

export function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationError('unsupported', 'Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new LocationError('denied', 'Location permission was denied.'));
            return;
          case err.POSITION_UNAVAILABLE:
            reject(new LocationError('unavailable', 'Your location is currently unavailable.'));
            return;
          case err.TIMEOUT:
            reject(new LocationError('timeout', 'Locating you took too long.'));
            return;
          default:
            reject(new LocationError('unavailable', err.message || 'Could not determine location.'));
        }
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

export function formatCoords({ lat, lon }: Coords): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}
