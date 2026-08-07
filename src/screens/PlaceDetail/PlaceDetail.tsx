import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Drawer } from 'vaul';
import 'vaul/style.css';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FerryInfo } from '@/components/FerryInfo';
import { MapView } from '@/components/MapView';
import { PlaceCard } from '@/components/PlaceCard';
import { Rating } from '@/components/Rating';
import { SpotImage } from '@/components/SpotImage';
import { TagBadge } from '@/components/TagBadge';
import { VisitedToggle } from '@/components/VisitedToggle';
import { sync } from '@/data/repository';
import ferriesFile from '@data/ferries.json';
import { formatCost, formatDistance, formatDuration } from '@/lib/format';
import { fetchDrivingRoute, googleDirectionsUrl } from '@/lib/navigation';
import { useSpot, useSpots } from '@/hooks/useSpots';
import { useCategoryLookup, useRegionLookup } from '@/hooks/useLookups';
import { useItinerary } from '@/state/ItineraryContext';
import { useOnboarding } from '@/state/OnboardingContext';
import type { Coordinates, FerryRoute } from '@/data/types';

import styles from './PlaceDetail.module.css';

const PEEK = 0.1;
const HALF = 0.58;
/** Full height — values < 1 leave the action bar in the off-screen translate band. */
const FULL = 1;

export default function PlaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const spot = useSpot(id);
  const allSpots = useSpots();
  const categories = useCategoryLookup();
  const regions = useRegionLookup();
  const { isInActive, addStop, removeStop } = useItinerary();
  const { anchor, preferences } = useOnboarding();
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(HALF);
  const [routePath, setRoutePath] = useState<Coordinates[] | null>(null);
  const [routeMeta, setRouteMeta] = useState<{ distanceKm: number; durationMin: number } | null>(
    null,
  );
  const handleDragRef = useRef({ moved: false });

  const nearby = useMemo(
    () => (spot ? allSpots.filter((s) => spot.nearby.includes(s.id)) : []),
    [spot, allSpots],
  );

  const ferryRoute = useMemo<FerryRoute | undefined>(
    () =>
      spot?.ferry
        ? (ferriesFile.routes as FerryRoute[]).find((r) => r.id === spot.ferry)
        : undefined,
    [spot],
  );

  useEffect(() => {
    if (!spot) {
      setRoutePath(null);
      setRouteMeta(null);
      return;
    }

    const controller = new AbortController();
    void fetchDrivingRoute(anchor, spot.coordinates, controller.signal).then((route) => {
      if (!route) {
        setRoutePath(null);
        setRouteMeta(null);
        return;
      }
      setRoutePath(route.coordinates);
      setRouteMeta({ distanceKm: route.distanceKm, durationMin: route.durationMin });
    });

    return () => controller.abort();
  }, [anchor, spot]);

  if (!spot) {
    return (
      <div className={styles.notFound}>
        <EmptyState
          title="No such place"
          message={`We have ${sync.spots().length} curated places and none of them is "${id}".`}
          action={{ label: 'Browse all', to: '/explore' }}
        />
      </div>
    );
  }

  const category = categories.get(spot.category);
  const region = regions.get(spot.region);
  const inItinerary = isInActive(spot.id);
  const snap =
    typeof activeSnapPoint === 'number' ? activeSnapPoint : HALF;
  const mapFocused = snap <= PEEK + 0.01;
  const directionsHref = googleDirectionsUrl(anchor, spot.coordinates);

  const goToExplore = () =>
    navigate('/explore', { state: { mapFocus: true } });

  const selectFromMap = (nextId: string | null) => {
    if (!nextId || nextId === spot.id) return;
    navigate(`/place/${nextId}`, { replace: true });
    // Opening another pin should lift the sheet enough to read it.
    if (mapFocused) setActiveSnapPoint(HALF);
  };

  const downsize = () => {
    if (mapFocused) {
      goToExplore();
      return;
    }
    setActiveSnapPoint(PEEK);
  };

  const handleHandleClick = () => {
    if (handleDragRef.current.moved) return;
    downsize();
  };

  return (
    <article className={styles.detail} data-map-focused={mapFocused || undefined}>
      <div className={styles.mapBackdrop}>
        <MapView
          spots={allSpots}
          center={spot.coordinates}
          zoom={14}
          selectedId={spot.id}
          onSelectSpot={selectFromMap}
          mapFullscreen
          onRecenter={goToExplore}
          fitBounds={false}
          bottomInset={snap}
          stayAnchor={anchor}
          stayLabel={preferences.stayAreaLabel}
          routePath={routePath}
        />
      </div>
      <Drawer.Root
        open
        modal={false}
        dismissible={mapFocused}
        handleOnly
        noBodyStyles
        autoFocus={false}
        snapPoints={[PEEK, HALF, FULL]}
        activeSnapPoint={activeSnapPoint}
        setActiveSnapPoint={setActiveSnapPoint}
        fadeFromIndex={1}
        snapToSequentialPoint={false}
        onOpenChange={(open) => {
          // Dragging the peek sheet off-screen returns to the map-first Explore.
          if (!open) goToExplore();
        }}
      >
        <Drawer.Portal>
          <Drawer.Content
            className={styles.sheet}
            data-active-snap-point={activeSnapPoint}
          >
            <Drawer.Handle
              preventCycle
              className={styles.handle}
              aria-label={mapFocused ? 'Back to explore' : 'Drag to resize'}
              // Use capture so we don't replace Vaul's onPointerDown/onDrag (handleOnly).
              onPointerDownCapture={() => {
                handleDragRef.current.moved = false;
              }}
              onPointerMoveCapture={(event) => {
                if (Math.abs(event.movementY) > 3) {
                  handleDragRef.current.moved = true;
                }
              }}
              onClick={handleHandleClick}
            />
            <div
              className={`${styles.sheetScroll} scroll-mask-b`}
              data-vaul-no-drag=""
            >
              <div className={styles.hero}>
                <SpotImage
                  src={spot.images[0]}
                  alt={spot.name}
                  name={spot.name}
                  aspect="16/9"
                  priority
                  categoryColor={category?.color}
                />
                <button
                  type="button"
                  className={styles.back}
                  onClick={goToExplore}
                  aria-label="Back to explore"
                >
                  <ArrowLeftIcon aria-hidden="true" weight="regular" />
                </button>
              </div>

              <div className={styles.body}>
                <header className={styles.header}>
                  <div className={styles.tags}>
                    {spot.tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} size="md" />
                    ))}
                  </div>
                  <Drawer.Title asChild>
                    <h1 className={styles.name}>{spot.name}</h1>
                  </Drawer.Title>
                  <div className={styles.subline}>
                    <span>{category?.label}</span>
                    <span aria-hidden="true">·</span>
                    <span>{region?.label}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDistance(spot.distanceFromStayKm)}</span>
                    <Rating value={spot.rating} size="md" />
                  </div>
                </header>

                <Drawer.Description asChild>
                  <p className={styles.longDescription}>{spot.longDescription}</p>
                </Drawer.Description>

                <section className={styles.practical} aria-label="Practical information">
                  <div className={styles.practicalItem}>
                    <span className={styles.practicalLabel}>Hours</span>
                    <span className={styles.practicalValue}>
                      {spot.openingHours.open
                        ? `${spot.openingHours.open}–${spot.openingHours.close}`
                        : spot.openingHours.note}
                    </span>
                    {spot.openingHours.open && (
                      <span className={styles.practicalNote}>{spot.openingHours.note}</span>
                    )}
                  </div>
                  <div className={styles.practicalItem}>
                    <span className={styles.practicalLabel}>Allow</span>
                    <span className={styles.practicalValue}>
                      {formatDuration(spot.visitDurationMin)}
                    </span>
                  </div>
                  <div className={styles.practicalItem}>
                    <span className={styles.practicalLabel}>Cost</span>
                    <span className={styles.practicalValue}>{formatCost(spot.cost)}</span>
                    <span className={styles.practicalNote}>{spot.cost.note}</span>
                  </div>
                  <div className={styles.practicalItem}>
                    <span className={styles.practicalLabel}>Best time</span>
                    <span className={styles.practicalValue}>{spot.bestTime}</span>
                  </div>
                </section>

                <section className={styles.tips} aria-labelledby="tips-heading">
                  <p className={styles.tipsKicker}>Field notes</p>
                  <h2 id="tips-heading" className={styles.tipsTitle}>
                    Local tips
                  </h2>
                  <ul className={styles.tipsList}>
                    {spot.tips.map((tip) => (
                      <li key={tip} className={styles.tip}>
                        {tip}
                      </li>
                    ))}
                  </ul>

                  <div className={styles.plan} aria-label="Plan this visit">
                    <div className={styles.planActions}>
                      <VisitedToggle spotId={spot.id} variant="button" />
                      <Button
                        variant={inItinerary ? 'secondary' : 'primary'}
                        onClick={() => (inItinerary ? removeStop(spot.id) : addStop(spot))}
                      >
                        {inItinerary ? 'Remove from trip' : 'Add to trip'}
                      </Button>
                    </div>

                    <div className={styles.planLinks}>
                      <a
                        href={directionsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.planLink}
                      >
                        Navigate from {preferences.stayAreaLabel}
                        <span aria-hidden="true">↗</span>
                      </a>
                      <a
                        href={spot.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.planLinkMuted}
                      >
                        Open Google
                        <span aria-hidden="true">↗</span>
                      </a>
                    </div>

                    {routeMeta ? (
                      <p className={styles.routeMeta}>
                        Drive preview · {routeMeta.distanceKm} km ·{' '}
                        {formatDuration(routeMeta.durationMin)}
                      </p>
                    ) : null}

                    {inItinerary ? (
                      <Link to="/itinerary" className={styles.tripLink}>
                        View your trip →
                      </Link>
                    ) : null}
                  </div>
                </section>

                {ferryRoute && (
                  <section className={styles.section} aria-label="Getting there by boat">
                    <h2 className={styles.sectionTitle}>Getting there</h2>
                    <FerryInfo route={ferryRoute} />
                  </section>
                )}

                {nearby.length > 0 && (
                  <section className={styles.section} aria-label="Nearby places">
                    <h2 className={styles.sectionTitle}>Nearby</h2>
                    <div className={styles.nearbyRail}>
                      {nearby.map((s) => (
                        <PlaceCard key={s.id} spot={s} variant="compact" showVisited={false} />
                      ))}
                    </div>
                  </section>
                )}

                <p className={styles.disclaimer}>
                  Rating is our editorial score, not a Google rating. Hours and prices are
                  indicative and unverified — check before you travel.
                </p>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </article>
  );
}
