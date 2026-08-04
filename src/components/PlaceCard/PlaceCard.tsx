import { Link } from 'react-router-dom';

import { SpotImage } from '@/components/SpotImage';
import { TagBadge } from '@/components/TagBadge';
import { Rating } from '@/components/Rating';
import { VisitedToggle } from '@/components/VisitedToggle';
import { formatDistance, formatDuration } from '@/lib/format';
import { useCategoryLookup } from '@/hooks/useLookups';
import type { Spot } from '@/data/types';

import styles from './PlaceCard.module.css';

export interface PlaceCardProps {
  spot: Spot;
  variant?: 'default' | 'compact' | 'wide';
  /** From the live anchor — overrides the JSON's precomputed baseline. */
  distanceKm?: number;
  showVisited?: boolean;
  selected?: boolean;
  onHover?: (spotId: string | null) => void;
  onClick?: () => void;
}

/**
 * Renders exactly: cover image, category, distance, duration, rating and the
 * 50–80 character description. Nothing else — extra metadata is what makes a
 * curated guide feel like a directory.
 */
export function PlaceCard({
  spot,
  variant = 'default',
  distanceKm,
  showVisited = true,
  selected = false,
  onHover,
  onClick,
}: PlaceCardProps) {
  const categories = useCategoryLookup();
  const category = categories.get(spot.category);
  const distance = distanceKm ?? spot.distanceFromStayKm;

  const classes = [
    styles.card,
    variant === 'compact' ? styles.compact : '',
    selected ? styles.selected : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link
      to={`/place/${spot.id}`}
      className={classes}
      onClick={onClick}
      onMouseEnter={() => onHover?.(spot.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(spot.id)}
      data-spot-id={spot.id}
    >
      <div className={styles.media}>
        <SpotImage
          src={spot.images[0]}
          alt={spot.name}
          name={spot.name}
          aspect={variant === 'wide' ? '16/9' : variant === 'compact' ? '1/1' : '4/3'}
          categoryColor={category?.color}
          rounded={variant === 'compact'}
        />
        {spot.tags[0] && (
          <div className={styles.tagSlot}>
            <TagBadge tag={spot.tags[0]} />
          </div>
        )}
        {showVisited && (
          <div className={styles.visitedSlot}>
            <VisitedToggle spotId={spot.id} />
          </div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.category}>{category?.label ?? spot.category}</div>
        <h3 className={styles.name}>{spot.name}</h3>
        <p className={styles.description}>{spot.description}</p>
        <div className={styles.meta}>
          <span className={styles.metaItem}>{formatDistance(distance)}</span>
          <span className={styles.metaItem}>{formatDuration(spot.visitDurationMin)}</span>
          <Rating value={spot.rating} />
        </div>
      </div>
    </Link>
  );
}
