import { describe, expect, it } from 'vitest';
import { BALI_BOUNDS, boundsOf, haversineKm, isWithinBali } from './geo';
import { sync } from '@/data/repository';

const UBUD = { lat: -8.5069, lng: 115.2625 };
const KELINGKING = { lat: -8.7513, lng: 115.4711 };

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(UBUD, UBUD)).toBe(0);
  });

  it('matches a known Bali distance', () => {
    // Ubud → Kelingking Beach (Nusa Penida) is ~35km straight line.
    expect(haversineKm(UBUD, KELINGKING)).toBeGreaterThan(30);
    expect(haversineKm(UBUD, KELINGKING)).toBeLessThan(40);
  });

  it('is symmetric', () => {
    expect(haversineKm(UBUD, KELINGKING)).toBeCloseTo(haversineKm(KELINGKING, UBUD), 6);
  });

  it('matches one degree of latitude at ~111km', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });
});

describe('isWithinBali', () => {
  it('accepts every curated spot', () => {
    const outside = sync.spots().filter((s) => !isWithinBali(s.coordinates));
    expect(outside.map((s) => s.id)).toEqual([]);
  });

  it('rejects transposed lat/lng', () => {
    // A classic data-entry bug: 115.2625 as latitude is nowhere near Bali.
    expect(isWithinBali({ lat: 115.2625, lng: -8.5069 })).toBe(false);
  });

  it('rejects Jakarta', () => {
    expect(isWithinBali({ lat: -6.2088, lng: 106.8456 })).toBe(false);
  });
});

describe('boundsOf', () => {
  it('returns null for an empty set', () => {
    expect(boundsOf([])).toBeNull();
  });

  it('contains every curated spot inside Bali bounds', () => {
    const bounds = boundsOf(sync.spots().map((s) => s.coordinates));
    expect(bounds).not.toBeNull();
    expect(bounds!.north).toBeLessThanOrEqual(BALI_BOUNDS.north);
    expect(bounds!.south).toBeGreaterThanOrEqual(BALI_BOUNDS.south);
  });
});
