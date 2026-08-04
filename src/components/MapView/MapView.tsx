import { useEffect, useRef } from 'react';

import { EmptyState } from '@/components/EmptyState';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { useCategoryLookup } from '@/hooks/useLookups';
import { useTheme } from '@/state/ThemeContext';
import { BALI_CENTER } from '@/lib/geo';
import type { Coordinates, Spot } from '@/data/types';

import styles from './MapView.module.css';

export interface MapViewProps {
  spots: Spot[];
  center?: Coordinates;
  zoom?: number;
  selectedId?: string | null;
  onSelectSpot?: (id: string | null) => void;
  onRecenter?: () => void;
  height?: string;
}

/**
 * The only component that touches the Maps SDK directly.
 *
 * Degrades rather than crashing: with no key or a failed load it renders an
 * explanation, and Explore falls back to the list. That path is a real user
 * journey (and how CI sees the app), not an error case.
 */
export function MapView({
  spots,
  center,
  zoom = 10,
  selectedId,
  onSelectSpot,
  onRecenter,
  height = '100%',
}: MapViewProps) {
  const { status, maps, mapId } = useGoogleMaps();
  const { resolved } = useTheme();
  const categories = useCategoryLookup();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());

  // Create the map once the SDK is ready.
  useEffect(() => {
    if (status !== 'ready' || !maps || !containerRef.current || mapRef.current) return;

    mapRef.current = new maps.Map(containerRef.current, {
      center: center ?? BALI_CENTER,
      zoom,
      mapId: mapId || undefined,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      // Without this, tapping Google's own POI labels opens Google's place
      // cards instead of our curated ones — quietly undermining the product.
      clickableIcons: false,
      minZoom: 8,
      maxZoom: 18,
    });
  }, [status, maps, center, zoom, mapId]);

  // Sync markers to the filtered set.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !maps || !map) return;

    const existing = markersRef.current;
    const wanted = new Set(spots.map((s) => s.id));

    // Remove markers no longer in the result set.
    for (const [id, marker] of existing) {
      if (!wanted.has(id)) {
        marker.map = null;
        existing.delete(id);
      }
    }

    for (const spot of spots) {
      const category = categories.get(spot.category);
      const color = category?.color ?? '#C0553B';
      let marker = existing.get(spot.id);

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'bali-pin';
        el.style.setProperty('--pin-color', color);
        el.style.position = 'relative';
        // The cover image is the pin. Until the assets exist, the category
        // colour plus the initial stands in — same fallback as SpotImage.
        if (spot.images[0]) el.style.backgroundImage = `url(${spot.images[0]})`;
        else el.textContent = spot.name.charAt(0);
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', spot.name);

        marker = new maps.marker.AdvancedMarkerElement({
          map,
          position: spot.coordinates,
          content: el,
          title: spot.name,
        });

        marker.addListener('click', () => onSelectSpot?.(spot.id));
        existing.set(spot.id, marker);
      }

      const el = marker.content as HTMLElement;
      el.classList.toggle('bali-pin--selected', selectedId === spot.id);
      el.classList.toggle('bali-pin--visited', spot.visited);
    }
  }, [status, maps, spots, selectedId, categories, onSelectSpot]);

  // Fit bounds when the result set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !maps || !map || spots.length === 0) return;

    const bounds = new maps.LatLngBounds();
    spots.forEach((s) => bounds.extend(s.coordinates));
    map.fitBounds(bounds, 48);
  }, [status, maps, spots]);

  // Pan to the selected spot without changing zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const spot = spots.find((s) => s.id === selectedId);
    if (spot) map.panTo(spot.coordinates);
  }, [selectedId, spots]);

  // Detach every marker on unmount, or repeated Explore visits leak them.
  useEffect(
    () => () => {
      for (const marker of markersRef.current.values()) marker.map = null;
      markersRef.current.clear();
      mapRef.current = null;
    },
    [],
  );

  if (status === 'no-key' || status === 'error') {
    return (
      <div className={styles.wrapper} style={{ height }}>
        <div className={styles.degraded}>
          <EmptyState
            icon="◎"
            title={status === 'no-key' ? 'Map needs an API key' : 'Map failed to load'}
            message={
              status === 'no-key'
                ? 'Add VITE_GOOGLE_MAPS_API_KEY to .env.local to see places on the map. Everything else works without it — browse the list instead.'
                : 'The Google Maps script did not load. Check your connection and the API key restrictions.'
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} style={{ height }} data-theme-mode={resolved}>
      <div ref={containerRef} className={styles.canvas} />
      {onRecenter && status === 'ready' && (
        <button type="button" className={styles.recenter} onClick={onRecenter}>
          Recenter
        </button>
      )}
    </div>
  );
}
