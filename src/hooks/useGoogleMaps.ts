import { useEffect, useState } from 'react';

export type MapsStatus = 'loading' | 'ready' | 'no-key' | 'error';

/**
 * Shared across all callers so concurrent mounts inject exactly one script tag.
 */
let loaderPromise: Promise<typeof google.maps> | null = null;

function loadMaps(): Promise<typeof google.maps> {
  if (loaderPromise) return loaderPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error('NO_API_KEY'));

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${key}` +
      `&libraries=places,marker,geometry&loading=async&v=weekly`;
    script.async = true;
    script.onload = () => resolve(google.maps);
    script.onerror = () => {
      loaderPromise = null; // allow a retry on the next mount
      reject(new Error('MAPS_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

const hasKey = (): boolean => Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

/**
 * Loads the Maps SDK on demand — never in the initial bundle.
 *
 * A missing key is a first-class degraded state, not an error: 'no-key' lets
 * the UI explain itself instead of showing a blank grey box. The rest of the
 * app (list, detail, itineraries, distances) works without it.
 */
export function useGoogleMaps() {
  // Seeded from the key so the effect never has to set state synchronously.
  const [status, setStatus] = useState<MapsStatus>(() => (hasKey() ? 'loading' : 'no-key'));

  useEffect(() => {
    if (!hasKey()) return;

    let cancelled = false;

    loadMaps()
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus(err.message === 'NO_API_KEY' ? 'no-key' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    status,
    maps: status === 'ready' ? google.maps : null,
    mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID,
  };
}
