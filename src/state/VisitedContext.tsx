import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import { StorageKeys } from '@/lib/storage';

/**
 * The user's "visited" checkbox from the data spec.
 *
 * Stored as an id list in localStorage — never written back to the JSON, which
 * always seeds `visited: false`. Baking real state into a shared data file
 * would make it wrong for every user but the first.
 */
interface VisitedContextValue {
  visitedIds: string[];
  isVisited: (spotId: string) => boolean;
  toggle: (spotId: string) => void;
  count: number;
}

const VisitedContext = createContext<VisitedContextValue | null>(null);

export function VisitedProvider({ children }: { children: ReactNode }) {
  const [visitedIds, setVisitedIds] = useLocalStorage<string[]>(StorageKeys.visited, []);

  const toggle = useCallback(
    (spotId: string) => {
      setVisitedIds((prev) =>
        prev.includes(spotId) ? prev.filter((id) => id !== spotId) : [...prev, spotId],
      );
    },
    [setVisitedIds],
  );

  const value = useMemo<VisitedContextValue>(() => {
    const set = new Set(visitedIds);
    return {
      visitedIds,
      isVisited: (spotId: string) => set.has(spotId),
      toggle,
      count: visitedIds.length,
    };
  }, [visitedIds, toggle]);

  return <VisitedContext.Provider value={value}>{children}</VisitedContext.Provider>;
}

export function useVisited(): VisitedContextValue {
  const ctx = useContext(VisitedContext);
  if (!ctx) throw new Error('useVisited must be used inside <VisitedProvider>');
  return ctx;
}
