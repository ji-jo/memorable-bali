# 02 — Architecture

## Shape

Frontend only. React + Vite + TypeScript, static JSON bundled at build time, all user state in localStorage, deployed as static files to Vercel.

```
Browser
  ├── React app (static bundle from Vercel CDN)
  ├── data/*.json          imported at build time, no network
  ├── localStorage         onboarding, itineraries, visited, theme
  └── Google Maps JS API   lazy-loaded, only on map screens
```

No server, no database, no auth, no API routes. That is not a shortcut — it is what makes a curated fifty-place guide shippable in weeks. The one thing this architecture must protect is the seam where a backend later plugs in.

## Why these choices

| Decision | Reason |
|---|---|
| **Vite** over Next.js | No SSR need, no API routes, no server. Vite's dev server is faster and the output is a static bundle a CDN can serve for free. |
| **JSON imports** over fetch | 54 records is ~120KB of JSON. Bundling it removes an entire class of loading states, error states and race conditions. |
| **localStorage** over a backend | The MVP has no multi-device story. Adding auth to persist an itinerary would be the largest single piece of work in the project, for a feature nobody asked for yet. |
| **CSS Modules** over a UI kit | The look is the product (`04-Design-System.md`). A component library would flatten it and add bundle weight. |
| **React Router** over file routing | Vite has no built-in router; React Router is the boring, well-understood choice. |

## Folder structure

```
src/
├── main.tsx                    entry — mounts the router
├── App.tsx                     shell: theme, layout, routes
│
├── data/
│   ├── repository.ts           THE ONLY module that reads the JSON files
│   ├── types.ts                Spot, Category, Region, StayArea, Itinerary…
│   └── queries.ts              filtering, sorting, search, nearby
│
├── state/
│   ├── OnboardingContext.tsx   preferences + the distance anchor
│   ├── ItineraryContext.tsx    itineraries, add/remove/reorder
│   ├── VisitedContext.tsx      the visited set
│   └── ThemeContext.tsx        light | dark | system
│
├── hooks/
│   ├── useLocalStorage.ts      typed, versioned, try/catch wrapped
│   ├── useGoogleMaps.ts        loads the SDK once, returns status
│   ├── useDirections.ts        Directions API with in-memory cache
│   ├── useDistances.ts         haversine from the current anchor
│   └── useDebounce.ts
│
├── components/                 handcrafted, one folder each
│   ├── PlaceCard/
│   ├── MapView/
│   ├── CategoryChip/
│   ├── TagBadge/
│   ├── VisitedToggle/
│   ├── ItineraryStop/
│   ├── SpotImage/
│   └── … see 06-Components.md
│
├── screens/
│   ├── Landing/
│   ├── Onboarding/
│   ├── Home/
│   ├── Explore/
│   ├── PlaceDetail/
│   ├── Itinerary/
│   └── Ferry/
│
├── lib/
│   ├── geo.ts                  haversine, bounds, formatting
│   ├── format.ts               IDR, durations, distances
│   └── storage.ts              namespaced localStorage access
│
└── styles/
    ├── reset.css
    ├── tokens.css              every design token
    └── global.css
```

## The repository seam

**All data access goes through `src/data/repository.ts`.** No screen or component imports a JSON file directly. This is the single rule that makes the Supabase migration a one-file change instead of a rewrite.

```ts
// src/data/repository.ts
import spotsFile from '../../data/bali-spots.json';
import categoriesFile from '../../data/categories.json';
import regionsFile from '../../data/regions.json';
import stayAreasFile from '../../data/stay-areas.json';
import ferriesFile from '../../data/ferries.json';
import itinerariesFile from '../../data/itineraries.sample.json';

import type { Spot, Category, Region, StayArea, FerryRoute, Itinerary } from './types';

export const getSpots = (): Spot[] => spotsFile.spots as Spot[];
export const getSpotById = (id: string): Spot | undefined =>
  getSpots().find((s) => s.id === id);
export const getCategories = (): Category[] => categoriesFile.categories;
export const getOnboardingInterests = () => categoriesFile.onboardingInterests;
export const getRegions = (): Region[] => regionsFile.regions;
export const getStayAreas = (): StayArea[] => stayAreasFile.stayAreas;
export const getFerryRoutes = (): FerryRoute[] => ferriesFile.routes;
export const getSampleItineraries = (): Itinerary[] => itinerariesFile.itineraries;
```

Every function is synchronous today. **Return them as `Promise`s from day one if you want a painless migration** — `async` signatures that currently resolve immediately cost nothing now and save touching every call site later. Decide this before writing the first screen; changing it afterwards is the tedious kind of refactor.

Enable JSON module resolution in `tsconfig.json`:

```json
{ "compilerOptions": { "resolveJsonModule": true, "allowSyntheticDefaultImports": true } }
```

## State

Four contexts, each with a single responsibility, each persisting through `useLocalStorage`. No Redux, no Zustand — the state is small and mostly independent.

```
ThemeContext        theme preference + resolved theme
OnboardingContext   preferences, and the derived distance anchor
VisitedContext      Set<spotId>, toggled from anywhere
ItineraryContext    Itinerary[], add / remove / reorder / rename
```

Ephemeral state — filters and search text — lives in the URL query string, not in context. That makes filtered views linkable and refresh-safe for free. Map and list are not a mode to track; they're one synced view rendered two ways by breakpoint (`01-PRD.md` §F5), driven by `MapView`'s `selectedId`, which is transient UI state, not URL state.

`useLocalStorage` must be defensive. A stale record from an earlier build must never crash the app:

```ts
const STORAGE_VERSION = 1;

export function useLocalStorage<T>(key: string, initial: T) {
  const namespaced = `bali-explorer:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(namespaced);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      if (parsed?.__v !== STORAGE_VERSION) return initial;  // shape changed, discard
      return parsed.data as T;
    } catch {
      return initial;                                        // corrupt or unavailable
    }
  });
  // …persist { __v: STORAGE_VERSION, data: value } on change, also in try/catch
}
```

localStorage throws in Safari private mode and when quota is exceeded. Every read and write is wrapped.

## Routing

```
/                       Landing         (redirects to /home if onboarded)
/onboarding/:step       Onboarding      (step: 1–5)
/home                   Home
/explore                Explore         (?category=&tag=&region=&maxKm=&maxDurationMin=)
/place/:id              PlaceDetail
/itinerary              Itinerary list
/itinerary/:id          Itinerary detail
/ferry                  Ferry reference
*                       NotFound
```

Route-level code splitting with `React.lazy` for Explore, PlaceDetail, Itinerary and Ferry. Landing and Home stay in the main chunk so first paint is immediate.

## Google Maps loading

The single biggest performance risk. Rules:

1. The SDK is **never** in the initial bundle.
2. Loaded on demand by `useGoogleMaps()`, which resolves a shared promise so concurrent callers trigger one script tag.
3. Screens without a map never load it. Home's map preview counts as a map screen — either lazy-load it below the fold with an intersection observer, or use a static image placeholder until tapped.
4. Missing API key is a **degraded** state, not a crash: list view, detail pages, itineraries and distances all work without it. Only map rendering, Places search and Directions are disabled, each with an explanatory placeholder.

Details in `07-Google-Maps.md`.

## Performance

- Route-level splitting, plus a separate chunk for the Maps integration.
- `content-visibility: auto` on long card lists.
- Images: explicit dimensions, `loading="lazy"`, `decoding="async"`.
- Marker clustering above ~30 visible pins.
- Memoise derived data (`useMemo` over the filtered set), but do not memoise everything reflexively — 54 records is small, and premature memoisation costs readability.

## Error handling

- A top-level error boundary that shows a real message and a reload action, not a white screen.
- `SpotImage` falls back to a category-coloured gradient rather than a broken image icon.
- Maps failure degrades to list view with a note.
- Directions failure shows the straight-line distance and the Google Maps handoff.
- Corrupt localStorage resets to defaults silently.

## Testing

Vitest + React Testing Library. Do not chase coverage; test the things that break:

- `lib/geo.ts` — haversine against known distances.
- `data/queries.ts` — filtering, search, sorting.
- Itinerary reorder and total calculation.
- `useLocalStorage` version mismatch and corrupt-JSON paths.
- Onboarding completion writes the expected shape.

`scripts/validate-spots.mjs` is the data test and already runs in CI.

## Migration seam, restated

When Supabase arrives, the changes are:

1. `repository.ts` — swap JSON imports for Supabase queries. If the functions were already async, no call site changes.
2. `VisitedContext` — read/write a `user_visits` table instead of localStorage.
3. `ItineraryContext` — same, plus conflict handling for multi-device.
4. Add auth. Everything else stays.

Nothing else in the app should know where data comes from. If a component imports from `../../data/*.json`, that is a bug.
