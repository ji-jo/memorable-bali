import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import type { MouseEvent } from 'react';
import { ArrowsOutSimpleIcon } from '@phosphor-icons/react/dist/csr/ArrowsOutSimple';

import { SpotImage } from '@/components/SpotImage';
import { TagBadge } from '@/components/TagBadge';
import { Rating } from '@/components/Rating';
import { VisitedToggle } from '@/components/VisitedToggle';
import { formatDistance, formatDuration } from '@/lib/format';
import { useCategoryLookup } from '@/hooks/useLookups';
import type { Spot } from '@/data/types';

import styles from './PlaceCard.module.css';

const MotionLink = motion(Link);

export interface PlaceCardProps {
  spot: Spot;
  variant?: 'default' | 'compact' | 'wide' | 'feature' | 'grid';
  /** From the live anchor — overrides the JSON's precomputed baseline. */
  distanceKm?: number;
  showVisited?: boolean;
  selected?: boolean;
  onHover?: (spotId: string | null) => void;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
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
    variant === 'wide' ? styles.wide : '',
    variant === 'feature' ? styles.feature : '',
    variant === 'grid' ? styles.grid : '',
    selected ? styles.selected : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hoverMotion =
    variant === 'grid'
      ? { scale: 1.02 }
      : { transform: 'translateY(-2px)' };

  return (
    <MotionLink
      to={`/place/${spot.id}`}
      className={classes}
      onClick={onClick}
      onMouseEnter={() => onHover?.(spot.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(spot.id)}
      data-spot-id={spot.id}
      data-selected={selected ? 'true' : undefined}
      aria-current={selected ? 'true' : undefined}
      aria-label={selected ? `${spot.name}, tap again to open` : undefined}
      whileHover={hoverMotion}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className={styles.media}>
        <SpotImage
          src={spot.images[0]}
          alt={spot.name}
          name={spot.name}
          priority={variant === 'feature'}
          className={variant === 'feature' ? styles.featureImage : undefined}
          aspect={
            variant === 'wide' || variant === 'feature'
              ? '16/9'
              : variant === 'compact' || variant === 'grid'
                ? '1/1'
                : '4/3'
          }
          categoryColor={category?.color}
          rounded={variant === 'compact'}
        />
        {selected ? (
          <span className={styles.expandHint} aria-hidden="true">
            <span className={styles.expandHintCircle}>
              <ArrowsOutSimpleIcon size={18} weight="bold" />
            </span>
          </span>
        ) : null}
        {spot.tags[0] && variant !== 'grid' && (
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
          {variant !== 'grid' && (
            <span className={styles.metaItem}>{formatDuration(spot.visitDurationMin)}</span>
          )}
          <Rating value={spot.rating} />
        </div>
      </div>
    </MotionLink>
  );
}
