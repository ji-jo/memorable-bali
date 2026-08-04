import { formatRating } from '@/lib/format';
import styles from './Rating.module.css';

export interface RatingProps {
  value: number;
  showNumber?: boolean;
  size?: 'sm' | 'md';
}

/**
 * ⚠️ `rating` is an editorial placeholder, NOT a scraped Google rating
 * (docs/03-Data-Model.md). The `title` makes that explicit on hover so the
 * stars are never mistaken for Google's.
 */
export function Rating({ value, showNumber = true, size = 'sm' }: RatingProps) {
  return (
    <span
      className={`${styles.rating} ${styles[size]}`}
      aria-label={`Rated ${formatRating(value)} out of 5`}
      title="Editorial rating — not a Google rating"
    >
      <span className={styles.star} aria-hidden="true">
        ★
      </span>
      {showNumber && <span className={styles.value}>{formatRating(value)}</span>}
    </span>
  );
}
