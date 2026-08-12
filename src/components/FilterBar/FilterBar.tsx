import { useRef, type ReactNode } from 'react';

import { Chip } from '@/components/Chip';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { MapPinIcon } from '@phosphor-icons/react/dist/csr/MapPin';
import { ShapesIcon } from '@phosphor-icons/react/dist/csr/Shapes';
import { SlidersHorizontalIcon } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import { useCategoryLookup, useRegionLookup } from '@/hooks/useLookups';
import { useHorizontalScrollOverflow } from '@/hooks/useHorizontalScrollOverflow';
import type { ExploreFilters, SpotTag } from '@/data/types';
import styles from './FilterBar.module.css';

export interface FilterBarProps {
  filters: ExploreFilters;
  onChange: (next: ExploreFilters) => void;
}

const TAGS: SpotTag[] = ['Memorable', 'Must Visit', 'Cultural', 'Outworldly'];
const DISTANCES = [10, 25, 50];

interface FilterScrollerProps {
  ariaLabel: string;
  children: ReactNode;
}

function FilterScroller({ ariaLabel, children }: FilterScrollerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { canScrollLeft, canScrollRight } = useHorizontalScrollOverflow(scrollerRef, [children]);

  return (
    <div className={styles.scrollerWrap}>
      <div
        ref={scrollerRef}
        className={[
          styles.scroller,
          canScrollLeft ? 'scroll-mask-l' : '',
          canScrollRight ? 'scroll-mask-r' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={ariaLabel}
      >
        {children}
      </div>
      {canScrollRight ? (
        <button
          type="button"
          className={styles.scrollChevron}
          aria-label={`Show more ${ariaLabel.toLowerCase()}`}
          onClick={() => scrollerRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}
        >
          <CaretRightIcon aria-hidden="true" weight="bold" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const categories = useCategoryLookup();
  const regions = useRegionLookup();

  const hasActive =
    filters.category !== null ||
    filters.region !== null ||
    filters.tags.length > 0 ||
    filters.maxKm !== null;

  const clearAll = () =>
    onChange({ category: null, tags: [], region: null, maxKm: null, maxDurationMin: null });

  const toggleTag = (tag: SpotTag) =>
    onChange({
      ...filters,
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    });

  return (
    <div className={styles.bar}>
      <div className={styles.filterGroup}>
        <div className={styles.filterLabel}>
          <ShapesIcon aria-hidden="true" weight="regular" />
          <span>Place type</span>
        </div>
        <FilterScroller ariaLabel="Filter by place type">
          {[...categories.values()].map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              color={c.color}
              showDot
              selected={filters.category === c.id}
              onToggle={() =>
                onChange({ ...filters, category: filters.category === c.id ? null : c.id })
              }
            />
          ))}
        </FilterScroller>
      </div>

      <div className={styles.filterGroup}>
        <div className={styles.filterLabel}>
          <MapPinIcon aria-hidden="true" weight="regular" />
          <span>Location</span>
        </div>
        <FilterScroller ariaLabel="Filter by location">
          {[...regions.values()].map((r) => (
            <Chip
              key={r.id}
              label={r.label}
              selected={filters.region === r.id}
              onToggle={() =>
                onChange({ ...filters, region: filters.region === r.id ? null : r.id })
              }
            />
          ))}
        </FilterScroller>
      </div>

      <div className={styles.filterGroup}>
        <div className={styles.filterLabel}>
          <SlidersHorizontalIcon aria-hidden="true" weight="regular" />
          <span>Refine</span>
        </div>
        <FilterScroller ariaLabel="Refine results">
          {TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={filters.tags.includes(tag)}
              onToggle={() => toggleTag(tag)}
            />
          ))}
          {DISTANCES.map((km) => (
            <Chip
              key={km}
              label={`Within ${km} km`}
              selected={filters.maxKm === km}
              onToggle={() => onChange({ ...filters, maxKm: filters.maxKm === km ? null : km })}
            />
          ))}
        </FilterScroller>
      </div>

      {hasActive && (
        <div className={styles.status}>
          <button type="button" className={styles.clear} onClick={clearAll}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
