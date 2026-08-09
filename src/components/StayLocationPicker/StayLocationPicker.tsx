import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import maplibregl from 'maplibre-gl';

import { Button } from '@/components/Button';
import { SmoothInput } from '@/components/ui/skiper-ui/skiper106';
import { createBaliMapOptions, applyBaliMapConstraints } from '@/lib/map-libre';
import { searchBaliPlaces, type GeocodeHit } from '@/lib/navigation';
import {
  formatStayCoordinates,
  parseStayLocationInput,
} from '@/lib/stay-location';
import { useOnboarding } from '@/state/OnboardingContext';
import type { Coordinates } from '@/data/types';

import styles from './StayLocationPicker.module.css';

export interface StayLocationPickerProps {
  open: boolean;
  onClose: () => void;
}

type Draft = { label: string; coordinates: Coordinates };

/**
 * Set a custom hotel/home pin — search, drag the marker, or type coordinates /
 * a Google Plus Code. Writes stayAreaId: 'custom' into onboarding preferences.
 */
export function StayLocationPicker({ open, onClose }: StayLocationPickerProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const helperId = useId();
  const { preferences, update } = useOnboarding();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => ({
    label: preferences.stayAreaLabel,
    coordinates: preferences.stayAnchor,
  }));
  const [coordText, setCoordText] = useState(() =>
    formatStayCoordinates(preferences.stayAnchor),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  /** When true, draft came from the map — don't fight the user with easeTo. */
  const syncingFromMap = useRef(false);
  const searchSeq = useRef(0);

  const applyCoordinates = (
    coordinates: Coordinates,
    label: string,
    origin: 'map' | 'input' | 'search' | 'gps',
  ) => {
    syncingFromMap.current = origin === 'map';
    setDraft({ label, coordinates });
    setCoordText(formatStayCoordinates(coordinates));
    setParseError(null);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset draft only when the dialog opens — not on every preferences identity change
  // (that was clearing the search query mid-typing and leaving "Searching…" stuck).
  useEffect(() => {
    if (!open) return;
    const coordinates = preferences.stayAnchor;
    setDraft({
      label: preferences.stayAreaId === 'custom' ? preferences.stayAreaLabel : 'My stay',
      coordinates,
    });
    setCoordText(formatStayCoordinates(coordinates));
    setParseError(null);
    setQuery('');
    setHits([]);
    setSearching(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only when `open` flips true
  }, [open]);

  // Esc + focus trap basics — overlay click is handled on the backdrop node.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !mapNode.current || mapRef.current) return;

    const map = new maplibregl.Map({
      ...createBaliMapOptions(mapNode.current, draft.coordinates, 11),
      attributionControl: false,
    });
    mapRef.current = map;
    applyBaliMapConstraints(map);

    const element = document.createElement('div');
    element.innerHTML =
      '<div class="bali-stay-pin" aria-label="Your stay"><svg class="bali-stay-pin__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3.2 3.5 10.2a1 1 0 0 0-.3.7V20a1 1 0 0 0 1 1h5.2a.8.8 0 0 0 .8-.8V15a1.5 1.5 0 0 1 3 0v5.2a.8.8 0 0 0 .8.8H19.8a1 1 0 0 0 1-1v-9.1a1 1 0 0 0-.3-.7L12 3.2Z"/></svg></div>';
    const marker = new maplibregl.Marker({ element, anchor: 'center', draggable: true })
      .setLngLat([draft.coordinates.lng, draft.coordinates.lat])
      .addTo(map);
    markerRef.current = marker;

    const onDrag = () => {
      const { lng, lat } = marker.getLngLat();
      applyCoordinates({ lat, lng }, 'Pinned stay', 'map');
    };

    marker.on('drag', onDrag);
    marker.on('dragend', onDrag);

    map.on('click', (event) => {
      const { lng, lat } = event.lngLat;
      marker.setLngLat([lng, lat]);
      applyCoordinates({ lat, lng }, 'Pinned stay', 'map');
    });

    return () => {
      marker.off('drag', onDrag);
      marker.off('dragend', onDrag);
      marker.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // Mount once per open cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !mapRef.current || !markerRef.current) return;
    markerRef.current.setLngLat([draft.coordinates.lng, draft.coordinates.lat]);
    if (syncingFromMap.current) {
      syncingFromMap.current = false;
      return;
    }
    mapRef.current.easeTo({
      center: [draft.coordinates.lng, draft.coordinates.lat],
      duration: 320,
    });
  }, [draft.coordinates, open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      searchSeq.current += 1;
      setHits([]);
      setSearching(false);
      return;
    }

    const seq = ++searchSeq.current;
    const controller = new AbortController();
    setSearching(true);

    const timer = window.setTimeout(() => {
      void searchBaliPlaces(trimmed, controller.signal)
        .then((next) => {
          if (seq === searchSeq.current) setHits(next);
        })
        .catch(() => {
          if (seq === searchSeq.current) setHits([]);
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const commitCoordText = (value: string) => {
    const parsed = parseStayLocationInput(value);
    if (!parsed.ok) {
      setParseError(parsed.message);
      return;
    }
    applyCoordinates(
      parsed.coordinates,
      parsed.kind === 'pluscode' ? 'Plus Code stay' : 'Pinned stay',
      'input',
    );
  };

  const save = () => {
    const parsed = parseStayLocationInput(coordText);
    if (parsed.ok) {
      update({
        stayAreaId: 'custom',
        stayAnchor: parsed.coordinates,
        stayAreaLabel:
          draft.label || (parsed.kind === 'pluscode' ? 'Plus Code stay' : 'My stay'),
      });
      onClose();
      return;
    }
    // Fall back to last good draft pin if the field is mid-edit.
    update({
      stayAreaId: 'custom',
      stayAnchor: draft.coordinates,
      stayAreaLabel: draft.label || 'My stay',
    });
    onClose();
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyCoordinates(
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          'Current location',
          'gps',
        );
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  if (!open || !mounted) return null;

  // Portaled to <body> so ancestors with transforms (e.g. motion.div) can't
  // trap position:fixed and pin the panel to the top of a scroll container.
  return createPortal(
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.backdrop}
        aria-hidden="true"
        onClick={onClose}
        onKeyDown={undefined}
      />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={helperId}
      >
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h2 id={titleId} className={styles.title}>
              Set your hotel / home
            </h2>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className={styles.hint}>
            Distances and navigation start from here. Drag the pin, search, or type a
            location.
          </p>
        </header>

        <div className={styles.searchBlock}>
          <div className={styles.searchRow}>
            <input
              className={styles.input}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hotel, villa, or area in Bali"
              aria-label="Search for your stay"
              aria-autocomplete="list"
              aria-controls={hits.length > 0 ? 'stay-location-hits' : undefined}
              aria-expanded={hits.length > 0}
            />
            <button type="button" className={styles.locate} onClick={useDeviceLocation}>
              Use GPS
            </button>
          </div>

          {searching ? <p className={styles.status}>Searching…</p> : null}
          {hits.length > 0 ? (
            <ul id="stay-location-hits" className={styles.hits} role="listbox" aria-label="Matching places">
              {hits.map((hit) => (
                <li key={`${hit.coordinates.lat}-${hit.coordinates.lng}-${hit.label}`} role="option">
                  <button
                    type="button"
                    className={styles.hit}
                    onClick={() => applyCoordinates(hit.coordinates, hit.label, 'search')}
                  >
                    {hit.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div ref={mapNode} className={styles.map} />

        <div className={styles.coordBlock}>
          <p className={styles.selectionLabel}>
            <strong>{draft.label}</strong>
          </p>
          <SmoothInput
            value={coordText}
            onChange={(event) => {
              setCoordText(event.target.value);
              setParseError(null);
            }}
            onBlur={(event) => commitCoordText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitCoordText(coordText);
              }
            }}
            placeholder="-8.6847, 115.2301"
            aria-label="Stay coordinates or Google Plus Code"
            aria-describedby={helperId}
            aria-invalid={Boolean(parseError)}
            wrapperClassName={`${styles.smoothWrap} has-[:focus-visible]:outline-none has-[:focus-visible]:outline-0 has-[:focus-visible]:outline-offset-0`}
            className={styles.smoothInput}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={parseError ? 'error' : 'hint'}
              id={helperId}
              className={styles.helper}
              data-error={parseError ? 'true' : undefined}
              initial={{ opacity: 0.4, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            >
              {parseError ?? 'Write coordinate or google plus code'}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save location</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
