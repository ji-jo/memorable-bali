# 03 — Data Model

Everything the MVP renders comes from five JSON files in `data/`. There is no backend, no fetch, no loading state. The build imports these files directly and Vite bundles them.

```
data/
├── bali-spots.json          54 curated places — the core dataset
├── categories.json          11 categories + the onboarding interest vocabulary
├── regions.json             7 geographic zones covering the province
├── stay-areas.json          9 onboarding stay areas (the distance anchors)
├── ferries.json             Nusa crossings, operators, indicative schedules
└── itineraries.sample.json  3 worked itineraries
```

---

## ⚠️ Read this before you trust the data

`bali-spots.json` carries a `_meta.provenance` block that says the same thing, and it is not boilerplate:

**The dataset was written from model knowledge, not from a live source.** Coordinates, opening hours, entrance fees and ratings are plausible and internally consistent, but they are **not verified**. `rating` in particular is an editorial placeholder — it is *not* a scraped Google rating, and shipping it as one would be misleading to users.

Before launch, someone must reconcile every record against Google Places. Until then, the app should not present these figures as authoritative. Descriptions, tips and best-visiting-times are editorial judgement — that curation *is* the product, so a human who knows Bali should read them.

`scripts/validate-spots.mjs` enforces structure. It cannot enforce truth.

---

## Spot

The core record. One entry per curated place.

```ts
export type SpotTag = 'Memorable' | 'Must Visit' | 'Cultural' | 'Outworldly';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Spot {
  /** Stable kebab-case slug. Used in URLs (/place/:id) and as the localStorage key. Never renumber. */
  id: string;
  name: string;

  /** 50–80 characters, enforced by the validator. One line, for list and map cards. */
  description: string;

  /** 2–3 sentences for the detail page. No length constraint. */
  longDescription: string;

  /** Deep link for the "Open in Google Maps" action. */
  googleMapsUrl: string;

  /** Always false in JSON. Real state lives in localStorage — see below. */
  visited: false;

  /** 0–5, one decimal. Editorial placeholder, NOT a Google rating. */
  rating: number;

  /** Haversine km from _meta.distanceAnchor. A fallback — recomputed at runtime. */
  distanceFromStayKm: number;

  /** One or more. A temple is often both Cultural and Must Visit. */
  tags: SpotTag[];

  /** FK → categories.json. Exactly one; the primary filter bucket. */
  category: string;

  /** FK → regions.json. Where the place IS (not where the visitor sleeps). */
  region: string;

  coordinates: Coordinates;

  /** Paths under public/. These assets do not exist yet — see "Images" below. */
  images: string[];

  openingHours: { open?: string; close?: string; note: string };

  /** Planning input for the itinerary builder. */
  visitDurationMin: number;

  cost: { currency: 'IDR'; min: number; max: number; note: string };

  /** Free text, e.g. "07:00–09:00" or "Low tide, morning". Parsed loosely for the Sunset interest. */
  bestTime: string;

  /** At least 2. This is the curation the product sells. */
  tips: string[];

  /** FKs → other spot ids. Powers "Nearby recommendations". */
  nearby: string[];

  /** null, or a route id from ferries.json. Required for region: 'nusa'. */
  ferry: string | null;
}
```

### Field decisions worth knowing

**`description` is 50–80 characters.** That is deliberately tight — it must fit one line on a card at 360px without truncating, in both list and map-preview contexts. The validator fails the build outside that range, so do not widen it casually; widen the card instead if you must.

**`visited` is always `false` in JSON.** It is per-user state. Baking a real value into a shared data file would make it wrong for every user but the first. The seed value exists so the TypeScript shape is complete and the app has a default. Actual state:

```ts
// localStorage key: bali-explorer:visited
// value: string[] of spot ids
```

Merge at read time — `{ ...spot, visited: visitedIds.includes(spot.id) }`. Never write back to the JSON.

**`distanceFromStayKm` is a fallback, not the answer.** Distance depends entirely on where the visitor is staying, which is not known until onboarding completes. The stored value is straight-line distance from Ubud (`_meta.distanceAnchor`), computed by `scripts/compute-distances.mjs`, and is what a first-run user sees before telling us anything. Once a stay area is chosen, recompute:

```ts
const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
```

Straight-line only. **Bali road distance typically runs 1.3–1.8× this**, and travel time is dominated by traffic, not distance. Label it "≈ 12 km away", never "12 km drive". For real drive times, use the Directions API (see `07-Google-Maps.md`).

**`tags` vs `category`.** `category` is the single primary bucket that drives the category chips and map pin colour. `tags` are cross-cutting editorial labels — the four the product owner specified — used for badges and secondary filtering. A spot has exactly one category and one or more tags.

**`region` is not `stayArea`.** A region is where a place *is*; a stay area is where a visitor *sleeps*. They are separate files because most curated spots (Jatiluwih, Sekumpul, Besakih, Menjangan) sit far from any stay area, so collapsing them would force dishonest values.

**Images do not exist yet.** Every `images` entry points at `/images/spots/<id>.jpg` under `public/`. Those files are not in the repo. Options, in order of preference:

1. Source and commit real photos (licensed — Unsplash, Pexels, or your own).
2. Fetch at runtime via the Places Photos API using a `place_id` — requires adding `placeId` to the schema and costs per request.
3. Ship a gradient placeholder component keyed on `category` colour so the UI is never broken while sourcing runs.

Pick (3) for the first build so nothing 404s, and treat (1) as a content task.

---

## Category

```ts
export interface Category {
  id: string;          // 'beaches', 'waterfalls', …
  label: string;       // 'Beaches'
  icon: string;        // icon name — map to your icon set
  color: string;       // hex, used for map pins and chips in light mode
  description: string;
}
```

Eleven categories, matching the product spec exactly. Every one has at least one spot except none — the validator warns if a category would render as an empty filter.

## Onboarding interests

`categories.json` also carries `onboardingInterests`, a **separate vocabulary** from categories. The onboarding spec lists interests that do not map 1:1 to categories, so the mapping is explicit data rather than logic buried in a component:

```ts
export interface OnboardingInterest {
  id: string;
  label: string;
  matchesCategories: string[];   // FK → categories
  matchesTags: SpotTag[];
  matchesBestTimeAfter?: string; // only 'sunset' uses this
  note?: string;
}
```

Two need care:

- **`sunset`** has no category. It resolves by checking whether a spot's `bestTime` contains a time at or after 16:00.
- **`shopping`** appears in the onboarding spec but has no curated spots. Its record carries `note` telling you to hide the chip until the dataset supports it. Do not render an interest that returns zero results.
- **`all`** clears every other selection and disables interest filtering entirely.

## Region

```ts
export interface Region {
  id: string;
  label: string;
  blurb: string;
  center: Coordinates;   // used to fit map bounds when filtering by region
}
```

## Stay area

```ts
export interface StayArea {
  id: string;
  label: string;
  region: string;              // FK → regions
  center: Coordinates;         // THE distance anchor
  blurb: string;
  suitsTravelStyle: ('relaxed' | 'balanced' | 'packed')[];
}
```

Onboarding also allows free-form Google Places search. A custom location produces the same `{ lat, lng }` anchor shape and works identically downstream — the rest of the app never needs to know whether the anchor came from this list or a Places result.

## Ferry route

```ts
export interface FerryRoute {
  id: string;                    // referenced by Spot.ferry
  label: string;
  destinationRegion: string;     // FK → regions
  crossingMinutes: { min: number; max: number };
  departurePorts: {
    id: string;
    name: string;
    coordinates: Coordinates;
    note: string;
    arrivesAt: string;
  }[];
  indicativeSchedule: { outbound: string[]; return: string[]; note: string };
  indicativePrice: { currency: 'IDR'; min: number; max: number; note: string };
  operators: { name: string; bookingUrl: string }[];
  aggregators: { name: string; bookingUrl: string }[];
  tips: string[];
}
```

**Schedules change constantly and crossings are cancelled for weather**, especially December–February. The UI must label these as approximate and link out to the operator. The MVP takes no payments and holds no bookings — every booking link is an external `target="_blank" rel="noopener noreferrer"`.

When an itinerary contains a spot with a non-null `ferry`, the builder must insert the crossing as its own timed segment. A Nusa Penida day that ignores a 45-minute boat each way and a hard last-return time is not a usable itinerary.

## Itinerary

```ts
export interface ItineraryStop {
  order: number;                       // 1..n, no gaps
  spotId: string;                      // FK → spots
  arriveAt: string;                    // 'HH:MM'
  dwellMinutes: number;
  travelMinutesFromPrevious: number;   // editorial estimate, not Directions output
  note?: string;
}

export interface Itinerary {
  id: string;
  title: string;
  summary: string;
  lengthOfStay: '1-day' | 'weekend' | '3-days' | '5-days' | '1-week' | '2-weeks';
  travelStyle: 'relaxed' | 'balanced' | 'packed';
  suggestedStayArea: string;           // FK → stayAreas
  interests: string[];                 // FK → onboardingInterests
  transportation: ('scooter' | 'car' | 'taxi' | 'private-driver')[];
  estimatedTotalMinutes: number;
  estimatedCost: { currency: 'IDR'; min: number; max: number; note: string };
  stops: ItineraryStop[];
}
```

The three in `itineraries.sample.json` are read-only seeds for the "Recommended Today" rail. User itineraries use the identical shape and live in localStorage:

```ts
// bali-explorer:itineraries  → Itinerary[]
// bali-explorer:visited      → string[]
// bali-explorer:onboarding   → { interests, lengthOfStay, stayArea, transportation, travelStyle, completedAt }
```

Namespace every key with `bali-explorer:`. Version the shape if you change it — a stale localStorage record from a previous build must not crash the app. Wrap all reads in try/catch and fall back to defaults.

---

## Validation

```bash
node scripts/validate-spots.mjs      # or: npm run validate:data
node scripts/compute-distances.mjs   # rewrites distanceFromStayKm + _meta.count
```

The validator checks id uniqueness and slug format, the 50–80 description window, rating range and precision, the tag enum, every foreign key (`category`, `region`, `nearby`, `ferry`, itinerary `spotId` and `interests`), coordinates inside Bali's bounding box, `visited === false`, itinerary `order` continuity, `_meta.count` accuracy, and unknown fields (schema drift). It runs in CI on every push.

### Adding a place

1. Append to `data/bali-spots.json`, copying an existing record as a template.
2. Keep `description` between 50 and 80 characters and `visited` as `false`.
3. Add at least two genuinely useful tips. A place with generic tips is not curated.
4. Set `nearby` to the genuinely closest spots. The validator warns past 60km. Reciprocity is not required — nearest-neighbour relationships are not symmetric.
5. Run `node scripts/compute-distances.mjs` — it fills the distance and fixes `_meta.count`.
6. Run `node scripts/validate-spots.mjs` and fix anything it reports.

---

## Migrating to Supabase

The schema maps to Postgres with almost no change. When the time comes:

- `spots`, `categories`, `regions`, `stay_areas`, `ferry_routes`, `itineraries`, `itinerary_stops` as tables.
- `tags` → `text[]` with a CHECK constraint, or a join table if you need to query it hard.
- `coordinates` → PostGIS `geography(Point)`, which makes distance a SQL function rather than client maths.
- `visited` → a `user_visits(user_id, spot_id)` table. This is exactly why it was never a column on the spot.
- `_meta` blocks → drop them; they exist because JSON files have nowhere else to put provenance.

Keep every data access behind `src/data/repository.ts` (see `02-Architecture.md`) and this migration touches one file.
