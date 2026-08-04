import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import { StorageKeys } from '@/lib/storage';
import { sync } from '@/data/repository';
import { estimateDriveMinutes, haversineKm } from '@/lib/geo';
import type { Coordinates, Itinerary, ItineraryStop, Spot } from '@/data/types';

const DEFAULT_TITLE = 'My Trip';

interface ItineraryContextValue {
  itineraries: Itinerary[];
  activeId: string | null;
  active: Itinerary | null;
  isInActive: (spotId: string) => boolean;
  addStop: (spot: Spot) => void;
  removeStop: (spotId: string) => void;
  moveStop: (from: number, to: number) => void;
  setDwell: (spotId: string, minutes: number) => void;
  optimise: (anchor: Coordinates) => void;
  createItinerary: (title?: string) => string;
  setActive: (id: string) => void;
  renameActive: (title: string) => void;
  deleteItinerary: (id: string) => void;
}

const ItineraryContext = createContext<ItineraryContextValue | null>(null);

interface StoredState {
  itineraries: Itinerary[];
  activeId: string | null;
}

const EMPTY: StoredState = { itineraries: [], activeId: null };

const newItinerary = (title: string): Itinerary => ({
  id: `itin-${Date.now().toString(36)}`,
  title,
  summary: '',
  lengthOfStay: '1-day',
  travelStyle: 'balanced',
  suggestedStayArea: 'ubud',
  interests: [],
  transportation: ['scooter'],
  estimatedTotalMinutes: 0,
  estimatedCost: { currency: 'IDR', min: 0, max: 0, note: '' },
  stops: [],
});

/** Renumber `order` to 1..n after any mutation — the validator's contract. */
const renumber = (stops: ItineraryStop[]): ItineraryStop[] =>
  stops.map((stop, i) => ({ ...stop, order: i + 1 }));

export function ItineraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<StoredState>(StorageKeys.itineraries, EMPTY);

  const active = useMemo(
    () => state.itineraries.find((i) => i.id === state.activeId) ?? null,
    [state],
  );

  const mutateActive = useCallback(
    (fn: (itinerary: Itinerary) => Itinerary) => {
      setState((prev) => {
        // No itinerary yet — create one silently rather than interrupting with
        // a dialog. See docs/05-User-Flows.md Flow 4.
        if (!prev.activeId || !prev.itineraries.some((i) => i.id === prev.activeId)) {
          const created = fn(newItinerary(DEFAULT_TITLE));
          return { itineraries: [...prev.itineraries, created], activeId: created.id };
        }
        return {
          ...prev,
          itineraries: prev.itineraries.map((i) => (i.id === prev.activeId ? fn(i) : i)),
        };
      });
    },
    [setState],
  );

  const addStop = useCallback(
    (spot: Spot) => {
      mutateActive((itin) => {
        if (itin.stops.some((s) => s.spotId === spot.id)) return itin;
        const stop: ItineraryStop = {
          order: itin.stops.length + 1,
          spotId: spot.id,
          arriveAt: '09:00',
          dwellMinutes: spot.visitDurationMin,
          travelMinutesFromPrevious: 0,
        };
        return { ...itin, stops: [...itin.stops, stop] };
      });
    },
    [mutateActive],
  );

  const removeStop = useCallback(
    (spotId: string) => {
      mutateActive((itin) => ({
        ...itin,
        stops: renumber(itin.stops.filter((s) => s.spotId !== spotId)),
      }));
    },
    [mutateActive],
  );

  const moveStop = useCallback(
    (from: number, to: number) => {
      mutateActive((itin) => {
        if (to < 0 || to >= itin.stops.length) return itin;
        const stops = [...itin.stops];
        const [moved] = stops.splice(from, 1);
        if (!moved) return itin;
        stops.splice(to, 0, moved);
        return { ...itin, stops: renumber(stops) };
      });
    },
    [mutateActive],
  );

  const setDwell = useCallback(
    (spotId: string, minutes: number) => {
      mutateActive((itin) => ({
        ...itin,
        stops: itin.stops.map((s) =>
          s.spotId === spotId ? { ...s, dwellMinutes: Math.max(15, minutes) } : s,
        ),
      }));
    },
    [mutateActive],
  );

  /**
   * Nearest-neighbour from the stay anchor. With <= 10 stops this is instant
   * and good enough — do not over-engineer it into a TSP solver.
   */
  const optimise = useCallback(
    (anchor: Coordinates) => {
      mutateActive((itin) => {
        const byId = new Map(sync.spots().map((s) => [s.id, s]));
        const remaining = [...itin.stops];
        const ordered: ItineraryStop[] = [];
        let current = anchor;

        while (remaining.length > 0) {
          let bestIndex = 0;
          let bestDistance = Infinity;

          remaining.forEach((stop, i) => {
            const spot = byId.get(stop.spotId);
            if (!spot) return;
            const d = haversineKm(current, spot.coordinates);
            if (d < bestDistance) {
              bestDistance = d;
              bestIndex = i;
            }
          });

          const [next] = remaining.splice(bestIndex, 1);
          if (!next) break;

          const spot = byId.get(next.spotId);
          ordered.push({
            ...next,
            travelMinutesFromPrevious: estimateDriveMinutes(bestDistance),
          });
          if (spot) current = spot.coordinates;
        }

        return { ...itin, stops: renumber(ordered) };
      });
    },
    [mutateActive],
  );

  const createItinerary = useCallback(
    (title = DEFAULT_TITLE) => {
      const created = newItinerary(title);
      setState((prev) => ({
        itineraries: [...prev.itineraries, created],
        activeId: created.id,
      }));
      return created.id;
    },
    [setState],
  );

  const setActive = useCallback(
    (id: string) => setState((prev) => ({ ...prev, activeId: id })),
    [setState],
  );

  const renameActive = useCallback(
    (title: string) => mutateActive((itin) => ({ ...itin, title })),
    [mutateActive],
  );

  const deleteItinerary = useCallback(
    (id: string) => {
      setState((prev) => {
        const itineraries = prev.itineraries.filter((i) => i.id !== id);
        return {
          itineraries,
          activeId: prev.activeId === id ? (itineraries[0]?.id ?? null) : prev.activeId,
        };
      });
    },
    [setState],
  );

  const value = useMemo<ItineraryContextValue>(
    () => ({
      itineraries: state.itineraries,
      activeId: state.activeId,
      active,
      isInActive: (spotId: string) => active?.stops.some((s) => s.spotId === spotId) ?? false,
      addStop,
      removeStop,
      moveStop,
      setDwell,
      optimise,
      createItinerary,
      setActive,
      renameActive,
      deleteItinerary,
    }),
    [
      state,
      active,
      addStop,
      removeStop,
      moveStop,
      setDwell,
      optimise,
      createItinerary,
      setActive,
      renameActive,
      deleteItinerary,
    ],
  );

  return <ItineraryContext.Provider value={value}>{children}</ItineraryContext.Provider>;
}

export function useItinerary(): ItineraryContextValue {
  const ctx = useContext(ItineraryContext);
  if (!ctx) throw new Error('useItinerary must be used inside <ItineraryProvider>');
  return ctx;
}
