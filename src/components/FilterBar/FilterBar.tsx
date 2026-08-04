import { Chip } from '@/components/Chip';
import { useCategoryLookup, useRegionLookup } from '@/hooks/useLookups';
import type { ExploreFilters, SpotTag } from '@/data/types';
import styles from './FilterBar.module.css';

export interface FilterBarProps {
  filters: ExploreFilters;
  onChange: (next: ExploreFilters) => void;
  resultCount: number;
}

const TAGS: SpotTag[] = ['Memorable', 'Must Visit', 'Cultural', 'Outworldly'];
const DISTANCES = [10, 25, 50];

export function FilterBar({ filters, onChange, resultCount }: FilterBarProps) {
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
      <div className={styles.scroller}>
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
      </div>

      <div className={styles.scroller}>
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
      </div>

      <div className={styles.status}>
        <span aria-live="polite">
          {resultCount} place{resultCount === 1 ? '' : 's'}
        </span>
        {hasActive && (
          <button type="button" className={styles.clear} onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
