import type { Coordinates } from '@/data/types';

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Straight-line distance between two points.
 *
 * ⚠️ Bali road distance typically runs 1.3–1.8× this, and travel time is
 * dominated by traffic rather than distance. Label results "away", never
 * "drive". For real drive times use the Directions API.
 */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Rough drive-time estimate for when the Directions API is unavailable. */
export function estimateDriveMinutes(km: number): number {
  const ROAD_FACTOR = 1.5;
  const AVERAGE_KMH = 30; // Bali average including traffic — optimistic in the south
  return Math.round(((km * ROAD_FACTOR) / AVERAGE_KMH) * 60);
}

/**
 * Bali province bounding box — the same box scripts/validate-spots.mjs uses,
 * so a spot that would render off-island fails CI before it reaches the map.
 */
export const BALI_BOUNDS = {
  north: -8.0,
  south: -9.2,
  west: 114.4,
  east: 115.8,
} as const;

export const BALI_CENTER: Coordinates = { lat: -8.45, lng: 115.15 };

export function isWithinBali(c: Coordinates): boolean {
  return (
    c.lat >= BALI_BOUNDS.south &&
    c.lat <= BALI_BOUNDS.north &&
    c.lng >= BALI_BOUNDS.west &&
    c.lng <= BALI_BOUNDS.east
  );
}

/** Smallest box containing every point, for fitting map bounds to a result set. */
export function boundsOf(points: Coordinates[]) {
  if (points.length === 0) return null;

  return points.reduce(
    (acc, p) => ({
      north: Math.max(acc.north, p.lat),
      south: Math.min(acc.south, p.lat),
      east: Math.max(acc.east, p.lng),
      west: Math.min(acc.west, p.lng),
    }),
    { north: -90, south: 90, east: -180, west: 180 },
  );
}
