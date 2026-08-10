import {
  BALI_BOUNDS,
  BALI_CENTER,
  BALI_FIT_EAST,
  BALI_FIT_MAX_ZOOM,
  BALI_MAP_BOUNDS,
  BALI_MAX_ZOOM,
  BALI_MIN_ZOOM,
  baliMinZoomForWidth,
  boundsOf,
} from '@/lib/geo';
import type { Coordinates } from '@/data/types';
import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl';

export { BALI_MAP_BOUNDS, BALI_MIN_ZOOM, BALI_MAX_ZOOM, BALI_FIT_MAX_ZOOM };

export function createBaliMapOptions(
  container: HTMLElement,
  center: Coordinates,
  zoom: number,
): MapOptions {
  const minZoom = baliMinZoomForWidth(container.clientWidth || container.offsetWidth || 1280);

  return {
    container,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [center.lng, center.lat],
    zoom: Math.max(zoom, minZoom),
    maxBounds: BALI_MAP_BOUNDS,
    minZoom,
    maxZoom: BALI_MAX_ZOOM,
    attributionControl: false,
  };
}

export function applyBaliMapConstraints(map: MapLibreMap) {
  const width = map.getContainer().clientWidth;
  const minZoom = baliMinZoomForWidth(width);
  try {
    map.setMaxBounds(BALI_MAP_BOUNDS);
    map.setMinZoom(minZoom);
    map.setMaxZoom(BALI_MAX_ZOOM);
  } catch (error) {
    // Oversized viewport vs bounds — keep the map alive without hard bounds.
    console.warn('[map] Bali constraints skipped:', error);
    map.setMaxBounds(null);
    map.setMinZoom(BALI_MIN_ZOOM);
    map.setMaxZoom(BALI_MAX_ZOOM);
  }
}

function islandFitBounds(): [[number, number], [number, number]] {
  return [
    [BALI_BOUNDS.west, BALI_BOUNDS.south],
    [Math.min(BALI_BOUNDS.east, BALI_FIT_EAST), BALI_BOUNDS.north],
  ];
}

export function fitSpotsInBali(
  map: MapLibreMap,
  points: Coordinates[],
  padding: number | { top: number; bottom: number; left: number; right: number } = 56,
  duration = 500,
) {
  const options = {
    padding,
    maxZoom: BALI_FIT_MAX_ZOOM,
    pitch: 0,
    bearing: 0,
    duration,
  } as const;

  try {
    // Wide result sets: frame the whole island so Bali stays centered.
    // Tight filters: zoom to the cluster, still clamped to the province box.
    if (points.length < 2 || points.length >= 12) {
      map.fitBounds(islandFitBounds(), options);
      return;
    }

    const bounds = boundsOf(points);
    if (!bounds) {
      map.fitBounds(islandFitBounds(), options);
      return;
    }

    const west = BALI_BOUNDS.west;
    const east = Math.min(BALI_BOUNDS.east, BALI_FIT_EAST);
    const south = BALI_BOUNDS.south;
    const north = BALI_BOUNDS.north;
    const padLng = 0.12;
    const padLat = 0.1;
    map.fitBounds(
      [
        [Math.max(bounds.west - padLng, west), Math.max(bounds.south - padLat, south)],
        [Math.min(bounds.east + padLng, east), Math.min(bounds.north + padLat, north)],
      ],
      options,
    );
  } catch (error) {
    console.warn('[map] fitSpotsInBali skipped:', error);
    try {
      map.jumpTo({
        center: [BALI_CENTER.lng, BALI_CENTER.lat],
        zoom: Math.max(map.getMinZoom(), 8.6),
      });
    } catch {
      // ignore
    }
  }
}

export function whenMapReady(map: MapLibreMap, callback: () => void): () => void {
  if (map.loaded()) {
    callback();
    return () => undefined;
  }

  map.once('load', callback);
  return () => map.off('load', callback);
}
