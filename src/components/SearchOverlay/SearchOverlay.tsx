import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { PlaceCard } from '@/components/PlaceCard';
import { searchSpots } from '@/data/queries';
import { useSpots } from '@/hooks/useSpots';
import { useLabelLookups, useCategoryLookup } from '@/hooks/useLookups';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { StorageKeys } from '@/lib/storage';

import styles from './SearchOverlay.module.css';

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const MAX_RECENT = 5;

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useLocalStorage<string[]>(StorageKeys.recentSearches, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const spots = useSpots();
  const labels = useLabelLookups();
  const categories = useCategoryLookup();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setQuery('');
      setDebounced('');
      setActiveIndex(0);
    }
  }, [open]);

  const results = useMemo(
    () => searchSpots(spots, debounced, labels).slice(0, 12),
    [spots, debounced, labels],
  );

  useEffect(() => setActiveIndex(0), [debounced]);

  if (!open) return null;

  const openSpot = (id: string, term: string) => {
    if (term.trim()) {
      setRecent((prev) => [term, ...prev.filter((r) => r !== term)].slice(0, MAX_RECENT));
    }
    onClose();
    navigate(`/place/${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) openSpot(target.id, query);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Search places">
      <div className={styles.bar}>
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          placeholder="Search places, categories, regions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Search places"
          aria-controls="search-results"
        />
        <button type="button" className={styles.cancel} onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className={styles.results} id="search-results">
        <p className={styles.count} aria-live="polite">
          {debounced ? `${results.length} result${results.length === 1 ? '' : 's'}` : ''}
        </p>

        {!debounced && (
          <>
            {recent.length > 0 && (
              <div className={styles.block}>
                <p className={styles.blockTitle}>Recent</p>
                <div className={styles.chips}>
                  {recent.map((term) => (
                    <Chip key={term} label={term} onToggle={() => setQuery(term)} />
                  ))}
                </div>
              </div>
            )}
            <div className={styles.block}>
              <p className={styles.blockTitle}>Browse by category</p>
              <div className={styles.chips}>
                {[...categories.values()].map((c) => (
                  <Chip
                    key={c.id}
                    label={c.label}
                    color={c.color}
                    showDot
                    onToggle={() => {
                      onClose();
                      navigate(`/explore?category=${c.id}`);
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {debounced && results.length === 0 && (
          <EmptyState
            title="Nothing matched"
            message={`No curated place matches "${debounced}". There are only 54 — try a category like "waterfall" or a region like "Ubud".`}
            action={{ label: 'Browse everything', to: '/explore' }}
            compact
          />
        )}

        <div className={styles.list}>
          {results.map((spot, i) => (
            <div
              key={spot.id}
              className={i === activeIndex ? styles.activeResult : undefined}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <PlaceCard
                spot={spot}
                variant="compact"
                showVisited={false}
                onClick={() => openSpot(spot.id, query)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
