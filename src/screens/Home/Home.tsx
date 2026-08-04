import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Chip } from '@/components/Chip';
import { PlaceCard } from '@/components/PlaceCard';
import { Section } from '@/components/Section';
import { SearchOverlay } from '@/components/SearchOverlay';
import { ThemeToggle } from '@/components/ThemeToggle';
import { dailyShuffle, matchesInterests, sortByDistance, sortByRating } from '@/data/queries';
import { useSpots } from '@/hooks/useSpots';
import { useCategoryLookup } from '@/hooks/useLookups';
import { useOnboarding } from '@/state/OnboardingContext';
import categoriesFile from '@data/categories.json';
import type { OnboardingInterest } from '@/data/types';

import styles from './Home.module.css';

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  const spots = useSpots();
  const categories = useCategoryLookup();
  const { preferences } = useOnboarding();
  const interests = categoriesFile.onboardingInterests as OnboardingInterest[];

  const matching = useMemo(
    () => spots.filter((s) => matchesInterests(s, preferences.interests, interests)),
    [spots, preferences.interests, interests],
  );

  // Date-seeded so the rail is stable within a day but changes daily.
  const recommended = useMemo(
    () => dailyShuffle(sortByRating(matching).slice(0, 20)).slice(0, 6),
    [matching],
  );

  const hiddenGems = useMemo(
    () =>
      spots
        .filter((s) => s.category === 'hidden-gems' || s.tags.includes('Outworldly'))
        .slice(0, 8),
    [spots],
  );

  // Not "Trending" — with no backend there is no trend signal, and implying
  // analytics we do not have would be dishonest (docs/01-PRD.md §F3).
  const editorsPicks = useMemo(() => sortByRating(spots).slice(0, 6), [spots]);

  const nearby = useMemo(() => sortByDistance(spots).slice(0, 6), [spots]);

  return (
    <div className={styles.home}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.greeting}>Staying in {preferences.stayAreaLabel}</p>
            <h1 className={styles.title}>Where to today?</h1>
          </div>
          {/* The AppShell's top bar is hidden below --bp-md, so without this
              mobile users would have no way to change theme at all. */}
          <div className={styles.themeSlot}>
            <ThemeToggle />
          </div>
        </div>
        <button
          type="button"
          className={styles.searchTrigger}
          onClick={() => setSearchOpen(true)}
        >
          <span aria-hidden="true">⌕</span>
          Search {spots.length} curated places
        </button>
      </header>

      <div className={styles.categoryRail}>
        {[...categories.values()].map((category) => (
          <Link key={category.id} to={`/explore?category=${category.id}`}>
            <Chip label={category.label} color={category.color} showDot />
          </Link>
        ))}
      </div>

      <Section
        title="Recommended today"
        subtitle="Matched to what you said you're into"
        action={{ label: 'See all', to: '/explore' }}
        scrollable
      >
        {recommended.map((spot) => (
          <PlaceCard key={spot.id} spot={spot} />
        ))}
      </Section>

      <Section
        title="Hidden gems"
        subtitle="Quieter places that reward the extra effort"
        action={{ label: 'See all', to: '/explore?category=hidden-gems' }}
        scrollable
      >
        {hiddenGems.map((spot) => (
          <PlaceCard key={spot.id} spot={spot} />
        ))}
      </Section>

      <Section
        title="Editor's picks"
        subtitle="Our highest-rated, chosen by hand — not by traffic"
        scrollable
      >
        {editorsPicks.map((spot) => (
          <PlaceCard key={spot.id} spot={spot} />
        ))}
      </Section>

      <Section
        title={`Nearest to ${preferences.stayAreaLabel}`}
        subtitle="Straight-line distance — Bali roads run longer"
        action={{ label: 'Open map', to: '/explore' }}
        scrollable
      >
        {nearby.map((spot) => (
          <PlaceCard key={spot.id} spot={spot} />
        ))}
      </Section>

      <div className={styles.mapPromo}>
        <div>
          <h2 className={styles.mapPromoTitle}>See everything on the map</h2>
          <p className={styles.mapPromoText}>
            All {spots.length} places, filterable by category, distance and time.
          </p>
        </div>
        <Link to="/explore" className={styles.mapPromoLink}>
          Open Explore
        </Link>
      </div>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
