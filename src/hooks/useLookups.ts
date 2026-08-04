import { useMemo } from 'react';
import { sync } from '@/data/repository';
import type { Category, Region } from '@/data/types';

/**
 * Lookup maps for the reference data. These are small, static and read
 * constantly (every card resolves a category colour), so they are built once
 * from the synchronous accessors rather than threaded through async state.
 */

export function useCategoryLookup(): Map<string, Category> {
  return useMemo(() => new Map(sync.categories().map((c) => [c.id, c])), []);
}

export function useRegionLookup(): Map<string, Region> {
  return useMemo(() => new Map(sync.regions().map((r) => [r.id, r])), []);
}

export function useLabelLookups() {
  return useMemo(
    () => ({
      categories: new Map(sync.categories().map((c) => [c.id, c.label])),
      regions: new Map(sync.regions().map((r) => [r.id, r.label])),
    }),
    [],
  );
}
