#!/usr/bin/env node
/**
 * Download spot images from Unsplash into public/images/spots/.
 *
 * Unsplash guidelines (summarized):
 * - Non-automated, high-quality, authentic use — not an Unsplash clone / wallpaper app.
 * - Keep Access Key + Secret confidential (server / local scripts only — never VITE_*).
 * - Do not abuse rate limits (demo ≈ 50 JSON req/hour; production ≈ 1000).
 * - When downloading a photo, hit the photo's `links.download_location` endpoint.
 *
 * Setup:
 *   1. Create an app at https://unsplash.com/developers
 *   2. Put UNSPLASH_ACCESS_KEY=... in project-root `.env` (gitignored)
 *   3. npm run fetch:spot-images
 *
 * Demo keys ≈ 50 JSON requests/hour. Prefer batches:
 *   npm run fetch:spot-images -- --limit=15
 * Re-run later; existing local files are skipped.
 *
 * Flags:
 *   --force          re-download even if a local file exists
 *   --ids=a,b        only these spot ids
 *   --limit=N        stop after N successful saves (useful under demo rate limits)
 *   --fallback-only  use category/theme queries only (skip exact spot-name search)
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const data = JSON.parse(await readFile(path.join(root, 'data', 'bali-spots.json'), 'utf8'));
const outDir = path.join(root, 'scripts', 'output');

const force = process.argv.includes('--force');
const fallbackOnly = process.argv.includes('--fallback-only');
const allowCommons = process.argv.includes('--allow-commons');
const commonsOnly = process.argv.includes('--commons-only');
const idsArgument = process.argv.find((argument) => argument.startsWith('--ids='));
const selectedIds = idsArgument ? new Set(idsArgument.slice('--ids='.length).split(',')) : null;
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const saveLimit = limitArgument ? Number(limitArgument.slice('--limit='.length)) : null;

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

/** Gap between Unsplash JSON calls — stay polite under the demo 50/hour cap. */
const REQUEST_GAP_MS = 1200;

let lastRequestAt = 0;

async function loadEnvFileFallback() {
  // Prefer shell / --env-file; otherwise load gitignored env files.
  const candidates = ['.env.local', '.env'];
  for (const name of candidates) {
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
      // file optional
    }
  }
}

await loadEnvFileFallback();

const resolvedKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
if (!resolvedKey && !commonsOnly) {
  console.error(
    [
      'Missing UNSPLASH_ACCESS_KEY.',
      '',
      'Put it in the project-root .env or .env.local file (never commit it, never use VITE_):',
      '  UNSPLASH_ACCESS_KEY=your_access_key_here',
      '',
      'Then run:',
      '  npm run fetch:spot-images',
      '',
      'Get a key at https://unsplash.com/developers',
    ].join('\n'),
  );
  process.exit(1);
}

/** Theme queries when the exact place name has no good Unsplash hit. */
const fallbackQueries = {
  adventure: 'Bali diving underwater Indonesia',
  beaches: 'Bali beach Indonesia tropical',
  culture: 'Balinese culture temple ceremony',
  food: 'Balinese food Indonesia cuisine',
  'hidden-gems': 'Bali hidden beach cliff landscape',
  hotels: 'boutique hotel villa tropical Bali',
  nature: 'Bali rice terrace landscape Indonesia',
  photography: 'Bali coast cliff landscape sunset',
  temples: 'Balinese temple Indonesia architecture',
  waterfalls: 'Bali waterfall jungle Indonesia',
  wellness: 'yoga retreat tropical pavilion Bali',
};

/** Prefer these Unsplash search strings for hard-to-match / easily confused spots. */
const spotQueries = {
  'tegallalang-rice-terrace': 'Tegallalang rice terrace Bali',
  'goa-gajah': 'Goa Gajah elephant cave Bali',
  'campuhan-ridge-walk': 'Campuhan Ridge Walk Ubud Bali',
  'tukad-cepung-waterfall': 'Tukad Cepung waterfall cave Bali',
  'banyumala-twin-waterfall': 'Banyumala twin waterfall Bali',
  'yoga-barn-ubud': 'yoga class tropical open pavilion Bali',
  'seniman-coffee-studio': 'coffee shop interior specialty cafe Bali',
  'echo-beach-canggu': 'Echo Beach Canggu surf Bali',
  'double-six-sunset': 'Seminyak beach sunset Bali',
  'sanur-beach-walk': 'Sanur beach sunrise Bali',
  'suluban-beach': 'Suluban Beach Uluwatu cave cliffs Bali',
  'melasti-beach': 'Melasti Beach Bali limestone cliffs turquoise',
  'bali-museum-denpasar': 'Denpasar Bali traditional temple museum building',
  'diamond-beach': 'Diamond Beach Nusa Penida',
  'crystal-bay': 'Crystal Bay Nusa Penida',
  'wanagiri-hidden-hills': 'Danau Buyan Tamblingan',
  'menjangan-island': 'Menjangan Island Bali diving',
  'angels-billabong': 'Angels Billabong Nusa Penida',
  'devils-tear-lembongan': "Devil's Tear Nusa Lembongan",
  'batur-natural-hot-spring': 'hot spring pool volcanic mountain Bali',
  'akasa-batur': 'coffee shop mountain lake view Bali',
  'pura-taman-kemuda-saraswati': 'Ubud Water Palace lotus temple Bali',
  'inap-retreat-boutique-cabin': 'boutique cabin mountain lake Bali',
  'villa-bukit-temawang': 'luxury villa rice field view Bali',
  'padma-resort-ubud': 'resort infinity pool jungle Bali',
  'rumah-subak': 'rice terrace villa boutique stay Bali',
  'warung-betutu-dewi-sri': 'Balinese roast duck warung food',
  'roti-bohemia-nyuh-kuning': 'bakery pastry cafe tropical Bali',
  'tukies-coconut-shop': 'fresh coconut drink tropical stall',
  'sate-pepes-bu-ribu': 'Indonesian satay grilled seafood stall',
  'warung-mak-beng': 'Balinese seafood warung Sanur',
  'lolas-sanur': 'craft beer bar tropical night',
  'daily-baguette-sanur': 'bakery baguette cafe breakfast',
  'la-baracca-ubud': 'Italian restaurant pasta trattoria',
};

const spotFallbackQueries = {
  'seniman-coffee-studio': 'specialty coffee cafe interior',
  'yoga-barn-ubud': 'yoga class tropical pavilion retreat',
  'la-brisa-canggu': 'beach club restaurant ocean Bali',
  'crate-cafe-canggu': 'cafe coffee brunch tropical',
  'green-bowl-beach': 'hidden beach cliff cave Bali',
  'tulamben-liberty-wreck': 'scuba diving shipwreck underwater Indonesia',
  'bali-museum-denpasar': 'Balinese museum architecture courtyard',
  'wanagiri-hidden-hills': 'Bali twin lakes mountain viewpoint',
  'menjangan-island': 'tropical island snorkeling coral reef Indonesia',
  'devils-tear-lembongan': 'ocean cliff waves splash Indonesia',
  'petitenget-temple': 'Balinese seaside Hindu temple',
  'goa-gajah': 'ancient stone cave temple Bali carving',
  'angels-billabong': 'natural rock pool ocean cliff Bali',
};

async function existingFileHasContent(filePath) {
  try {
    return (await stat(filePath)).size > 1024;
  } catch {
    return false;
  }
}

async function unsplashFetch(url, { countAgainstLimit = true } = {}) {
  if (countAgainstLimit) {
    const wait = REQUEST_GAP_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${resolvedKey}`,
      'Accept-Version': 'v1',
      'User-Agent': 'MemorableBaliImageFetcher/0.1 (local curated travel app)',
    },
  });

  if (countAgainstLimit) lastRequestAt = Date.now();

  const remaining = Number(response.headers.get('x-ratelimit-remaining'));
  const limit = Number(response.headers.get('x-ratelimit-limit'));
  if (Number.isFinite(remaining) && Number.isFinite(limit)) {
    console.log(`  rate ${remaining}/${limit} remaining`);
  }

  if (response.status === 403 || response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const err = new Error(
      `Unsplash rate limited (HTTP ${response.status}). ` +
        (Number.isFinite(retryAfter)
          ? `Retry after ~${retryAfter}s.`
          : 'Wait about an hour on demo keys (50 JSON req/hour), then re-run — existing files are skipped.'),
    );
    err.code = 'RATE_LIMIT';
    throw err;
  }

  return response;
}

async function searchUnsplash(query) {
  const url = new URL('https://api.unsplash.com/search/photos');
  url.search = new URLSearchParams({
    query,
    per_page: '1',
    orientation: 'landscape',
    content_filter: 'high',
  });

  const response = await unsplashFetch(url);
  if (!response.ok) {
    console.warn(`  search failed (${response.status}) for "${query}"`);
    return null;
  }

  const result = await response.json();
  return result.results?.[0] ?? null;
}

async function triggerDownload(photo) {
  const location = photo.links?.download_location;
  if (!location) return;
  // Required by Unsplash API guidelines when a photo is downloaded (not only viewed).
  const response = await unsplashFetch(location);
  if (!response.ok) {
    console.warn(`  download trigger failed (${response.status}) for ${photo.id}`);
  }
}

function photoImageUrl(photo) {
  // Regular ≈1080px wide; good source before optimize-spot-images.mjs.
  return photo.urls?.regular ?? photo.urls?.full ?? photo.urls?.raw ?? null;
}

function queriesFor(spot) {
  const theme = spotFallbackQueries[spot.id] ?? fallbackQueries[spot.category] ?? `${spot.category} Bali`;
  if (fallbackOnly) return [theme];
  const primary = spotQueries[spot.id] ?? `${spot.name} Bali Indonesia`;
  // Primary (curated or exact name), then theme — keep JSON calls low under the demo rate limit.
  return primary === theme ? [primary] : [primary, theme];
}

async function findPhoto(spot) {
  if (!commonsOnly) {
    for (const query of queriesFor(spot)) {
      const photo = await searchUnsplash(query);
      if (photo) {
        return { photo, query, source: 'unsplash' };
      }
    }
  }
  return null;
}

function looksLikeMapOrDiagram(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  return /locator map|location map|\bmap of\b|administrative map|svg map|diagram|coat of arms|flag of|logo of/.test(
    text,
  );
}

async function commonsImage(query) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo|info',
    inprop: 'url',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '1400',
    origin: '*',
  });

  const response = await fetch(url, {
    headers: { 'User-Agent': 'MemorableBaliImageFetcher/0.1 (local curated travel app)' },
  });
  if (!response.ok) return null;
  const result = await response.json();
  const pages = Object.values(result.query?.pages ?? {}).sort(
    (a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER),
  );

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.mime?.startsWith('image/') || info.mime === 'image/svg+xml') continue;
    const title = page.title ?? '';
    const description = info.extmetadata?.ImageDescription?.value ?? '';
    if (looksLikeMapOrDiagram(title, description)) continue;
    if (/map|diagram|\.svg/i.test(title)) continue;
    const imageUrl = info.thumburl ?? info.url;
    if (imageUrl) return { url: imageUrl, title, query };
  }
  return null;
}

async function findCommons(spot) {
  for (const query of queriesFor(spot)) {
    const found = await commonsImage(query);
    if (found) return found;
  }
  return null;
}

const attribution = [];
let saved = 0;

try {
  for (const spot of data.spots) {
    if (selectedIds && !selectedIds.has(spot.id)) continue;
    if (saveLimit != null && saved >= saveLimit) {
      console.log(`limit  reached --limit=${saveLimit}; re-run later for the rest`);
      break;
    }

    const relativePath = spot.images[0].replace(/^\//, '');
    const targetPath = path.join(root, 'public', relativePath);
    if (!force && (await existingFileHasContent(targetPath))) {
      console.log(`keep  ${spot.id}`);
      continue;
    }

    console.log(`fetch ${spot.id}`);
    let source = null;
    let attributionEntry = null;

    if (!commonsOnly) {
      try {
        const found = await findPhoto(spot);
        if (found) {
          const { photo, query } = found;
          await triggerDownload(photo);
          source = photoImageUrl(photo);
          attributionEntry = {
            spotId: spot.id,
            query,
            source: 'unsplash',
            photoId: photo.id,
            photographer: photo.user?.name ?? null,
            username: photo.user?.username ?? null,
            profileUrl: photo.user?.links?.html
              ? `${photo.user.links.html}?utm_source=memorable_bali&utm_medium=referral`
              : null,
            photoUrl: photo.links?.html
              ? `${photo.links.html}?utm_source=memorable_bali&utm_medium=referral`
              : null,
            localPath: `/${relativePath.replace(/\\/g, '/')}`,
            downloadedAt: new Date().toISOString(),
          };
        }
      } catch (error) {
        if (error?.code === 'RATE_LIMIT') {
          if (!allowCommons && !commonsOnly) throw error;
          console.warn(`  unsplash rate limited — trying Commons for ${spot.id}`);
        } else {
          throw error;
        }
      }
    }

    if (!source && (allowCommons || commonsOnly)) {
      const commons = await findCommons(spot);
      if (commons) {
        source = commons.url;
        attributionEntry = {
          spotId: spot.id,
          query: commons.query,
          source: 'commons',
          title: commons.title,
          localPath: `/${relativePath.replace(/\\/g, '/')}`,
          downloadedAt: new Date().toISOString(),
        };
      }
    }

    if (!source) {
      console.warn(`skip  ${spot.id} — no image found`);
      continue;
    }

    const imageResponse = await fetch(source, {
      headers: { 'User-Agent': 'MemorableBaliImageFetcher/0.1 (local curated travel app)' },
    });
    const mime = imageResponse.headers.get('content-type') ?? '';
    if (!imageResponse.ok || !mime.startsWith('image/')) {
      console.warn(`skip  ${spot.id} — image download failed`);
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, new Uint8Array(await imageResponse.arrayBuffer()));

    if (attributionEntry) attribution.push(attributionEntry);

    saved += 1;
    const who =
      attributionEntry?.username ?? attributionEntry?.title ?? attributionEntry?.source ?? 'unknown';
    console.log(`saved ${spot.id} ← ${who}`);
  }
} catch (error) {
  if (error?.code === 'RATE_LIMIT') {
    console.error(`\n${error.message}`);
    console.error('Partial progress is kept. Re-run the same command after the window resets.');
    console.error('Or fill gaps now: npm run fetch:spot-images -- --ids=... --commons-only');
  } else {
    throw error;
  }
}

if (attribution.length > 0) {
  await mkdir(outDir, { recursive: true });
  const attributionPath = path.join(outDir, 'unsplash-attribution.json');
  let previous = [];
  try {
    previous = JSON.parse(await readFile(attributionPath, 'utf8'));
    if (!Array.isArray(previous)) previous = [];
  } catch {
    previous = [];
  }
  const bySpot = new Map(previous.map((entry) => [entry.spotId, entry]));
  for (const entry of attribution) bySpot.set(entry.spotId, entry);
  await writeFile(attributionPath, `${JSON.stringify([...bySpot.values()], null, 2)}\n`);
  console.log(`wrote ${path.relative(root, attributionPath)} (${attribution.length} new)`);
}

console.log(`done  ${saved} saved`);
