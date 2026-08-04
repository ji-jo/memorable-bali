import { useMemo } from 'react';

import { FerryInfo } from '@/components/FerryInfo';
import { PlaceCard } from '@/components/PlaceCard';
import { useSpots } from '@/hooks/useSpots';
import ferriesFile from '@data/ferries.json';
import type { FerryRoute } from '@/data/types';

import styles from './Ferry.module.css';

export default function Ferry() {
  const routes = ferriesFile.routes as FerryRoute[];
  const spots = useSpots();

  const islandSpots = useMemo(() => spots.filter((s) => s.region === 'nusa'), [spots]);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Getting to the Nusa Islands</h1>
        <p className={styles.lede}>
          Nusa Penida and Lembongan are a fast-boat crossing from Bali. Worth the trip —
          but the last boat back is early, and weather cancels crossings without much
          notice.
        </p>
      </header>

      <div className={styles.routes}>
        {routes.map((route) => (
          <FerryInfo key={route.id} route={route} />
        ))}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What's over there</h2>
        <div className={styles.grid}>
          {islandSpots.map((spot) => (
            <PlaceCard key={spot.id} spot={spot} />
          ))}
        </div>
      </section>
    </div>
  );
}
