import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { ArrowsInSimpleIcon } from '@phosphor-icons/react/dist/csr/ArrowsInSimple';
import { ArrowsOutSimpleIcon } from '@phosphor-icons/react/dist/csr/ArrowsOutSimple';
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus';
import { MinusIcon } from '@phosphor-icons/react/dist/csr/Minus';

import { useCategoryLookup } from '@/hooks/useLookups';
import { BALI_CENTER } from '@/lib/geo';
import { formatDistance } from '@/lib/format';
import {
  applyBaliMapConstraints,
  createBaliMapOptions,
  fitSpotsInBali,
  whenMapReady,
} from '@/lib/map-libre';
import { bindMapPinMotion, syncSelectedPinPreviews } from '@/lib/map-pin-motion';
import { GlassSurface } from '@/components/GlassSurface/GlassSurface';
import type { Coordinates, Spot } from '@/data/types';

import styles from './MapView.module.css';

export interface MapViewProps {
  spots: Spot[];
  center?: Coordinates;
  zoom?: number;
  selectedId?: string | null;
  onSelectSpot?: (id: string | null) => void;
  onRecenter?: () => void;
  /** When true, the recenter control collapses back instead of expanding the map. */
  mapFullscreen?: boolean;
  height?: string;
  fitBounds?: boolean;
  /** Fraction of the map covered from the bottom by floating UI. */
  bottomInset?: number;
  /** Pixels covered from the left by a floating list panel. */
  leftInset?: number;
  /** Hotel / home pin — distances are measured from here. */
  stayAnchor?: Coordinates | null;
  stayLabel?: string;
  /** Optional driving preview polyline (lng/lat pairs already as Coordinates). */
  routePath?: Coordinates[] | null;
}

const TILE_SIZE = 512;
const MAX_MERCATOR_LATITUDE = 85.051129;
const EDGE_PAD = 56;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  );
}

function centerForVisibleArea(
  location: Coordinates,
  zoom: number,
  bottomInset: number,
  viewportHeight: number,
): Coordinates {
  if (bottomInset <= 0 || viewportHeight <= 0) return location;

  const worldSize = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, location.lat),
  );
  const latitudeRadians = (latitude * Math.PI) / 180;
  const worldY =
    (0.5 -
      Math.log((1 + Math.sin(latitudeRadians)) / (1 - Math.sin(latitudeRadians))) /
        (4 * Math.PI)) *
    worldSize;
  const offsetY = (viewportHeight * Math.min(1, Math.max(0, bottomInset))) / 2;
  const shiftedY = worldY + offsetY;
  const shiftedLatitude =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * shiftedY) / worldSize))) * 180) / Math.PI;

  return { lat: shiftedLatitude, lng: location.lng };
}

function fitPadding(leftInset: number, mapWidth = 0) {
  const rawLeft = EDGE_PAD + Math.max(0, leftInset);
  // Huge left padding + tight Bali maxBounds makes MapLibre throw on setPadding/fitBounds.
  const maxLeft =
    mapWidth > 0 ? Math.min(rawLeft, Math.max(EDGE_PAD, Math.floor(mapWidth * 0.42))) : rawLeft;
  return {
    top: EDGE_PAD,
    right: EDGE_PAD,
    bottom: EDGE_PAD,
    left: maxLeft,
  };
}

function createMapSafely(
  container: HTMLElement,
  center: Coordinates,
  zoom: number,
): maplibregl.Map {
  try {
    return new maplibregl.Map(createBaliMapOptions(container, center, zoom));
  } catch (error) {
    console.warn('[map] Retrying without maxBounds after construct error:', error);
    return new maplibregl.Map({
      ...createBaliMapOptions(container, center, Math.max(zoom, 8.5)),
      maxBounds: undefined,
      minZoom: 8.2,
      zoom: Math.max(zoom, 8.5),
    });
  }
}

/**
 * MapLibre map with OpenFreeMap tiles — no Google key required.
 */
export function MapView({
  spots,
  center,
  zoom = 10,
  selectedId,
  onSelectSpot,
  onRecenter,
  mapFullscreen = false,
  height = '100%',
  fitBounds = true,
  bottomInset = 0,
  leftInset = 0,
  stayAnchor = null,
  stayLabel = 'Your stay',
  routePath = null,
}: MapViewProps) {
  const categories = useCategoryLookup();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const stayMarkerRef = useRef<maplibregl.Marker | null>(null);
  const onSelectSpotRef = useRef(onSelectSpot);
  const [mapEpoch, setMapEpoch] = useState(0);

  useEffect(() => {
    onSelectSpotRef.current = onSelectSpot;
  }, [onSelectSpot]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let onResize: (() => void) | null = null;

    const mount = () => {
      if (cancelled || mapRef.current) return;
      if (container.clientWidth < 2 || container.clientHeight < 2) return;

      const initialCenter = centerForVisibleArea(
        center ?? BALI_CENTER,
        zoom,
        bottomInset,
        container.clientHeight,
      );

      let map: maplibregl.Map;
      try {
        map = createMapSafely(container, initialCenter, zoom);
      } catch (error) {
        console.error('[map] Failed to create map:', error);
        return;
      }

      mapRef.current = map;
      applyBaliMapConstraints(map);
      try {
        map.setPadding(fitPadding(leftInset, container.clientWidth));
      } catch (error) {
        console.warn('[map] setPadding skipped:', error);
      }

      onResize = () => {
        if (!mapRef.current) return;
        applyBaliMapConstraints(mapRef.current);
      };
      map.on('resize', onResize);
      resizeObserver?.disconnect();
      resizeObserver = null;
      setMapEpoch((value) => value + 1);
    };

    if (container.clientWidth >= 2 && container.clientHeight >= 2) {
      mount();
    } else {
      resizeObserver = new ResizeObserver(() => mount());
      resizeObserver.observe(container);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      const active = mapRef.current;
      if (!active) return;
      if (onResize) active.off('resize', onResize);
      for (const marker of markersRef.current.values()) {
        try {
          marker.remove();
        } catch {
          // ignore
        }
      }
      markersRef.current.clear();
      try {
        stayMarkerRef.current?.remove();
      } catch {
        // ignore
      }
      stayMarkerRef.current = null;
      try {
        active.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    };
    // Create once — padding / center updates run in their own effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const width = map.getContainer().clientWidth;
    try {
      map.setPadding(fitPadding(leftInset, width));
    } catch (error) {
      console.warn('[map] setPadding skipped:', error);
    }
    if (!fitBounds || spots.length === 0) return;
    return whenMapReady(map, () => {
      fitSpotsInBali(
        map,
        spots.map((spot) => spot.coordinates),
        fitPadding(leftInset, width),
      );
    });
  }, [fitBounds, leftInset, spots, mapEpoch]);

  // Sync markers to the filtered set (not to selection — that is class-only below).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = markersRef.current;
    for (const marker of existing.values()) {
      try {
        marker.remove();
      } catch {
        // ignore
      }
    }
    existing.clear();

    for (const spot of spots) {
      const category = categories.get(spot.category);
      const color = category?.color ?? '#C0553B';
      const safeName = escapeHtml(spot.name);
      const safeCategory = escapeHtml(category?.label ?? spot.category);
      const safeImage = spot.images[0] ? escapeHtml(spot.images[0]) : '';
      const image = safeImage
        ? `<span class="bali-pin__thumb" style="background-image:url(&quot;${safeImage}&quot;)"></span>`
        : '';
      const element = document.createElement('div');
      element.innerHTML = `<button type="button" data-spot-id="${spot.id}" class="bali-pin ${spot.visited ? 'bali-pin--visited' : ''}" style="--pin-color:${color}" aria-label="${safeName}"><span class="bali-pin__dot"></span><span class="bali-pin__preview">${image}<span class="bali-pin__copy"><strong>${safeName}</strong><small>${safeCategory} · ${formatDistance(spot.distanceFromStayKm)} · ★ ${spot.rating.toFixed(1)}</small></span></span></button>`;
      element.style.cursor = 'pointer';
      // Keep MapLibre from treating pin taps as map drags.
      element.style.pointerEvents = 'auto';

      const select = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectSpotRef.current?.(spot.id);
      };
      // Capture on the marker root — MapLibre can swallow bubbled button clicks.
      element.addEventListener('click', select, true);

      try {
        const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
          .setLngLat([spot.coordinates.lng, spot.coordinates.lat])
          .addTo(map);
        existing.set(spot.id, marker);
      } catch (error) {
        console.warn('[map] marker skipped:', spot.id, error);
      }
    }

    const frame = requestAnimationFrame(() => {
      if (containerRef.current) syncSelectedPinPreviews(containerRef.current);
    });

    return () => cancelAnimationFrame(frame);
  }, [spots, categories, mapEpoch]);

  // Toggle selected pin chrome without rebuilding markers (keeps clicks reliable).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLElement>('.bali-pin').forEach((pin) => {
      const active = Boolean(selectedId) && pin.dataset.spotId === selectedId;
      pin.classList.toggle('bali-pin--selected', active);
      pin.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    syncSelectedPinPreviews(container);
  }, [selectedId, spots, mapEpoch]);

  // Stay / hotel pin — distinct from curated spots.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    stayMarkerRef.current?.remove();
    stayMarkerRef.current = null;
    if (!stayAnchor) return;

    const element = document.createElement('div');
    const safeLabel = escapeHtml(stayLabel);
    element.style.pointerEvents = 'none';
    element.innerHTML = `<div class="bali-stay-pin" aria-label="${safeLabel}" title="${safeLabel}"><svg class="bali-stay-pin__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3.2 3.5 10.2a1 1 0 0 0-.3.7V20a1 1 0 0 0 1 1h5.2a.8.8 0 0 0 .8-.8V15a1.5 1.5 0 0 1 3 0v5.2a.8.8 0 0 0 .8.8H19.8a1 1 0 0 0 1-1v-9.1a1 1 0 0 0-.3-.7L12 3.2Z"/></svg></div>`;
    try {
      const marker = new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat([stayAnchor.lng, stayAnchor.lat])
        .addTo(map);
      stayMarkerRef.current = marker;
      return () => {
        try {
          marker.remove();
        } catch {
          // ignore
        }
        if (stayMarkerRef.current === marker) stayMarkerRef.current = null;
      };
    } catch (error) {
      console.warn('[map] stay marker skipped:', error);
      return undefined;
    }
  }, [stayAnchor, stayLabel, mapEpoch]);

  // Driving preview line (OSRM).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = 'bali-route';
    const layerId = 'bali-route-line';

    const clear = () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // Map may already be removed during route transitions.
      }
    };

    if (!routePath || routePath.length < 2) {
      clear();
      return;
    }

    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routePath.map((point) => [point.lng, point.lat]),
      },
    };

    const apply = () => {
      clear();
      try {
        map.addSource(sourceId, { type: 'geojson', data });
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#007AFF',
            'line-width': 4,
            'line-opacity': 0.85,
          },
        });
      } catch (error) {
        console.warn('[map] route layer skipped:', error);
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);

    return () => {
      map.off('load', apply);
      clear();
    };
  }, [routePath, mapEpoch]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    return bindMapPinMotion(container);
  }, [mapEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const spot = spots.find((s) => s.id === selectedId);
    if (!spot) return;

    const recenter = () => {
      if (!mapRef.current) return;
      const target = centerForVisibleArea(
        spot.coordinates,
        zoom,
        bottomInset,
        containerRef.current?.clientHeight ?? window.innerHeight,
      );
      try {
        map.easeTo({
          center: [target.lng, target.lat],
          padding: fitPadding(leftInset, map.getContainer().clientWidth),
          duration: 320,
        });
      } catch (error) {
        console.warn('[map] easeTo skipped:', error);
      }
    };

    recenter();
    window.addEventListener('resize', recenter);
    return () => window.removeEventListener('resize', recenter);
  }, [bottomInset, leftInset, selectedId, spots, zoom, mapEpoch]);

  const handleZoom = (deltaY: number) => {
    const map = mapRef.current;
    if (!map) return;
    const next = map.getZoom() + (deltaY < 0 ? 1 : -1);
    try {
      map.zoomTo(next, { duration: 220 });
    } catch (error) {
      console.warn('[map] zoomTo skipped:', error);
    }
  };

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!mapFullscreen && map && spots.length > 0) {
      fitSpotsInBali(
        map,
        spots.map((spot) => spot.coordinates),
        fitPadding(leftInset, map.getContainer().clientWidth),
      );
    }
    onRecenter?.();
  };

  return (
    <div className={styles.wrapper} style={{ height }}>
      <div ref={containerRef} id="bali-explorer-map" className={styles.canvas} />
      <div className={styles.controls}>
        <GlassSurface className={styles.iconGlass} borderRadius={22}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={handleRecenter}
            aria-label={mapFullscreen ? 'Back to explore' : 'Recenter map'}
          >
            {mapFullscreen ? (
              <ArrowsInSimpleIcon size={20} weight="bold" />
            ) : (
              <ArrowsOutSimpleIcon size={20} weight="bold" />
            )}
          </button>
        </GlassSurface>
        <GlassSurface className={styles.zoomGlass} borderRadius={22}>
          <div className={styles.zoomGroup}>
            <button
              type="button"
              className={styles.zoomButton}
              onClick={() => handleZoom(-500)}
              aria-label="Zoom in"
            >
              <PlusIcon size={20} weight="bold" />
            </button>
            <div className={styles.zoomDivider} aria-hidden="true" />
            <button
              type="button"
              className={styles.zoomButton}
              onClick={() => handleZoom(500)}
              aria-label="Zoom out"
            >
              <MinusIcon size={20} weight="bold" />
            </button>
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}
