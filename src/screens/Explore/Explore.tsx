import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { MapView } from '@/components/MapView';
import { PlaceCard } from '@/components/PlaceCard';
import { Sheet } from '@/components/Sheet';
import type { SnapPoint } from '@/components/Sheet';
import { applyFilters } from '@/data/queries';
import { useSpots } from '@/hooks/useSpots';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useOnboarding } from '@/state/OnboardingContext';
import type { ExploreFilters, SpotTag } from '@/data/types';

import styles from './Explore.module.css';

const VALID_TAGS: SpotTag[] = ['Memorable', 'Must Visit', 'Cultural', 'Outworldly'];

/**
 * Map and list are ONE synced view, not two modes.
 *
 * Below 1024px the map is full-bleed with a draggable sheet holding the list
 * over it; from 1024px they sit side by side. Both are driven by a single
 * `selectedId` — do not fork the sync logic per breakpoint.
 */
export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // null means "not chosen yet" — the default is derived below rather than
  // forced by an effect, which would cascade an extra render.
  const [chosenSnap, setChosenSnap] = useState<SnapPoint | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const spots = useSpots();
  const { anchor } = useOnboarding();
  const { status: mapsStatus } = useGoogleMaps();
  const isDesktop = useIsDesktop();
  const mapUnavailable = mapsStatus === 'no-key' || mapsStatus === 'error';

  // Filters live in the URL so a filtered view is linkable and refresh-safe.
  const filters = useMemo<ExploreFilters>(
    () => ({
      category: params.get('category'),
      region: params.get('region'),
      tags: (params.get('tags')?.split(',').filter(Boolean) ?? []).filter((t): t is SpotTag =>
        VALID_TAGS.includes(t as SpotTag),
      ),
      maxKm: params.get('maxKm') ? Number(params.get('maxKm')) : null,
      maxDurationMin: params.get('maxDurationMin')
        ? Number(params.get('maxDurationMin'))
        : null,
    }),
    [params],
  );

  const setFilters = useCallback(
    (next: ExploreFilters) => {
      const p = new URLSearchParams();
      if (next.category) p.set('category', next.category);
      if (next.region) p.set('region', next.region);
      if (next.tags.length) p.set('tags', next.tags.join(','));
      if (next.maxKm !== null) p.set('maxKm', String(next.maxKm));
      if (next.maxDurationMin !== null) p.set('maxDurationMin', String(next.maxDurationMin));
      setParams(p, { replace: true });
    },
    [setParams],
  );

  const results = useMemo(() => applyFilters(spots, filters), [spots, filters]);

  // With no map there is nothing to look at behind the sheet, so the list takes
  // the screen. The user can still drag it back down.
  const snap: SnapPoint = chosenSnap ?? (mapUnavailable ? 'full' : 'half');

  /** Pin → card. Scrolls the card into view and lifts the sheet enough to see it. */
  const selectFromMap = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      if (snap === 'peek') setChosenSnap('half');
    },
    [snap],
  );

  useEffect(() => {
    if (!selectedId) return;
    const node = listRef.current?.querySelector(`[data-spot-id="${selectedId}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);

  const list = (
    <div className={styles.list} ref={listRef}>
      {results.length === 0 ? (
        <EmptyState
          title="Nothing matches those filters"
          message="Try removing the distance limit or a category — there are only 54 places in total."
          action={{
            label: 'Clear filters',
            onClick: () =>
              setFilters({
                category: null,
                tags: [],
                region: null,
                maxKm: null,
                maxDurationMin: null,
              }),
          }}
          compact
        />
      ) : (
        results.map((spot) => (
          <PlaceCard
            key={spot.id}
            spot={spot}
            variant="compact"
            selected={selectedId === spot.id}
            onHover={setSelectedId}
          />
        ))
      )}
    </div>
  );

  return (
    <div className={styles.explore}>
      {/* Map layer — fixed behind the sheet below 1024px, left column above. */}
      <div className={styles.mapPane}>
        <MapView
          spots={results}
          center={anchor}
          selectedId={selectedId}
          onSelectSpot={selectFromMap}
          onRecenter={() => setSelectedId(null)}
        />
      </div>

      {/* The list is rendered exactly once, into whichever container the
          breakpoint calls for. Rendering both and hiding one with CSS would
          duplicate all 54 cards and break the pin-to-card scroll lookup. */}
      {isDesktop ? (
        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <h1 className={styles.title}>Explore</h1>
            <FilterBar filters={filters} onChange={setFilters} resultCount={results.length} />
          </div>
          {list}
        </aside>
      ) : (
        <Sheet
          snap={snap}
          onSnapChange={setChosenSnap}
          title={`${results.length} place${results.length === 1 ? '' : 's'}`}
        >
          <FilterBar filters={filters} onChange={setFilters} resultCount={results.length} />
          {list}
        </Sheet>
      )}
    </div>
  );
}
