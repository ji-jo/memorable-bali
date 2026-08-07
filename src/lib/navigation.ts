import type { Coordinates } from '@/data/types';

/** Google Maps Directions deep link — origin stay → destination spot. */
export function googleDirectionsUrl(
  origin: Coordinates,
  destination: Coordinates,
  travelMode: 'driving' | 'walking' | 'transit' | 'bicycling' = 'driving',
): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: travelMode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Open a single place in Google Maps (existing place URLs still preferred when present). */
export function googleMapsPlaceUrl(destination: Coordinates, label?: string): string {
  const query = label
    ? `${label}/@${destination.lat},${destination.lng},15z`
    : `${destination.lat},${destination.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export interface RoutePath {
  coordinates: Coordinates[];
  distanceKm: number;
  durationMin: number;
}

/**
 * Driving path via public OSRM — preview only, not a turn-by-turn product.
 * Falls back to null on network/routing failure so the UI can still deep-link.
 */
export async function fetchDrivingRoute(
  origin: Coordinates,
  destination: Coordinates,
  signal?: AbortSignal,
): Promise<RoutePath | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates: [number, number][] };
      }>;
    };
    const route = data.routes?.[0];
    const line = route?.geometry?.coordinates;
    if (!route || !line?.length) return null;

    return {
      coordinates: line.map(([lng, lat]) => ({ lat, lng })),
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
}

export interface GeocodeHit {
  label: string;
  coordinates: Coordinates;
}

/** Nominatim search biased to Bali — free geocode for hotel/home setup. */
export async function searchBaliPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    q: `${trimmed}, Bali, Indonesia`,
    format: 'json',
    limit: '6',
    addressdetails: '0',
    viewbox: '114.4,-8.0,115.8,-9.2',
    bounded: '1',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return [];

  const rows = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return rows.map((row) => ({
    label: row.display_name.split(',').slice(0, 3).join(',').trim(),
    coordinates: { lat: Number(row.lat), lng: Number(row.lon) },
  }));
}
