#!/usr/bin/env node
/**
 * Validate curated spots against LocationIQ Search (forward geocode).
 *
 * Requires: LOCATION_IQ_ACCESS_TOKEN in `.env` / `.env.local` (never VITE_*).
 *
 * Usage:
 *   npm run reconcile:locationiq
 *   npm run reconcile:locationiq -- --apply
 *   npm run reconcile:locationiq -- --ids=uluwatu-temple,tanah-lot
 *   npm run reconcile:locationiq -- --limit=10
 *
 * Without --apply, writes scripts/output/locationiq-reconcile-report.json only.
 * With --apply, updates coordinates (and googleMapsUrl) when delta > 50m and
 * the match looks confident (name overlap + within Bali).
 *
 * Free-tier etiquette: ~2 req/s — this script waits ~550ms between calls.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const spotsPath = path.join(root, 'data', 'bali-spots.json');
const outDir = path.join(root, 'scripts', 'output');
const reportPath = path.join(outDir, 'locationiq-reconcile-report.json');

const apply = process.argv.includes('--apply');
const idsArgument = process.argv.find((argument) => argument.startsWith('--ids='));
const selectedIds = idsArgument ? new Set(idsArgument.slice('--ids='.length).split(',')) : null;
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const saveLimit = limitArgument ? Number(limitArgument.slice('--limit='.length)) : null;

/** Same island box as validate-spots / geo.ts BALI_BOUNDS (slightly padded). */
const BALI_VIEWBOX = '114.3,-8.0,115.9,-9.3'; // min_lon,max_lat,max_lon,min_lat
const SEARCH_URL = 'https://us1.locationiq.com/v1/search';
const REQUEST_GAP_MS = 550;
const APPLY_MIN_DELTA_KM = 0.05;
const WARN_DELTA_KM = 0.5;
const FAIL_DELTA_KM = 2.5;

const NAME_STOPWORDS = new Set([
  'bali',
  'indonesia',
  'beach',
  'temple',
  'waterfall',
  'cafe',
  'studio',
  'sanctuary',
  'rice',
  'terrace',
  'terraces',
  'valley',
  'island',
  'bay',
  'natural',
  'hot',
  'spring',
  'walk',
  'museum',
  'palace',
  'water',
  'the',
  'and',
  'of',
  'resort',
  'villa',
  'hotel',
  'warung',
  'shop',
  'seafood',
]);

async function loadEnvFileFallback() {
  for (const name of ['.env.local', '.env']) {
    try {
      const raw = await readFile(path.join(root, name), 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
    } catch {
      // optional
    }
  }
}

await loadEnvFileFallback();

const apiKey = process.env.LOCATION_IQ_ACCESS_TOKEN?.trim();
if (!apiKey) {
  console.error(
    [
      'Missing LOCATION_IQ_ACCESS_TOKEN.',
      'Put it in the project-root .env or .env.local (never commit it, never use VITE_):',
      '  LOCATION_IQ_ACCESS_TOKEN=your_access_token_here',
      'https://locationiq.com/ → Dashboard → API Access Tokens',
    ].join('\n'),
  );
  process.exit(1);
}

const spotsFile = JSON.parse(await readFile(spotsPath, 'utf8'));
const spots = (spotsFile.spots ?? spotsFile).filter((spot) =>
  selectedIds ? selectedIds.has(spot.id) : true,
);

const results = [];
let processed = 0;

for (const spot of spots) {
  if (saveLimit != null && processed >= saveLimit) break;
  processed += 1;

  const query = `${spot.name}, Bali, Indonesia`;
  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    format: 'json',
    limit: '3',
    countrycodes: 'id',
    viewbox: BALI_VIEWBOX,
    bounded: '1',
    addressdetails: '1',
    normalizecity: '1',
  });

  let response;
  try {
    response = await fetch(`${SEARCH_URL}?${params}`);
  } catch (error) {
    results.push({
      id: spot.id,
      name: spot.name,
      status: 'error',
      error: String(error?.message ?? error),
    });
    await sleep(REQUEST_GAP_MS);
    continue;
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After') ?? 2);
    console.warn(`Rate limited on ${spot.id}; waiting ${retryAfter}s…`);
    await sleep(Math.max(retryAfter, 2) * 1000);
    // One retry.
    response = await fetch(`${SEARCH_URL}?${params}`);
  }

  if (!response.ok) {
    // Retry once with a simpler query (LocationIQ 404 = unable to geocode).
    if (response.status === 404) {
      const fallback = new URLSearchParams({
        key: apiKey,
        q: `${spot.name}, Bali`,
        format: 'json',
        limit: '5',
        countrycodes: 'id',
        viewbox: BALI_VIEWBOX,
        bounded: '0',
      });
      await sleep(REQUEST_GAP_MS);
      response = await fetch(`${SEARCH_URL}?${fallback}`);
    }
  }

  if (!response.ok) {
    const text = await response.text();
    results.push({
      id: spot.id,
      name: spot.name,
      status: 'error',
      error: `${response.status} ${text.slice(0, 240)}`,
    });
    await sleep(REQUEST_GAP_MS);
    continue;
  }

  const hits = await response.json();
  if (!Array.isArray(hits) || hits.length === 0) {
    results.push({ id: spot.id, name: spot.name, status: 'not_found', query });
    await sleep(REQUEST_GAP_MS);
    continue;
  }

  const ranked = hits
    .map((hit) => rankHit(spot, hit))
    .sort((a, b) => b.score - a.score || a.deltaKm - b.deltaKm);

  const best = ranked[0];
  const distinctiveOk = best && best.nameScore >= 0.45 && best.distinctiveHits > 0;
  if (!best || best.score < 0.45 || !distinctiveOk) {
    results.push({
      id: spot.id,
      name: spot.name,
      status: 'weak_match',
      query,
      candidates: ranked.slice(0, 3).map(summarizeRanked),
    });
    await sleep(REQUEST_GAP_MS);
    continue;
  }

  let confidence = 'ok';
  if (best.deltaKm >= FAIL_DELTA_KM) confidence = 'far';
  else if (best.deltaKm >= WARN_DELTA_KM) confidence = 'warn';

  const entry = {
    id: spot.id,
    name: spot.name,
    status: 'matched',
    confidence,
    query,
    displayName: best.displayName,
    placeId: best.placeId,
    type: best.type,
    class: best.class,
    current: spot.coordinates,
    suggested: best.coordinates,
    deltaKm: round3(best.deltaKm),
    score: round3(best.score),
    alternatives: ranked.slice(1, 3).map(summarizeRanked),
  };
  results.push(entry);

  if (apply && best.deltaKm > APPLY_MIN_DELTA_KM && confidence !== 'far' && best.score >= 0.55) {
    spot.coordinates = best.coordinates;
    spot.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${best.coordinates.lat},${best.coordinates.lng}`;
    if (best.placeId && !spot.placeId) spot.placeId = `locationiq:${best.placeId}`;
  }

  process.stdout.write(
    `${confidence === 'ok' ? '·' : confidence === 'warn' ? '!' : '×'} ${spot.id}  ${round3(best.deltaKm)} km  ${best.displayName}\n`,
  );

  await sleep(REQUEST_GAP_MS);
}

await mkdir(outDir, { recursive: true });

const summary = summarizeReport(results);
const report = {
  generatedAt: new Date().toISOString(),
  provider: 'locationiq',
  apply,
  summary,
  results,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (apply) {
  spotsFile._meta = {
    ...(spotsFile._meta ?? {}),
    lastLocationIqReconcile: new Date().toISOString().slice(0, 10),
    provenance: {
      ...(spotsFile._meta?.provenance ?? {}),
      status: 'LOCATIONIQ_RECONCILED',
      note: 'Coordinates refreshed via LocationIQ Search. Review deltas in scripts/output/locationiq-reconcile-report.json.',
    },
  };
  if (typeof spotsFile._meta.count === 'number') {
    spotsFile._meta.count = (spotsFile.spots ?? spots).length;
  }
  await writeFile(spotsPath, `${JSON.stringify(spotsFile, null, 2)}\n`);
  console.log(`Applied confident coordinate updates to ${spotsPath}`);
}

console.log(
  [
    `Wrote ${reportPath}`,
    `matched=${summary.matched}  warn=${summary.warn}  far=${summary.far}  weak=${summary.weak_match}  missing=${summary.not_found}  error=${summary.error}`,
  ].join('\n'),
);

if (summary.far + summary.weak_match + summary.not_found + summary.error > 0) {
  process.exitCode = 2;
}

function summarizeReport(rows) {
  const summary = {
    total: rows.length,
    matched: 0,
    ok: 0,
    warn: 0,
    far: 0,
    weak_match: 0,
    not_found: 0,
    error: 0,
  };
  for (const row of rows) {
    if (row.status === 'matched') {
      summary.matched += 1;
      if (row.confidence === 'ok') summary.ok += 1;
      else if (row.confidence === 'warn') summary.warn += 1;
      else if (row.confidence === 'far') summary.far += 1;
    } else if (summary[row.status] != null) {
      summary[row.status] += 1;
    }
  }
  return summary;
}

function rankHit(spot, hit) {
  const coordinates = {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
  };
  const deltaKm = haversineKm(spot.coordinates, coordinates);
  const displayName = hit.display_name ?? '';
  const { score: nameScore, distinctiveHits } = nameSimilarity(
    spot.name,
    hit.display_name,
    hit.name,
  );
  // Prefer nearby POIs — curated pins are usually already close.
  const distanceScore = Math.max(0, 1 - deltaKm / 4);
  const baliBonus = inBali(coordinates) ? 0.1 : -0.5;
  const classBonus = poiClassBonus(hit.class, hit.type);
  const adminPenalty = isGenericAdminHit(hit) ? -0.45 : 0;
  const score =
    nameScore * 0.5 + distanceScore * 0.35 + baliBonus + classBonus + adminPenalty;

  return {
    displayName,
    placeId: hit.place_id != null ? String(hit.place_id) : null,
    type: hit.type ?? null,
    class: hit.class ?? null,
    coordinates,
    deltaKm,
    score,
    nameScore,
    distinctiveHits,
  };
}

function summarizeRanked(ranked) {
  return {
    displayName: ranked.displayName,
    coordinates: ranked.coordinates,
    deltaKm: round3(ranked.deltaKm),
    score: round3(ranked.score),
    nameScore: round3(ranked.nameScore),
    type: ranked.type,
  };
}

function nameSimilarity(spotName, displayName = '', shortName = '') {
  const target = normalizeName(spotName);
  const hay = normalizeName(`${shortName} ${displayName}`);
  if (!target || !hay) return { score: 0, distinctiveHits: 0 };

  const tokens = target.split(' ').filter(Boolean);
  const distinctive = tokens.filter((token) => token.length >= 4 && !NAME_STOPWORDS.has(token));
  const check = distinctive.length > 0 ? distinctive : tokens.filter((token) => token.length > 2);
  if (check.length === 0) return { score: 0, distinctiveHits: 0 };

  const distinctiveHits = check.filter((token) => hay.includes(token)).length;
  let score = distinctiveHits / check.length;

  if (shortName && normalizeName(shortName) === target) score = 1;
  else if (hay.includes(target)) score = Math.max(score, 0.95);

  return { score, distinctiveHits };
}

function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericAdminHit(hit) {
  const cls = hit.class ?? '';
  const type = hit.type ?? '';
  if (cls === 'boundary' || cls === 'place') {
    return ['island', 'state', 'region', 'county', 'city', 'town', 'village', 'suburb', 'neighbourhood'].includes(
      type,
    );
  }
  const name = normalizeName(hit.display_name ?? '');
  // e.g. "Bali, Badung, Bali, Indonesia"
  const parts = name.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length <= 4 && parts.every((part) => NAME_STOPWORDS.has(part) || part === 'badung' || part === 'nusa tenggara');
}

function poiClassBonus(cls, type) {
  if (['tourism', 'natural', 'amenity', 'historic', 'leisure', 'waterway'].includes(cls)) return 0.12;
  if (type === 'attraction' || type === 'viewpoint') return 0.08;
  return 0;
}

function inBali({ lat, lng }) {
  return lat <= -8.0 && lat >= -9.3 && lng >= 114.3 && lng <= 115.9;
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

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
