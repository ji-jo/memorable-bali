/**
 * Namespaced, versioned localStorage access.
 *
 * Every key is prefixed `bali-explorer:`. Every record carries a version, so a
 * stale record from an earlier build is discarded rather than crashing the app.
 * localStorage throws in Safari private mode and when quota is exceeded, so
 * every read and write is wrapped.
 */

const PREFIX = 'bali-explorer:';
export const STORAGE_VERSION = 1;

interface Envelope<T> {
  __v: number;
  data: T;
}

export const StorageKeys = {
  onboarding: 'onboarding',
  visited: 'visited',
  itineraries: 'itineraries',
  theme: 'theme',
  recentSearches: 'recentSearches',
} as const;

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Envelope<T>;
    if (parsed?.__v !== STORAGE_VERSION) return fallback; // shape changed — discard

    return parsed.data;
  } catch {
    return fallback; // corrupt, or storage unavailable
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    const envelope: Envelope<T> = { __v: STORAGE_VERSION, data: value };
    localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Quota exceeded or storage unavailable. Losing a write is acceptable;
    // crashing the app over it is not.
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* no-op */
  }
}
