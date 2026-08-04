import type { Cost } from '@/data/types';

/** "1h 30m", "45m". For visit durations and travel times. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * "≈ 12 km away". Deliberately "away", not "drive" — this is straight-line
 * distance and Bali roads run 1.3–1.8× longer (see lib/geo.ts).
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

/** "Rp 25k", "Rp 1.2M" — full rupiah figures are too long for a card. */
export function formatIDR(amount: number): string {
  if (amount === 0) return 'Free';
  if (amount < 1_000) return `Rp ${amount}`;
  if (amount < 1_000_000) return `Rp ${Math.round(amount / 1000)}k`;
  return `Rp ${(amount / 1_000_000).toFixed(1)}M`;
}

export function formatCost(cost: Cost): string {
  if (cost.min === 0 && cost.max === 0) return 'Free';
  if (cost.min === cost.max) return formatIDR(cost.min);
  return `${formatIDR(cost.min)}–${formatIDR(cost.max)}`;
}

/** One decimal, always — "4.5", not "4.5000001". */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Loose parse of a Spot's free-text `bestTime` for the Sunset interest.
 * Matches the first HH:MM and reports whether it is at or after 16:00.
 * Deliberately forgiving — bestTime also holds things like "Low tide, morning".
 */
export function isSunsetTime(bestTime: string): boolean {
  const match = bestTime.match(/(\d{1,2}):(\d{2})/);
  if (!match?.[1]) return /sunset|golden hour|dusk/i.test(bestTime);
  return Number(match[1]) >= 16;
}
