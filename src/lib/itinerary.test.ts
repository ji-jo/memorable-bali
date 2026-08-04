import { describe, expect, it } from 'vitest';
import { computeTotals } from './itinerary';
import { sync } from '@/data/repository';
import type { Itinerary, ItineraryStop } from '@/data/types';

const spots = sync.spots();

const stop = (spotId: string, dwell = 60, travel = 0): ItineraryStop => ({
  order: 1,
  spotId,
  arriveAt: '09:00',
  dwellMinutes: dwell,
  travelMinutesFromPrevious: travel,
});

const itinerary = (stops: ItineraryStop[]): Itinerary => ({
  id: 'test',
  title: 'Test',
  summary: '',
  lengthOfStay: '1-day',
  travelStyle: 'balanced',
  suggestedStayArea: 'ubud',
  interests: [],
  transportation: ['scooter'],
  estimatedTotalMinutes: 0,
  estimatedCost: { currency: 'IDR', min: 0, max: 0, note: '' },
  stops: stops.map((s, i) => ({ ...s, order: i + 1 })),
});

describe('computeTotals', () => {
  it('returns zeroes for null or empty', () => {
    expect(computeTotals(null).totalMinutes).toBe(0);
    expect(computeTotals(itinerary([])).stopCount).toBe(0);
  });

  it('sums dwell and travel time', () => {
    const totals = computeTotals(itinerary([stop('tirta-empul', 90, 0), stop('goa-gajah', 60, 20)]));
    expect(totals.visitMinutes).toBe(150);
    expect(totals.travelMinutes).toBe(20);
    expect(totals.totalMinutes).toBe(170);
  });

  it('sums entry costs from the real dataset', () => {
    const tirta = spots.find((s) => s.id === 'tirta-empul')!;
    const totals = computeTotals(itinerary([stop('tirta-empul')]));
    expect(totals.cost.min).toBe(tirta.cost.min);
    expect(totals.cost.max).toBe(tirta.cost.max);
  });

  it('warns when the day runs over ten hours', () => {
    const totals = computeTotals(
      itinerary([stop('tirta-empul', 400), stop('goa-gajah', 300, 60)]),
    );
    expect(totals.warnings.some((w) => /hours end to end/.test(w))).toBe(true);
  });

  it('warns when stop count exceeds the travel-style budget', () => {
    const relaxed = computeTotals(
      itinerary([stop('tirta-empul', 30), stop('goa-gajah', 30), stop('campuhan-ridge-walk', 30)]),
      'relaxed',
    );
    expect(relaxed.warnings.some((w) => /relaxed pace/.test(w))).toBe(true);
  });

  /** The warning that most protects a real traveller from a real mistake. */
  it('warns about the boat crossing when an island stop is included', () => {
    const totals = computeTotals(itinerary([stop('kelingking-beach')]));
    expect(totals.warnings.some((w) => /boat crossing/.test(w))).toBe(true);
    expect(totals.warnings.some((w) => /last return/.test(w))).toBe(true);
  });

  it('warns when island and mainland stops are mixed in one plan', () => {
    const totals = computeTotals(itinerary([stop('kelingking-beach'), stop('tirta-empul')]));
    expect(totals.warnings.some((w) => /different days/.test(w))).toBe(true);
  });

  it('does not warn about ferries for a mainland-only plan', () => {
    const totals = computeTotals(itinerary([stop('tirta-empul'), stop('goa-gajah')]));
    expect(totals.warnings.some((w) => /boat crossing/.test(w))).toBe(false);
  });
});
