import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  dailyShuffle,
  matchesInterests,
  searchSpots,
  withDistances,
  withVisited,
} from './queries';
import { sync } from './repository';
import categoriesFile from '@data/categories.json';
import type { ExploreFilters, OnboardingInterest, Spot } from './types';

const spots = sync.spots();
const categories = sync.categories();
const regions = sync.regions();
const interests = categoriesFile.onboardingInterests as OnboardingInterest[];

const labels = {
  categories: new Map(categories.map((c) => [c.id, c.label])),
  regions: new Map(regions.map((r) => [r.id, r.label])),
};

const noFilters: ExploreFilters = {
  category: null,
  tags: [],
  region: null,
  maxKm: null,
  maxDurationMin: null,
};

describe('withVisited', () => {
  it('merges localStorage state over the always-false JSON seed', () => {
    expect(spots.every((s) => s.visited === false)).toBe(true);

    const merged = withVisited(spots, ['tirta-empul', 'kelingking-beach']);
    expect(merged.find((s) => s.id === 'tirta-empul')?.visited).toBe(true);
    expect(merged.find((s) => s.id === 'uluwatu-temple')?.visited).toBe(false);
  });

  it('does not mutate the source data', () => {
    withVisited(spots, ['tirta-empul']);
    expect(sync.spots().find((s) => s.id === 'tirta-empul')?.visited).toBe(false);
  });
});

describe('withDistances', () => {
  it('recomputes against a new anchor', () => {
    const fromUluwatu = withDistances(spots, { lat: -8.8291, lng: 115.0849 });
    const uluwatu = fromUluwatu.find((s) => s.id === 'uluwatu-temple');
    expect(uluwatu?.distanceFromStayKm).toBe(0);
  });
});

describe('applyFilters', () => {
  it('returns everything with no filters', () => {
    expect(applyFilters(spots, noFilters)).toHaveLength(spots.length);
  });

  it('filters by category', () => {
    const result = applyFilters(spots, { ...noFilters, category: 'waterfalls' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.category === 'waterfalls')).toBe(true);
  });

  it('filters by tag', () => {
    const result = applyFilters(spots, { ...noFilters, tags: ['Outworldly'] });
    expect(result.every((s) => s.tags.includes('Outworldly'))).toBe(true);
  });

  it('filters by max distance', () => {
    const result = applyFilters(spots, { ...noFilters, maxKm: 10 });
    expect(result.every((s) => s.distanceFromStayKm <= 10)).toBe(true);
  });
});

describe('searchSpots', () => {
  it('is empty for a blank query', () => {
    expect(searchSpots(spots, '   ', labels)).toEqual([]);
  });

  it('surfaces waterfalls and water temples for "water"', () => {
    const ids = searchSpots(spots, 'water', labels).map((s) => s.id);
    expect(ids).toContain('sekumpul-waterfall');
    expect(ids).toContain('tirta-gangga'); // "water palace" in the description
  });

  it('is case insensitive', () => {
    expect(searchSpots(spots, 'UBUD', labels).length).toBeGreaterThan(0);
  });

  it('is accent insensitive — "cafe" finds "Café"', () => {
    const ids = searchSpots(spots, 'cafe', labels).map((s) => s.id);
    expect(ids).toContain('crate-cafe-canggu');
  });
});

describe('matchesInterests', () => {
  const waterfall = spots.find((s) => s.category === 'waterfalls') as Spot;

  it('matches everything when nothing is selected', () => {
    expect(matchesInterests(waterfall, [], interests)).toBe(true);
  });

  it('matches everything for "all"', () => {
    expect(matchesInterests(waterfall, ['all'], interests)).toBe(true);
  });

  it('maps nature → waterfalls, since nature covers both categories', () => {
    expect(matchesInterests(waterfall, ['nature'], interests)).toBe(true);
  });

  it('does not match an unrelated interest', () => {
    expect(matchesInterests(waterfall, ['cafes'], interests)).toBe(false);
  });
});

describe('dailyShuffle', () => {
  it('is stable within a day', () => {
    const date = new Date('2026-08-04');
    const a = dailyShuffle(spots, date).map((s) => s.id);
    const b = dailyShuffle(spots, date).map((s) => s.id);
    expect(a).toEqual(b);
  });

  it('changes across days', () => {
    const a = dailyShuffle(spots, new Date('2026-08-04')).map((s) => s.id);
    const b = dailyShuffle(spots, new Date('2026-08-05')).map((s) => s.id);
    expect(a).not.toEqual(b);
  });

  it('keeps every item', () => {
    expect(dailyShuffle(spots).length).toBe(spots.length);
  });
});
