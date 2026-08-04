#!/usr/bin/env node
/**
 * Validates every JSON file in data/ against the contract in docs/03-Data-Model.md.
 *
 * Zero dependencies — runs on any Node 18+ with no install step, which is why
 * CI can check the dataset before the app itself exists.
 *
 *   node scripts/validate-spots.mjs
 *
 * Exits 0 when clean, 1 with a per-record report otherwise.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 80;
const TAG_VOCABULARY = ['Memorable', 'Must Visit', 'Cultural', 'Outworldly'];

/** Bali province bounding box, generous enough to include Menjangan and the Nusas. */
const BOUNDS = { minLat: -9.2, maxLat: -8.0, minLng: 114.4, maxLng: 115.8 };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GOOGLE_MAPS_URL = /^https:\/\/www\.google\.com\/maps\//;

const errors = [];
const warnings = [];

const fail = (where, message) => errors.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);

function load(filename) {
  try {
    return JSON.parse(readFileSync(join(DATA, filename), 'utf8'));
  } catch (err) {
    console.error(`\n  Cannot read/parse data/${filename}\n   ${err.message}\n`);
    process.exit(1);
  }
}

const categoriesFile = load('categories.json');
const regionsFile = load('regions.json');
const stayAreasFile = load('stay-areas.json');
const spotsFile = load('bali-spots.json');
const ferriesFile = load('ferries.json');
const itinerariesFile = load('itineraries.sample.json');

const categoryIds = new Set(categoriesFile.categories.map((c) => c.id));
const interestIds = new Set(categoriesFile.onboardingInterests.map((i) => i.id));
const regionIds = new Set(regionsFile.regions.map((r) => r.id));
const stayAreaIds = new Set(stayAreasFile.stayAreas.map((a) => a.id));
const ferryRouteIds = new Set(ferriesFile.routes.map((r) => r.id));
const spots = spotsFile.spots;
const spotIds = new Set(spots.map((s) => s.id));

// ---------------------------------------------------------------- lookup files

for (const interest of categoriesFile.onboardingInterests) {
  for (const id of interest.matchesCategories ?? []) {
    if (!categoryIds.has(id)) {
      fail(`categories.json/onboardingInterests/${interest.id}`, `matchesCategories "${id}" is not a category`);
    }
  }
  for (const tag of interest.matchesTags ?? []) {
    if (!TAG_VOCABULARY.includes(tag)) {
      fail(`categories.json/onboardingInterests/${interest.id}`, `matchesTags "${tag}" is not in the tag vocabulary`);
    }
  }
}

for (const area of stayAreasFile.stayAreas) {
  if (!regionIds.has(area.region)) {
    fail(`stay-areas.json/${area.id}`, `region "${area.region}" is not in regions.json`);
  }
}
if (!stayAreaIds.has(stayAreasFile._meta.defaultAnchor)) {
  fail('stay-areas.json/_meta', `defaultAnchor "${stayAreasFile._meta.defaultAnchor}" is not a stay area`);
}

// ---------------------------------------------------------------------- spots

const seenIds = new Set();

for (const [index, spot] of spots.entries()) {
  const where = `spot[${index}] ${spot.id ?? '(no id)'}`;

  // identity
  if (typeof spot.id !== 'string' || !SLUG.test(spot.id)) {
    fail(where, 'id must be a kebab-case slug');
  }
  if (seenIds.has(spot.id)) fail(where, `duplicate id "${spot.id}"`);
  seenIds.add(spot.id);

  if (typeof spot.name !== 'string' || spot.name.trim() === '') {
    fail(where, 'name is required');
  }

  // the user-specified 50-80 character constraint
  if (typeof spot.description !== 'string') {
    fail(where, 'description is required');
  } else {
    const len = [...spot.description].length;
    if (len < DESCRIPTION_MIN || len > DESCRIPTION_MAX) {
      fail(where, `description is ${len} chars, must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} — "${spot.description}"`);
    }
  }

  if (typeof spot.longDescription !== 'string' || spot.longDescription.length < 80) {
    fail(where, 'longDescription is required and should be a real paragraph');
  }

  // links
  if (typeof spot.googleMapsUrl !== 'string' || !GOOGLE_MAPS_URL.test(spot.googleMapsUrl)) {
    fail(where, 'googleMapsUrl must be an https://www.google.com/maps/ URL');
  }

  // user state seed
  if (spot.visited !== false) {
    fail(where, 'visited must be seeded false — real state belongs in localStorage');
  }

  // rating
  if (typeof spot.rating !== 'number' || spot.rating < 0 || spot.rating > 5) {
    fail(where, 'rating must be a number between 0 and 5');
  } else if (Math.round(spot.rating * 10) !== spot.rating * 10) {
    fail(where, 'rating must have at most one decimal place');
  }

  // distance
  if (typeof spot.distanceFromStayKm !== 'number' || spot.distanceFromStayKm < 0) {
    fail(where, 'distanceFromStayKm must be a non-negative number');
  } else if (spot.distanceFromStayKm === 0) {
    warn(where, 'distanceFromStayKm is 0 — run scripts/compute-distances.mjs');
  }

  // tags
  if (!Array.isArray(spot.tags) || spot.tags.length === 0) {
    fail(where, 'tags must be a non-empty array');
  } else {
    for (const tag of spot.tags) {
      if (!TAG_VOCABULARY.includes(tag)) {
        fail(where, `tag "${tag}" is not one of: ${TAG_VOCABULARY.join(', ')}`);
      }
    }
    if (new Set(spot.tags).size !== spot.tags.length) fail(where, 'tags contains duplicates');
  }

  // foreign keys
  if (!categoryIds.has(spot.category)) fail(where, `category "${spot.category}" is not in categories.json`);
  if (!regionIds.has(spot.region)) fail(where, `region "${spot.region}" is not in regions.json`);

  // coordinates
  const c = spot.coordinates;
  if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') {
    fail(where, 'coordinates must be { lat: number, lng: number }');
  } else if (c.lat < BOUNDS.minLat || c.lat > BOUNDS.maxLat || c.lng < BOUNDS.minLng || c.lng > BOUNDS.maxLng) {
    fail(where, `coordinates (${c.lat}, ${c.lng}) fall outside Bali — check for a transposed lat/lng`);
  }

  // media
  if (!Array.isArray(spot.images) || spot.images.length === 0) {
    fail(where, 'images must be a non-empty array');
  }

  // practicalities
  if (!spot.openingHours || typeof spot.openingHours !== 'object') {
    fail(where, 'openingHours is required');
  }
  if (typeof spot.visitDurationMin !== 'number' || spot.visitDurationMin <= 0) {
    fail(where, 'visitDurationMin must be a positive number of minutes');
  }
  if (!spot.cost || typeof spot.cost.min !== 'number' || typeof spot.cost.max !== 'number') {
    fail(where, 'cost must be { currency, min, max, note }');
  } else if (spot.cost.min > spot.cost.max) {
    fail(where, 'cost.min is greater than cost.max');
  }
  if (typeof spot.bestTime !== 'string' || spot.bestTime.trim() === '') {
    fail(where, 'bestTime is required');
  }
  if (!Array.isArray(spot.tips) || spot.tips.length < 2) {
    fail(where, 'tips must have at least 2 entries — this is the curation the product sells');
  }

  // relations
  if (!Array.isArray(spot.nearby)) {
    fail(where, 'nearby must be an array of spot ids');
  } else {
    for (const id of spot.nearby) {
      if (!spotIds.has(id)) fail(where, `nearby id "${id}" does not resolve to a spot`);
      if (id === spot.id) fail(where, 'nearby includes the spot itself');
    }
    if (new Set(spot.nearby).size !== spot.nearby.length) fail(where, 'nearby contains duplicates');
  }

  // ferry
  if (spot.ferry !== null && !ferryRouteIds.has(spot.ferry)) {
    fail(where, `ferry "${spot.ferry}" is not a route in ferries.json`);
  }
  if (spot.region === 'nusa' && spot.ferry === null) {
    fail(where, 'spots in the nusa region need a ferry route');
  }

  // schema drift — catch stray fields before they reach the app
  const KNOWN = new Set([
    'id', 'name', 'description', 'longDescription', 'googleMapsUrl', 'visited', 'rating',
    'distanceFromStayKm', 'tags', 'category', 'region', 'coordinates', 'images',
    'openingHours', 'visitDurationMin', 'cost', 'bestTime', 'tips', 'nearby', 'ferry',
  ]);
  for (const key of Object.keys(spot)) {
    if (!KNOWN.has(key)) fail(where, `unknown field "${key}" — update the schema or remove it`);
  }
}

// ------------------------------------------------- geographic sanity of links

/**
 * "Nearby" that is 75km away is a bad recommendation, not a data-shape error.
 * Bali is ~150km end to end, so anything past 60km is not a plausible pairing.
 * Warned rather than failed: the remote west (Menjangan) genuinely has no close
 * neighbours in a 54-place dataset.
 */
const NEARBY_WARN_KM = 60;
const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

const spotsById = new Map(spots.map((s) => [s.id, s]));
for (const spot of spots) {
  for (const id of spot.nearby ?? []) {
    const other = spotsById.get(id);
    if (!other) continue;
    const km = haversineKm(spot.coordinates, other.coordinates);
    if (km > NEARBY_WARN_KM) {
      warn(`spot ${spot.id}`, `nearby "${id}" is ${km.toFixed(0)}km away — too far to recommend as nearby`);
    }
  }
}

// --------------------------------------------------------------- _meta count

if (spotsFile._meta.count !== spots.length) {
  fail('bali-spots.json/_meta', `count says ${spotsFile._meta.count} but there are ${spots.length} spots`);
}
const anchor = spotsFile._meta.distanceAnchor;
if (!stayAreaIds.has(anchor?.stayAreaId)) {
  fail('bali-spots.json/_meta', `distanceAnchor.stayAreaId "${anchor?.stayAreaId}" is not a stay area`);
}

// ---------------------------------------------------------------- itineraries

for (const itinerary of itinerariesFile.itineraries) {
  const where = `itinerary ${itinerary.id}`;
  if (itinerary.suggestedStayArea && !stayAreaIds.has(itinerary.suggestedStayArea)) {
    fail(where, `suggestedStayArea "${itinerary.suggestedStayArea}" is not a stay area`);
  }
  for (const interest of itinerary.interests ?? []) {
    if (!interestIds.has(interest)) {
      fail(where, `interest "${interest}" is not in categories.json onboardingInterests`);
    }
  }
  const orders = itinerary.stops.map((s) => s.order);
  if (orders.some((o, i) => o !== i + 1)) {
    fail(where, 'stop `order` values must run 1..n with no gaps');
  }
  for (const stop of itinerary.stops) {
    if (!spotIds.has(stop.spotId)) fail(where, `stop ${stop.order} references unknown spot "${stop.spotId}"`);
  }
}

// -------------------------------------------------------------------- ferries

for (const route of ferriesFile.routes) {
  const where = `ferry route ${route.id}`;
  if (!regionIds.has(route.destinationRegion)) {
    fail(where, `destinationRegion "${route.destinationRegion}" is not in regions.json`);
  }
  if (!route.operators?.length) fail(where, 'at least one operator is required');
  for (const op of [...(route.operators ?? []), ...(route.aggregators ?? [])]) {
    if (!/^https:\/\//.test(op.bookingUrl ?? '')) fail(where, `operator "${op.name}" needs an https bookingUrl`);
  }
}

// --------------------------------------------------------------------- report

const byRegion = spots.reduce((acc, s) => ({ ...acc, [s.region]: (acc[s.region] ?? 0) + 1 }), {});
const byCategory = spots.reduce((acc, s) => ({ ...acc, [s.category]: (acc[s.category] ?? 0) + 1 }), {});

console.log(`\n  ${spots.length} spots, ${categoryIds.size} categories, ${regionIds.size} regions, ${stayAreaIds.size} stay areas`);
console.log(`  by region:   ${Object.entries(byRegion).map(([k, v]) => `${k} ${v}`).join('  ')}`);
console.log(`  by category: ${Object.entries(byCategory).map(([k, v]) => `${k} ${v}`).join('  ')}`);

for (const id of categoryIds) {
  if (!byCategory[id]) warn('coverage', `category "${id}" has no spots — it will render as an empty filter`);
}
for (const id of regionIds) {
  if (!byRegion[id]) warn('coverage', `region "${id}" has no spots`);
}

if (warnings.length) {
  console.log(`\n  ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`   - ${w}`);
}

if (errors.length) {
  console.error(`\n  ${errors.length} error(s):`);
  for (const e of errors) console.error(`   - ${e}`);
  console.error('');
  process.exit(1);
}

console.log('\n  All data valid.\n');
