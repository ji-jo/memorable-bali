import styles from './DreamFooterImage.module.css';

const DEFAULT_SRC = '/images/website/Pura%20ulun%20danau%20bratan%202.webp';
const DEFAULT_ALT = 'Pura Ulun Danu Bratan temple reflected on Lake Bratan';

export interface DreamFooterImageProps {
  className?: string;
  src?: string;
  alt?: string;
  /** Optional caption below the image. */
  caption?: string;
}

/**
 * Full-bleed footer photography — shown whole (no crop), with a subtle
 * top blend into the page and a light dream wash.
 */
export function DreamFooterImage({
  className,
  src = DEFAULT_SRC,
  alt = DEFAULT_ALT,
  caption = 'Pura Ulun Danu Bratan',
}: DreamFooterImageProps) {
  const classes = [styles.footer, className].filter(Boolean).join(' ');

  return (
    <figure className={classes}>
      <div className={styles.frame}>
        <img className={styles.image} src={src} alt={alt} loading="lazy" decoding="async" />
        <div className={styles.dreamFilter} aria-hidden="true" />
        <div className={styles.topFade} aria-hidden="true" />
        {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
      </div>
    </figure>
  );
}
