#!/usr/bin/env node
/**
 * Fills `distanceFromStayKm` on every spot with the haversine distance from the
 * anchor declared in bali-spots.json `_meta.distanceAnchor`.
 *
 *   node scripts/compute-distances.mjs
 *
 * This is a baseline only. Once a visitor picks a stay area in onboarding the
 * app recomputes distances at runtime with the same formula (see the `haversineKm`
 * helper in docs/03-Data-Model.md), so this value is what a first-run user sees
 * before they have told us anything.
 *
 * Straight-line, not road distance. Bali road distance typically runs 1.3-1.8x
 * this figure, and travel time is dominated by traffic rather than distance.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPOTS_PATH = join(ROOT, 'data', 'bali-spots.json');

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const file = JSON.parse(readFileSync(SPOTS_PATH, 'utf8'));
const anchor = file._meta.distanceAnchor.center;

let changed = 0;
for (const spot of file.spots) {
  const km = Math.round(haversineKm(anchor, spot.coordinates) * 10) / 10;
  if (spot.distanceFromStayKm !== km) changed += 1;
  spot.distanceFromStayKm = km;
}

file._meta.count = file.spots.length;

writeFileSync(SPOTS_PATH, `${JSON.stringify(file, null, 2)}\n`);

const sorted = [...file.spots].sort((a, b) => a.distanceFromStayKm - b.distanceFromStayKm);
console.log(`\n  Anchor: ${file._meta.distanceAnchor.stayAreaId} (${anchor.lat}, ${anchor.lng})`);
console.log(`  Updated ${changed} of ${file.spots.length} spots. _meta.count set to ${file.spots.length}.`);
console.log(`  Nearest:  ${sorted[0].name} — ${sorted[0].distanceFromStayKm} km`);
console.log(`  Furthest: ${sorted.at(-1).name} — ${sorted.at(-1).distanceFromStayKm} km\n`);
