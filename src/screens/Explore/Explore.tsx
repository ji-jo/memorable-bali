import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { MapView } from '@/components/MapView';
import { PlaceCard } from '@/components/PlaceCard';
import { Sheet } from '@/components/Sheet';
import type { SnapPoint } from '@/components/Sheet';
import { applyFilters } from '@/data/queries';
import { useSpots } from '@/hooks/useSpots';
import { BALI_CENTER } from '@/lib/geo';
import { useOnboarding } from '@/state/OnboardingContext';
import type { ExploreFilters, SpotTag } from '@/data/types';

import styles from './Explore.module.css';

import { ExploreResultsHeader, type ExploreViewMode } from './ExploreResultsHeader';

const VALID_TAGS: SpotTag[] = ['Memorable', 'Must Visit', 'Cultural', 'Outworldly'];

type ExploreLocationState = {
  mapFocus?: boolean;
};

/**
 * Map and list are ONE synced view, not two modes — except map-focus, which
 * hides the list chrome so the map can breathe. Pin taps in map-focus open
 * PlaceDetail; elsewhere they sync the list selection.
 *
 * Mobile and desktop both use the draggable bottom sheet; the map stays
 * full-bleed and recenters into the visible band above the sheet.
 */
export default function Explore() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Hover is ephemeral map preview; selected sticks after a pin click.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // null means "not chosen yet" — the default is derived below rather than
  // forced by an effect, which would cascade an extra render.
  const [chosenSnap, setChosenSnap] = useState<SnapPoint | null>(null);
  const [mapFocus, setMapFocus] = useState(
    () => (location.state as ExploreLocationState | null)?.mapFocus === true,
  );
  const [viewMode, setViewMode] = useState<ExploreViewMode>('list');
  /** Viewport fraction covered by the sheet — drives map bottom padding. */
  const [sheetCover, setSheetCover] = useState(0.5);
  const listRef = useRef<HTMLDivElement>(null);

  const spots = useSpots();
  const { anchor, preferences } = useOnboarding();
  const activeMapId = hoveredId ?? selectedId;

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

  const snap: SnapPoint = chosenSnap ?? 'half';

  /** Pin click → highlight + scroll the list card (explore). Map-focus → place page. */
  const selectFromMap = useCallback(
    (id: string | null) => {
      if (mapFocus && id) {
        navigate(`/place/${id}`);
        return;
      }
      setHoveredId(null);
      setSelectedId(id);
      if (!id) return;
      if (snap === 'peek') setChosenSnap('half');
    },
    [mapFocus, navigate, snap],
  );

  /** List card click → select map pin (first click). Already selected → open place. */
  const selectFromList = useCallback(
    (id: string, event: { preventDefault: () => void }) => {
      if (selectedId === id) return; // allow Link navigation
      event.preventDefault();
      setHoveredId(null);
      setSelectedId(id);
      if (snap === 'peek') setChosenSnap('half');
    },
    [selectedId, snap],
  );

  const scrollSelectedCardIntoView = useCallback((spotId: string) => {
    const root = listRef.current;
    if (!root) return false;

    const node = root.querySelector<HTMLElement>(`[data-spot-id="${CSS.escape(spotId)}"]`);
    if (!node) return false;

    const scroller =
      root.scrollHeight > root.clientHeight + 1 ? root : (findScrollParent(node) ?? root);
    const scrollerRect = scroller.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const sticky = scroller.querySelector<HTMLElement>(`.${styles.resultsHeader}`);
    const topPad = (sticky?.offsetHeight ?? 56) + 12;
    const next = Math.max(0, scroller.scrollTop + (nodeRect.top - scrollerRect.top) - topPad);

    animateScrollTop(scroller, next);
    node.setAttribute('data-flash-selected', 'true');
    window.setTimeout(() => node.removeAttribute('data-flash-selected'), 900);
    return true;
  }, []);

  useEffect(() => {
    if (!selectedId || mapFocus) return;

    let cancelled = false;
    let attempts = 0;

    const tryScroll = () => {
      if (cancelled) return;
      if (scrollSelectedCardIntoView(selectedId)) return;
      attempts += 1;
      if (attempts < 8) {
        window.setTimeout(tryScroll, 40 * attempts);
      }
    };

    // Wait for sheet snap / list paint, then retry a few times.
    const start = window.setTimeout(tryScroll, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [selectedId, mapFocus, viewMode, results, scrollSelectedCardIntoView]);

  const enterMapFocus = useCallback(() => {
    setSelectedId(null);
    setHoveredId(null);
    setMapFocus(true);
  }, []);

  const exitMapFocus = useCallback(() => {
    setMapFocus(false);
  }, []);

  const toggleMapFocus = useCallback(() => {
    if (mapFocus) exitMapFocus();
    else enterMapFocus();
  }, [enterMapFocus, exitMapFocus, mapFocus]);

  useEffect(() => {
    if ((location.state as ExploreLocationState | null)?.mapFocus) {
      setMapFocus(true);
      // Consume the flag so a later back-nav doesn't re-enter focus forever.
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  const list = (
    <div className={styles.listScroll} ref={listRef}>
      <ExploreResultsHeader count={results.length} view={viewMode} onViewChange={setViewMode} />
      <div className={`${styles.listBody} ${viewMode === 'grid' ? styles.grid : ''}`}>
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
        ) : viewMode === 'list' ? (
          results.map((spot) => (
            <PlaceCard
              key={spot.id}
              spot={spot}
              variant="compact"
              selected={selectedId === spot.id}
              onHover={setHoveredId}
              onClick={(event) => selectFromList(spot.id, event)}
            />
          ))
        ) : (
          results.map((spot) => (
            <PlaceCard
              key={spot.id}
              spot={spot}
              variant="grid"
              selected={selectedId === spot.id}
              onHover={setHoveredId}
              onClick={(event) => selectFromList(spot.id, event)}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className={`${styles.explore} ${mapFocus ? styles.mapFocus : ''}`}>
      <div className={styles.mapPane}>
        <MapView
          spots={results}
          center={BALI_CENTER}
          selectedId={activeMapId}
          onSelectSpot={selectFromMap}
          onRecenter={toggleMapFocus}
          bottomInset={mapFocus ? 0 : sheetCover}
          mapFullscreen={mapFocus}
          stayAnchor={anchor}
          stayLabel={preferences.stayAreaLabel}
        />
      </div>

      {!mapFocus ? (
        <Sheet snap={snap} onSnapChange={setChosenSnap} onCoverChange={setSheetCover}>
          <FilterBar filters={filters} onChange={setFilters} />
          {list}
        </Sheet>
      ) : null}
    </div>
  );
}

/** Nearest ancestor that actually scrolls (Sheet content, PerfectScrollbar host, etc.). */
function findScrollParent(start: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = start.parentElement;
  while (node && node !== document.body) {
    const canScroll = node.scrollHeight > node.clientHeight + 1;
    if (canScroll) {
      const overflowY = getComputedStyle(node).overflowY;
      if (
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflowY === 'overlay' ||
        overflowY === 'hidden' ||
        node.classList.contains('ps')
      ) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

/** Drive scrollTop directly (instant if reduced-motion). */
function animateScrollTop(scroller: HTMLElement, top: number) {
  const target = Math.max(0, Math.min(top, scroller.scrollHeight - scroller.clientHeight));
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || Math.abs(scroller.scrollTop - target) < 2) {
    scroller.scrollTop = target;
    return;
  }

  const start = scroller.scrollTop;
  const delta = target - start;
  const duration = Math.min(520, Math.max(220, Math.abs(delta) * 0.35));
  const t0 = performance.now();
  const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / duration);
    scroller.scrollTop = start + delta * easeOutCubic(p);
    if (p < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}
