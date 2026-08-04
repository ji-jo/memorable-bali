import { useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './SpotImage.module.css';

export interface SpotImageProps {
  src?: string;
  alt: string;
  aspect?: '4/3' | '16/9' | '21/9' | '1/1';
  /** Skips lazy loading. Use for above-the-fold heroes only. */
  priority?: boolean;
  /** Seeds the fallback gradient. Pass the category colour. */
  categoryColor?: string;
  /** First letter shown on the fallback. */
  name?: string;
  rounded?: boolean;
  className?: string;
}

const ASPECT_CLASS = {
  '4/3': styles.a4x3,
  '16/9': styles.a16x9,
  '21/9': styles.a21x9,
  '1/1': styles.a1x1,
} as const;

/**
 * Required wherever a spot image renders.
 *
 * The image assets referenced by the dataset do not exist in this repo yet
 * (docs/03-Data-Model.md), so the gradient fallback below is what users
 * actually see on first build. It is the real UI, not an error state.
 */
export function SpotImage({
  src,
  alt,
  aspect = '4/3',
  priority = false,
  categoryColor = '#C0553B',
  name,
  rounded = false,
  className,
}: SpotImageProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  const classes = [
    styles.wrapper,
    ASPECT_CLASS[aspect],
    rounded ? styles.rounded : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={{ containerType: 'inline-size' }}>
      {!showFallback && (
        <img
          className={styles.image}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      {showFallback && (
        <div
          className={styles.fallback}
          style={{ ['--fallback-color']: categoryColor } as CSSProperties}
          role="img"
          aria-label={alt}
        >
          <span className={styles.initial} aria-hidden="true">
            {(name ?? alt).charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
