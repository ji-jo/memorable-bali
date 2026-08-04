import { sync } from '@/data/repository';
import type { Itinerary, Spot, TravelStyle } from '@/data/types';
import { STOPS_PER_DAY } from '@/state/OnboardingContext';

export interface ItineraryTotals {
  travelMinutes: number;
  visitMinutes: number;
  totalMinutes: number;
  cost: { min: number; max: number; currency: 'IDR' };
  stopCount: number;
  warnings: string[];
}

const MAX_REASONABLE_DAY_MINUTES = 10 * 60;

/**
 * Totals plus the warnings that make an itinerary honest.
 *
 * The ferry warning matters most: a Nusa Penida day that silently ignores a
 * 45-minute crossing each way and a hard last-return time is worse than no
 * itinerary at all.
 */
export function computeTotals(
  itinerary: Itinerary | null,
  travelStyle: TravelStyle = 'balanced',
): ItineraryTotals {
  const empty: ItineraryTotals = {
    travelMinutes: 0,
    visitMinutes: 0,
    totalMinutes: 0,
    cost: { min: 0, max: 0, currency: 'IDR' },
    stopCount: 0,
    warnings: [],
  };

  if (!itinerary || itinerary.stops.length === 0) return empty;

  const byId = new Map(sync.spots().map((s) => [s.id, s]));
  const spots = itinerary.stops
    .map((stop) => byId.get(stop.spotId))
    .filter((s): s is Spot => s !== undefined);

  const travelMinutes = itinerary.stops.reduce(
    (sum, s) => sum + s.travelMinutesFromPrevious,
    0,
  );
  const visitMinutes = itinerary.stops.reduce((sum, s) => sum + s.dwellMinutes, 0);
  const cost = spots.reduce(
    (acc, s) => ({ min: acc.min + s.cost.min, max: acc.max + s.cost.max, currency: 'IDR' as const }),
    { min: 0, max: 0, currency: 'IDR' as const },
  );

  const totalMinutes = travelMinutes + visitMinutes;
  const warnings: string[] = [];

  if (totalMinutes > MAX_REASONABLE_DAY_MINUTES) {
    warnings.push(
      `Over ${Math.round(totalMinutes / 60)} hours end to end — that is a long day.`,
    );
  }

  const budget = STOPS_PER_DAY[travelStyle];
  if (itinerary.stops.length > budget) {
    warnings.push(
      `${itinerary.stops.length} stops is more than a ${travelStyle} pace usually fits (${budget}).`,
    );
  }

  // Ferry-aware. The crossing is its own segment in both directions, and the
  // last boat back is early — missing it means an unplanned night on the island.
  const ferrySpots = spots.filter((s) => s.ferry !== null);
  if (ferrySpots.length > 0) {
    const routes = sync.spots().length > 0 ? [...new Set(ferrySpots.map((s) => s.ferry))] : [];
    warnings.push(
      `Includes a boat crossing (${routes.join(', ')}). Add roughly 45 minutes each way, and check the last return — it is early.`,
    );

    const mainlandStops = spots.filter((s) => s.ferry === null).length;
    if (mainlandStops > 0) {
      warnings.push(
        'Mixes island and mainland stops in one plan. Those are almost certainly different days.',
      );
    }
  }

  return { travelMinutes, visitMinutes, totalMinutes, cost, stopCount: itinerary.stops.length, warnings };
}
