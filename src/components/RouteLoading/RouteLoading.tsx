import { useEffect, useState } from 'react';

import { Loader } from '@/components/motion/loader';
import { cn } from '@/lib/utils';

import styles from './RouteLoading.module.css';

const PHRASES = [
  'Finding your way',
  'Mapping the island',
  'Gathering places',
  'Almost ready',
];

/** Suspense fallback — dither loader + solid dark-gray copy (no shimmer glass). */
export function RouteLoading() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % PHRASES.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={styles.root} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.row}>
        <Loader
          variant="dither"
          size={18}
          speed={1.1}
          label="Loading"
          className={cn('text-muted-foreground', styles.loader)}
        />
        <p className={styles.text}>{PHRASES[index]}…</p>
      </div>
    </div>
  );
}
