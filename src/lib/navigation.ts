import type { Coordinates } from '@/data/types';
import { BALI_BOUNDS, isWithinBali } from '@/lib/geo';

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

/** LocationIQ / Nominatim viewbox: minLon,maxLat,maxLon,minLat */
const BALI_VIEWBOX = `${BALI_BOUNDS.west},${BALI_BOUNDS.north},${BALI_BOUNDS.east},${BALI_BOUNDS.south}`;

const BALI_ADDRESS_HINTS = [
  'bali',
  'denpasar',
  'badung',
  'gianyar',
  'tabanan',
  'buleleng',
  'karangasem',
  'klungkung',
  'bangli',
  'jembrana',
  'ubud',
  'canggu',
  'seminyak',
  'sanur',
  'kuta',
  'nusa dua',
  'uluwatu',
  'lovina',
  'amed',
  'sidemen',
  'jimbaran',
  'legian',
  'kerobokan',
  'mengwi',
  'tegallalang',
];

function formatHitLabel(displayName: string): string {
  return displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
}

function looksLikeBaliAddress(displayName: string): boolean {
  const lower = displayName.toLowerCase();
  // Exclude common off-island false friends that share street names.
  if (
    lower.includes('lombok') ||
    lower.includes('java') ||
    lower.includes('jakarta') ||
    lower.includes('surabaya') ||
    lower.includes('yogyakarta') ||
    lower.includes('bandung')
  ) {
    return false;
  }
  return BALI_ADDRESS_HINTS.some((hint) => lower.includes(hint));
}

function toBaliHits(
  rows: Array<{ display_name?: string; displayName?: string; lat: string | number; lon: string | number }>,
): GeocodeHit[] {
  const hits: GeocodeHit[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const coordinates = { lat: Number(row.lat), lng: Number(row.lon) };
    if (!Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)) continue;
    if (!isWithinBali(coordinates)) continue;

    const display = row.display_name ?? row.displayName ?? '';
    if (display && !looksLikeBaliAddress(display)) continue;

    const label = formatHitLabel(display || `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`);
    const key = `${label}|${coordinates.lat.toFixed(5)}|${coordinates.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ label, coordinates });
  }

  return hits;
}

function locationIqToken(): string | undefined {
  const token = import.meta.env.VITE_LOCATION_IQ_ACCESS_TOKEN;
  return typeof token === 'string' && token.trim() ? token.trim() : undefined;
}

/** LocationIQ Autocomplete — preferred when VITE_LOCATION_IQ_ACCESS_TOKEN is set. */
async function searchLocationIq(query: string, signal?: AbortSignal): Promise<GeocodeHit[] | null> {
  const key = locationIqToken();
  if (!key) return null;

  const params = new URLSearchParams({
    key,
    q: query,
    limit: '12',
    countrycodes: 'id',
    viewbox: BALI_VIEWBOX,
    bounded: '1',
    normalizeaddress: '1',
    dedupe: '1',
  });

  const response = await fetch(`https://api.locationiq.com/v1/autocomplete?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return [];

  const rows = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    address?: { state?: string; county?: string; city?: string };
  }>;

  return toBaliHits(rows);
}

/** Nominatim fallback when no LocationIQ browser token is configured. */
async function searchNominatim(query: string, signal?: AbortSignal): Promise<GeocodeHit[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '12',
    addressdetails: '1',
    countrycodes: 'id',
    viewbox: BALI_VIEWBOX,
    bounded: '1',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) return [];

  const rows = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return toBaliHits(rows);
}

/**
 * Forward-geocode places for stay setup — Bali only.
 * Uses LocationIQ Autocomplete when `VITE_LOCATION_IQ_ACCESS_TOKEN` is set;
 * otherwise Nominatim with the same island viewbox + coordinate filter.
 */
export async function searchBaliPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const fromLocationIq = await searchLocationIq(trimmed, signal);
    if (fromLocationIq) return fromLocationIq.slice(0, 10);
    return (await searchNominatim(trimmed, signal)).slice(0, 10);
  } catch {
    return [];
  }
}
