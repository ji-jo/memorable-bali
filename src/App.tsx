import { useEffect, useState } from 'react';

import { getCategories, getDefaultAnchor, getSpots } from '@/data/repository';
import { sortByDistance, withDistances } from '@/data/queries';
import { formatDistance, formatDuration, formatRating } from '@/lib/format';
import { useTheme, useThemeCycle } from '@/state/ThemeContext';
import type { Category, Spot } from '@/data/types';

import styles from './App.module.css';

/**
 * Scaffold smoke screen — phase 1 of docs/11-Cloud-Code-Prompt.md.
 *
 * This proves the foundation works end to end: tokens render in both themes,
 * the repository seam loads real data, distances compute, formatting helpers
 * behave. It is NOT the Home screen — that arrives in phase 5, along with
 * routing, the component library and the Explore map.
 */
export default function App() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { preference, resolved } = useTheme();
  const cycleTheme = useThemeCycle();

  useEffect(() => {
    void (async () => {
      const [allSpots, allCategories] = await Promise.all([getSpots(), getCategories()]);
      setSpots(sortByDistance(withDistances(allSpots, getDefaultAnchor())));
      setCategories(allCategories);
    })();
  }, []);

  const colorFor = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.color ?? 'var(--color-accent)';

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Memorable Bali</h1>
          <p className={styles.subtitle}>
            Foundation scaffold — data layer, tokens and theming verified.
          </p>
        </div>
        <button
          type="button"
          className={styles.themeButton}
          onClick={cycleTheme}
          aria-label={`Theme: ${preference}. Click to change.`}
        >
          {preference === 'system' ? `System (${resolved})` : preference}
        </button>
      </header>

      <div className={styles.statusGrid}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{spots.length}</div>
          <div className={styles.statLabel}>Curated places</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{categories.length}</div>
          <div className={styles.statLabel}>Categories</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{resolved}</div>
          <div className={styles.statLabel}>Active theme</div>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Nearest to Ubud</h2>
      <ul className={styles.list} role="list">
        {spots.slice(0, 8).map((spot) => (
          <li key={spot.id} className={styles.card}>
            <div
              className={styles.thumb}
              style={{ ['--thumb-color' as string]: colorFor(spot.category) }}
              aria-hidden="true"
            >
              {spot.name.charAt(0)}
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardName}>{spot.name}</div>
              <div className={styles.cardDesc}>{spot.description}</div>
              <div className={styles.cardMeta}>
                <span>{spot.category}</span>
                <span>{formatDistance(spot.distanceFromStayKm)}</span>
                <span>{formatDuration(spot.visitDurationMin)}</span>
                <span>★ {formatRating(spot.rating)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className={styles.note}>
        Ratings shown are editorial placeholders, not Google ratings. Coordinates,
        hours and prices are unverified — see <code>docs/03-Data-Model.md</code>.
        Place images do not exist yet; the coloured tiles above stand in for the
        gradient fallback that <code>SpotImage</code> will provide.
      </p>
    </div>
  );
}
