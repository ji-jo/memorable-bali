/**
 * Filtering, sorting and search over the curated set.
 *
 * With 54 records everything is an in-memory pass — no index, no search
 * library, no memoisation gymnastics. Keep it readable.
 */

import { haversineKm } from '@/lib/geo';
import { isSunsetTime } from '@/lib/format';
import type {
  Coordinates,
  ExploreFilters,
  OnboardingInterest,
  Spot,
  SpotTag,
} from './types';

/** Recompute distances against the live anchor from onboarding. */
export function withDistances(spots: Spot[], anchor: Coordinates): Spot[] {
  return spots.map((spot) => ({
    ...spot,
    distanceFromStayKm: Math.round(haversineKm(anchor, spot.coordinates) * 10) / 10,
  }));
}

/** Merge the localStorage visited set over the (always false) JSON seed. */
export function withVisited(spots: Spot[], visitedIds: string[]): Spot[] {
  const visited = new Set(visitedIds);
  return spots.map((spot) => ({ ...spot, visited: visited.has(spot.id) }));
}

export function applyFilters(spots: Spot[], filters: ExploreFilters): Spot[] {
  return spots.filter((spot) => {
    if (filters.category && spot.category !== filters.category) return false;
    if (filters.region && spot.region !== filters.region) return false;
    if (filters.tags.length && !filters.tags.some((t) => spot.tags.includes(t))) return false;
    if (filters.maxKm !== null && spot.distanceFromStayKm > filters.maxKm) return false;
    if (filters.maxDurationMin !== null && spot.visitDurationMin > filters.maxDurationMin) {
      return false;
    }
    return true;
  });
}

/**
 * Resolve onboarding interests to spots. Interests are a separate vocabulary
 * from categories — 'sunset' has no category and resolves through bestTime,
 * 'all' disables filtering entirely.
 */
export function matchesInterests(
  spot: Spot,
  selectedIds: string[],
  interests: OnboardingInterest[],
): boolean {
  if (selectedIds.length === 0 || selectedIds.includes('all')) return true;

  return selectedIds.some((id) => {
    const interest = interests.find((i) => i.id === id);
    if (!interest) return false;

    if (interest.matchesCategories.includes(spot.category)) return true;
    if (interest.matchesTags.some((t) => spot.tags.includes(t))) return true;
    if (interest.matchesBestTimeAfter && isSunsetTime(spot.bestTime)) return true;

    return false;
  });
}

/** Accent- and case-insensitive so "cafe" finds "Café". */
const normalise = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function searchSpots(
  spots: Spot[],
  query: string,
  labels: { categories: Map<string, string>; regions: Map<string, string> },
): Spot[] {
  const q = normalise(query.trim());
  if (!q) return [];

  return spots.filter((spot) => {
    const haystack = [
      spot.name,
      spot.description,
      labels.categories.get(spot.category) ?? spot.category,
      labels.regions.get(spot.region) ?? spot.region,
      ...spot.tags,
    ]
      .map(normalise)
      .join(' ');

    return haystack.includes(q);
  });
}

export const sortByDistance = (spots: Spot[]): Spot[] =>
  [...spots].sort((a, b) => a.distanceFromStayKm - b.distanceFromStayKm);

export const sortByRating = (spots: Spot[]): Spot[] =>
  [...spots].sort((a, b) => b.rating - a.rating);

export function filterByTag(spots: Spot[], tag: SpotTag): Spot[] {
  return spots.filter((s) => s.tags.includes(tag));
}

/**
 * Deterministic per-day shuffle for the "Recommended today" rail — seeded from
 * the date so the rail does not reorder on every render, but does change daily.
 */
export function dailyShuffle<T>(items: T[], date = new Date()): T[] {
  const seed =
    date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate();

  return [...items]
    .map((item, i) => ({ item, key: Math.sin(seed * (i + 1)) }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}
