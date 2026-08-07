import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PerfectScrollbar from 'perfect-scrollbar';

import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { MapView } from '@/components/MapView';
import { PlaceCard } from '@/components/PlaceCard';
import { Sheet } from '@/components/Sheet';
import type { SnapPoint } from '@/components/Sheet';
import { applyFilters } from '@/data/queries';
import { useSpots } from '@/hooks/useSpots';
import { useIsDesktop } from '@/hooks/useMediaQuery';
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
  const [mapLeftInset, setMapLeftInset] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const listScrollbarRef = useRef<PerfectScrollbar | null>(null);

  const spots = useSpots();
  const { anchor, preferences } = useOnboarding();
  const isDesktop = useIsDesktop();
  const activeMapId = hoveredId ?? selectedId;

  useEffect(() => {
    if (!isDesktop || mapFocus) {
      setMapLeftInset(0);
      return;
    }

    const update = () => {
      setMapLeftInset(panelRef.current?.getBoundingClientRect().width ?? 0);
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isDesktop, mapFocus]);

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
      if (!isDesktop && snap === 'peek') setChosenSnap('half');
    },
    [isDesktop, mapFocus, navigate, snap],
  );

  /** List card click → select map pin (first click). Already selected → open place. */
  const selectFromList = useCallback(
    (id: string, event: { preventDefault: () => void }) => {
      if (selectedId === id) return; // allow Link navigation
      event.preventDefault();
      setHoveredId(null);
      setSelectedId(id);
      if (!isDesktop && snap === 'peek') setChosenSnap('half');
    },
    [isDesktop, selectedId, snap],
  );

  const scrollSelectedCardIntoView = useCallback((spotId: string) => {
    const root = listRef.current;
    if (!root) return false;

    const node = root.querySelector<HTMLElement>(`[data-spot-id="${CSS.escape(spotId)}"]`);
    if (!node) return false;

    const scroller = findScrollParent(node) ?? root;
    const scrollerRect = scroller.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const sticky = scroller.querySelector<HTMLElement>(`.${styles.resultsHeader}`);
    const topPad = (sticky?.offsetHeight ?? 56) + 12;
    const next = Math.max(0, scroller.scrollTop + (nodeRect.top - scrollerRect.top) - topPad);

    scroller.scrollTo({ top: next, behavior: 'smooth' });
    listScrollbarRef.current?.update();
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
    const start = window.setTimeout(tryScroll, isDesktop ? 0 : 120);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [selectedId, mapFocus, viewMode, results, isDesktop, scrollSelectedCardIntoView]);

  const enterMapFocus = useCallback(() => {
    setSelectedId(null);
    setHoveredId(null);
    setMapFocus(true);
  }, []);

  const exitMapFocus = useCallback(() => {
    setMapFocus(false);
  }, []);

  useEffect(() => {
    if ((location.state as ExploreLocationState | null)?.mapFocus) {
      setMapFocus(true);
      // Consume the flag so a later back-nav doesn't re-enter focus forever.
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!isDesktop || mapFocus) return;
    const node = listRef.current;
    if (!node) return;

    const scrollbar = new PerfectScrollbar(node, {
      suppressScrollX: true,
      wheelPropagation: false,
    });
    listScrollbarRef.current = scrollbar;

    const frame = requestAnimationFrame(() => scrollbar.update());

    return () => {
      cancelAnimationFrame(frame);
      try {
        scrollbar.destroy();
      } catch {
        // PerfectScrollbar can throw if the node was already detached.
      }
      listScrollbarRef.current = null;
      node.querySelectorAll('.ps__rail-x, .ps__rail-y').forEach((rail) => rail.remove());
      node.classList.remove('ps', 'ps--active-x', 'ps--active-y');
    };
  }, [isDesktop, mapFocus]);

  useEffect(() => {
    listScrollbarRef.current?.update();
  }, [results.length, viewMode]);

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
          onRecenter={enterMapFocus}
          leftInset={mapLeftInset}
          mapFullscreen={mapFocus}
          stayAnchor={anchor}
          stayLabel={preferences.stayAreaLabel}
        />
      </div>

      {mapFocus ? (
        <button type="button" className={styles.showList} onClick={exitMapFocus}>
          Show list
        </button>
      ) : isDesktop ? (
        <aside className={styles.panel} ref={panelRef}>
          <div className={styles.panelHeader}>
            <h1 className={styles.title}>Explore</h1>
            <FilterBar filters={filters} onChange={setFilters} />
          </div>
          {list}
        </aside>
      ) : (
        <Sheet snap={snap} onSnapChange={setChosenSnap}>
          <FilterBar filters={filters} onChange={setFilters} />
          {list}
        </Sheet>
      )}
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
