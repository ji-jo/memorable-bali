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

export const BALI_CENTER: Coordinates = { lat: -8.45, lng: 115.1 };

/**
 * Camera limits — symmetric around BALI_CENTER so zoomed-out views stay on
 * Bali (not East Java). East still stops before Lombok proper.
 */
export const BALI_MIN_ZOOM = 8.2;
export const BALI_MAX_ZOOM = 16;
export const BALI_FIT_MAX_ZOOM = 11.2;

/** [SW, NE] as [lng, lat] — centered on BALI_CENTER (115.1, −8.45). */
export const BALI_MAP_BOUNDS: [[number, number], [number, number]] = [
  [114.0, -9.25],
  [116.2, -7.65],
];

/** East edge used when fitting spots — tighter than maxBounds so default framing stays Bali. */
export const BALI_FIT_EAST = 115.72;

/**
 * MapLibre requires the viewport at minZoom to fit inside maxBounds.
 * Large canvases need a higher floor or construct/resize throws.
 */
export function baliMinZoomForWidth(widthPx: number, tileSize = 512): number {
  const boundsWidth = BALI_MAP_BOUNDS[1][0] - BALI_MAP_BOUNDS[0][0];
  if (widthPx <= 0 || boundsWidth <= 0) return BALI_MIN_ZOOM;
  const required = Math.log2((360 * widthPx) / (tileSize * boundsWidth));
  // Small pad so resize / DPI rounding never trips the constructor.
  return Math.max(BALI_MIN_ZOOM, Math.ceil(required * 100) / 100 + 0.05);
}

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
