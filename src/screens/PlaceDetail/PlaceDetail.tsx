import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FerryInfo } from '@/components/FerryInfo';
import { PlaceCard } from '@/components/PlaceCard';
import { Rating } from '@/components/Rating';
import { SpotImage } from '@/components/SpotImage';
import { TagBadge } from '@/components/TagBadge';
import { VisitedToggle } from '@/components/VisitedToggle';
import { sync } from '@/data/repository';
import ferriesFile from '@data/ferries.json';
import { formatCost, formatDistance, formatDuration } from '@/lib/format';
import { useSpot, useSpots } from '@/hooks/useSpots';
import { useCategoryLookup, useRegionLookup } from '@/hooks/useLookups';
import { useItinerary } from '@/state/ItineraryContext';
import type { FerryRoute } from '@/data/types';

import styles from './PlaceDetail.module.css';

export default function PlaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const spot = useSpot(id);
  const allSpots = useSpots();
  const categories = useCategoryLookup();
  const regions = useRegionLookup();
  const { isInActive, addStop, removeStop } = useItinerary();

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

  return (
    <article className={styles.detail}>
      <div className={styles.hero}>
        <SpotImage
          src={spot.images[0]}
          alt={spot.name}
          name={spot.name}
          aspect="16/9"
          priority
          categoryColor={category?.color}
        />
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
      </div>

      <div className={styles.body}>
        <header className={styles.header}>
          <div className={styles.tags}>
            {spot.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} size="md" />
            ))}
          </div>
          <h1 className={styles.name}>{spot.name}</h1>
          <div className={styles.subline}>
            <span>{category?.label}</span>
            <span aria-hidden="true">·</span>
            <span>{region?.label}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDistance(spot.distanceFromStayKm)}</span>
            <Rating value={spot.rating} size="md" />
          </div>
        </header>

        <p className={styles.longDescription}>{spot.longDescription}</p>

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
            <span className={styles.practicalValue}>{formatDuration(spot.visitDurationMin)}</span>
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

        {/* The highest-value content on the page. Do not bury it. */}
        <section className={styles.tips} aria-labelledby="tips-heading">
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

      <div className={styles.actionBar}>
        <VisitedToggle spotId={spot.id} variant="button" />
        <Button
          variant={inItinerary ? 'secondary' : 'primary'}
          onClick={() => (inItinerary ? removeStop(spot.id) : addStop(spot))}
        >
          {inItinerary ? 'Remove from trip' : 'Add to trip'}
        </Button>
        <a
          href={spot.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.mapsLink}
        >
          Open in Maps ↗
        </a>
      </div>

      {inItinerary && (
        <Link to="/itinerary" className={styles.tripLink}>
          View your trip →
        </Link>
      )}
    </article>
  );
}
