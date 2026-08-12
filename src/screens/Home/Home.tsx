import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { MapTrifoldIcon } from '@phosphor-icons/react/dist/csr/MapTrifold';
import { Compass, MapPin, Search, Tag } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { Chip } from '@/components/Chip';
import { DreamFooterImage } from '@/components/DreamFooterImage/DreamFooterImage';
import { PlaceCard } from '@/components/PlaceCard';
import { Section } from '@/components/Section';
import { StayAreaSelect } from '@/components/StayAreaSelect/StayAreaSelect';
import { SunRayShader } from '@/components/SunRayShader';
import { CommandPalette } from '@/components/motion/command-palette';
import { dailyShuffle, matchesInterests, sortByDistance, sortByRating } from '@/data/queries';
import { useSpots } from '@/hooks/useSpots';
import { useCategoryLookup } from '@/hooks/useLookups';
import { useHorizontalScrollOverflow } from '@/hooks/useHorizontalScrollOverflow';
import { EASE_OUT, SPRING_PRESS } from '@/lib/ease';
import { shortStayLabel } from '@/lib/stay-location';
import { useOnboarding } from '@/state/OnboardingContext';
import categoriesFile from '@data/categories.json';
import type { OnboardingInterest } from '@/data/types';

import styles from './Home.module.css';

const MAP_PROMO_IMAGE = '/images/website/bali-map-promo.jpg';

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapPromoHovered, setMapPromoHovered] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const navigate = useNavigate();
  const categoryRailRef = useRef<HTMLDivElement>(null);
  const spots = useSpots();
  const categories = useCategoryLookup();
  const { preferences, isOnboarded } = useOnboarding();
  const interests = categoriesFile.onboardingInterests as OnboardingInterest[];
  const {
    canScrollLeft: canScrollCategoriesLeft,
    canScrollRight: canScrollCategoriesRight,
  } = useHorizontalScrollOverflow(categoryRailRef, [categories]);

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

  const leadSpot = recommended[0] ?? editorsPicks[0];
  const closeBy = nearby.filter((spot) => spot.id !== leadSpot?.id).slice(0, 4);
  const forToday = recommended.filter((spot) => spot.id !== leadSpot?.id).slice(0, 5);
  const fieldNotes = [hiddenGems[0], editorsPicks[0], nearby[0]]
    .filter((spot): spot is NonNullable<typeof spot> => Boolean(spot))
    .filter((spot, index, list) => list.findIndex((item) => item.id === spot.id) === index)
    .slice(0, 3);

  const searchItems = useMemo(
    () => [
      ...[...categories.values()].map((category) => ({
        id: `category-${category.id}`,
        label: `Explore ${category.label}`,
        group: 'Categories',
        icon: Tag,
        keywords: [category.id, category.description],
        onSelect: () => navigate(`/explore?category=${category.id}`),
      })),
      ...spots.map((spot) => ({
        id: spot.id,
        label: spot.name,
        group: 'Places',
        icon: spot.category === 'beaches' ? Compass : MapPin,
        keywords: [spot.category, spot.region, ...spot.tags, spot.description],
        onSelect: () => navigate(`/place/${spot.id}`),
      })),
    ],
    [categories, navigate, spots],
  );

  const scrollCategories = (direction: number) => {
    categoryRailRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' });
  };

  return (
    <div className={styles.page}>
      <SunRayShader />
      <motion.div
        className={styles.home}
        initial={{ opacity: 0, transform: 'translateY(8px)' }}
        animate={{ opacity: 1, transform: 'translateY(0)' }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      >
      <motion.header
        className={styles.header}
        initial={{ opacity: 0, transform: 'translateY(-6px)' }}
        animate={{ opacity: 1, transform: 'translateY(0)' }}
        transition={{ duration: 0.3, delay: 0.04, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className={styles.headerRow}>
          <div>
            <div className={styles.greetingRow}>
              <span className={styles.greeting}>Based in</span>
              <StayAreaSelect />
            </div>
            <h1 className={styles.title}>Where to today?</h1>
          </div>
        </div>
        <motion.button
          type="button"
          className={styles.searchTrigger}
          onClick={() => setSearchOpen(true)}
          whileTap={{ scale: 0.985 }}
        >
          <Search aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>Search {spots.length} curated places</span>
          <kbd className={styles.searchShortcut}>⌘ K</kbd>
        </motion.button>
      </motion.header>

      <motion.div
        className={styles.mapPromo}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.02, ease: EASE_OUT }}
        onHoverStart={() => setMapPromoHovered(true)}
        onHoverEnd={() => setMapPromoHovered(false)}
        onFocusCapture={() => setMapPromoHovered(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setMapPromoHovered(false);
          }
        }}
      >
        <motion.div
          className={styles.mapPromoPreview}
          initial={false}
          animate={{ opacity: mapPromoHovered ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0.06 : 0.14, ease: EASE_OUT }}
          aria-hidden="true"
        >
          <img
            className={styles.mapPromoPreviewImage}
            src={MAP_PROMO_IMAGE}
            alt=""
            draggable={false}
          />
          <div className={styles.mapPromoPreviewScrim} />
        </motion.div>

        <div className={styles.mapPromoGlow} aria-hidden="true" />
        <div className={styles.mapPromoBody}>
          <motion.div
            className={styles.mapPromoIcon}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.16 }}
          >
            <MapTrifoldIcon size={22} weight="duotone" aria-hidden="true" />
          </motion.div>
          <div className={styles.mapPromoCopy}>
            <motion.p
              className={styles.mapPromoKicker}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.14, ease: EASE_OUT }}
            >
              All {spots.length} places
            </motion.p>
            <motion.h2
              className={styles.mapPromoTitle}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.18, ease: EASE_OUT }}
            >
              See how Bali fits together.
            </motion.h2>
            <motion.p
              className={styles.mapPromoText}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.22, ease: EASE_OUT }}
            >
              Compare distance, region and place type without losing the map.
            </motion.p>
          </div>
          <motion.div
            className={styles.mapPromoAction}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.26, ease: EASE_OUT }}
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={SPRING_PRESS}>
              <Link to="/explore" className={styles.mapPromoLink}>
                Open the map
                <CaretRightIcon aria-hidden="true" weight="bold" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      <div className={styles.categoryRailWrap}>
        {canScrollCategoriesLeft ? (
          <button
            type="button"
            className={styles.categoryChevron}
            onClick={() => scrollCategories(-1)}
            aria-label="Previous categories"
          >
            <CaretLeftIcon aria-hidden="true" weight="bold" />
          </button>
        ) : null}
        <div
          className={[
            styles.categoryRail,
            canScrollCategoriesLeft ? 'scroll-mask-l' : '',
            canScrollCategoriesRight ? 'scroll-mask-r' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          ref={categoryRailRef}
        >
          {[...categories.values()].map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, transform: 'translateX(10px)' }}
              animate={{ opacity: 1, transform: 'translateX(0)' }}
              transition={{ duration: 0.25, delay: index * 0.025, ease: [0.23, 1, 0.32, 1] }}
            >
              <Link to={`/explore?category=${category.id}`}>
                <Chip label={category.label} color={category.color} showDot />
              </Link>
            </motion.div>
          ))}
        </div>
        {canScrollCategoriesRight ? (
          <button
            type="button"
            className={`${styles.categoryChevron} ${styles.categoryChevronEnd}`}
            onClick={() => scrollCategories(1)}
            aria-label="Next categories"
          >
            <CaretRightIcon aria-hidden="true" weight="bold" />
          </button>
        ) : null}
      </div>

      <section className={styles.leadSection}>
        <div className={styles.sectionIntro}>
          <p className={styles.sectionKicker}>
            {isOnboarded ? `Curated from ${shortStayLabel(preferences.stayAreaLabel)}` : 'A considered starting point'}
          </p>
          <h2 className={styles.sectionTitle}>Start with one good idea.</h2>
          <p className={styles.sectionCopy}>
            One strong idea for the day, followed by a few useful alternatives.
          </p>
        </div>

        <div className={styles.leadGrid}>
          {leadSpot && <PlaceCard spot={leadSpot} variant="feature" />}
          <aside className={styles.nearbyPanel} aria-labelledby="nearby-heading">
            <div className={styles.nearbyHeader}>
              <div>
                <p className={styles.nearbyKicker}>Near you now</p>
                <h3 id="nearby-heading" className={styles.nearbyTitle}>
                  {isOnboarded ? `Easy starts from ${shortStayLabel(preferences.stayAreaLabel)}` : 'A few easy starts'}
                </h3>
              </div>
              <Link to="/explore" className={styles.textLink}>
                Map
              </Link>
            </div>
            <div className={styles.nearbyList}>
              {closeBy.map((spot) => (
                <PlaceCard key={spot.id} spot={spot} variant="compact" showVisited={false} />
              ))}
            </div>
          </aside>
        </div>
      </section>

      <Section
        title="For today"
        subtitle="A short list shaped around your interests"
        action={{ label: 'Browse all', to: '/explore' }}
        scrollable
      >
        {forToday.map((spot) => (
          <PlaceCard key={spot.id} spot={spot} />
        ))}
      </Section>

      <section className={styles.notesSection}>
        <div className={styles.sectionIntro}>
          <p className={styles.sectionKicker}>Pick a direction</p>
          <h2 className={styles.sectionTitle}>Quiet, iconic, or close by.</h2>
          <p className={styles.sectionCopy}>
            Three ways to decide without scrolling through all {spots.length} places.
          </p>
        </div>
        <div className={styles.notesGrid}>
          {fieldNotes.map((spot) => (
            <PlaceCard key={spot.id} spot={spot} variant="wide" />
          ))}
        </div>
      </section>

      </motion.div>

      <DreamFooterImage />

      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        shortcut="k"
        placeholder="Search places, categories, regions…"
        emptyMessage="No curated places match that search."
        items={searchItems}
      />
    </div>
  );
}
