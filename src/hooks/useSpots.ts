import { useMemo } from 'react';
import { sync } from '@/data/repository';
import { withDistances, withVisited } from '@/data/queries';
import { useOnboarding } from '@/state/OnboardingContext';
import { useVisited } from '@/state/VisitedContext';
import type { Spot } from '@/data/types';

/**
 * The canonical spot list every screen reads: distances recomputed against the
 * live onboarding anchor, and visited state merged from localStorage over the
 * JSON's always-false seed.
 */
export function useSpots(): Spot[] {
  const { anchor } = useOnboarding();
  const { visitedIds } = useVisited();

  return useMemo(
    () => withVisited(withDistances(sync.spots(), anchor), visitedIds),
    [anchor, visitedIds],
  );
}

export function useSpot(id: string | undefined): Spot | undefined {
  const spots = useSpots();
  return useMemo(() => spots.find((s) => s.id === id), [spots, id]);
}
