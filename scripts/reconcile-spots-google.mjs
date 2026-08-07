#!/usr/bin/env node
/**
 * Reconcile curated spots against Google Places (optional).
 *
 * Requires: GOOGLE_MAPS_API_KEY with Places API (New) Text Search enabled.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=... node scripts/reconcile-spots-google.mjs
 *   GOOGLE_MAPS_API_KEY=... node scripts/reconcile-spots-google.mjs --apply
 *
 * Without --apply, writes a report to scripts/output/google-reconcile-report.json
 * and does not mutate bali-spots.json.
 *
 * Photos: Places Photos still need a separate download + license step —
 * this script only suggests photo names / place IDs for follow-up.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const spotsPath = path.join(root, 'data', 'bali-spots.json');
const outDir = path.join(root, 'scripts', 'output');
const apply = process.argv.includes('--apply');
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!apiKey) {
  console.error('Missing GOOGLE_MAPS_API_KEY. Aborting.');
  process.exit(1);
}

const spotsFile = JSON.parse(await readFile(spotsPath, 'utf8'));
const spots = spotsFile.spots ?? spotsFile;

const results = [];

for (const spot of spots) {
  const query = `${spot.name}, Bali, Indonesia`;
  const body = {
    textQuery: query,
    locationBias: {
      circle: {
        center: {
          latitude: spot.coordinates.lat,
          longitude: spot.coordinates.lng,
        },
        radius: 8000,
      },
    },
    maxResultCount: 1,
  };

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.location,places.googleMapsUri,places.rating,places.photos',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    results.push({
      id: spot.id,
      name: spot.name,
      status: 'error',
      error: `${response.status} ${text.slice(0, 200)}`,
    });
    continue;
  }

  const data = await response.json();
  const place = data.places?.[0];
  if (!place?.location) {
    results.push({ id: spot.id, name: spot.name, status: 'not_found' });
    continue;
  }

  const next = {
    lat: place.location.latitude,
    lng: place.location.longitude,
  };
  const deltaKm = haversineKm(spot.coordinates, next);

  results.push({
    id: spot.id,
    name: spot.name,
    status: 'matched',
    placeId: place.id,
    displayName: place.displayName?.text,
    googleMapsUri: place.googleMapsUri,
    rating: place.rating ?? null,
    photoCount: place.photos?.length ?? 0,
    current: spot.coordinates,
    suggested: next,
    deltaKm: Math.round(deltaKm * 1000) / 1000,
  });

  if (apply && deltaKm > 0.05) {
    spot.coordinates = next;
    if (place.googleMapsUri) spot.googleMapsUrl = place.googleMapsUri;
    if (!spot.placeId) spot.placeId = place.id;
  }

  // Be kind to quota.
  await sleep(120);
}

await mkdir(outDir, { recursive: true });
const reportPath = path.join(outDir, 'google-reconcile-report.json');
await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

if (apply) {
  spotsFile._meta = {
    ...(spotsFile._meta ?? {}),
    lastGoogleReconcile: new Date().toISOString().slice(0, 10),
    provenance: {
      ...(spotsFile._meta?.provenance ?? {}),
      status: 'GOOGLE_RECONCILED',
      note: 'Coordinates refreshed via Places Text Search. Review deltas in scripts/output.',
    },
  };
  await writeFile(spotsPath, `${JSON.stringify(spotsFile, null, 2)}\n`);
  console.log(`Applied coordinate updates to ${spotsPath}`);
}

console.log(`Wrote ${reportPath} (${results.length} spots)`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
