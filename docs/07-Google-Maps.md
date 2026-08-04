# 07 — Google Maps Integration

Three APIs: **Maps JavaScript**, **Places**, **Directions**. All client-side.

---

## ⚠️ The key is public

Anything in a `VITE_`-prefixed variable is compiled into the bundle and readable by anyone who opens devtools. There is no way to hide it in a frontend-only app.

**The only real protection is an HTTP referrer restriction in Google Cloud.** Set it before the first deploy, not after:

```
https://your-project.vercel.app/*
https://*-your-team.vercel.app/*      ← preview deploys
https://yourdomain.com/*
http://localhost:5173/*
```

Then also:
- Restrict the key to exactly three APIs: Maps JavaScript, Places, Directions.
- Set a **daily quota cap** on each. Without one, a loop bug or a scraped key becomes a four-figure bill.
- Set a billing budget alert at a threshold you would actually notice.
- Use a **separate key for development** with a `localhost` referrer only. Never share the production key.

If a key leaks, rotate it in Google Cloud and update the Vercel env var. Rotation is cheap; a runaway bill is not.

---

## Setup

The console UI moves things around between redesigns. Searching the product name in the top search bar is more reliable than following a menu path.

1. Google Cloud Console → new project.
2. Enable **Maps JavaScript API**, **Places API**, **Directions API**. Pick **Places API**, not *Places API (Legacy)* — the legacy one does not serve `AutocompleteSuggestion`.
3. Enable billing (required even inside the free tier — without it the Maps SDK returns `BillingNotEnabledMapError`).
4. Credentials → Create API key → apply the restrictions above. Restrictions can take ~5 minutes to propagate; do not start debugging a failure before then.
5. Maps → Map Management → create a **Map ID** with **vector** rendering. Required for `AdvancedMarkerElement` and for cloud-based styling. Create two (light and dark) and a Map Style for each.
6. **Quotas & reservations** → set a daily cap on each of the three APIs. This is a separate console area from the key's restriction page and is easy to miss — but it is the control that actually bounds spend.

```bash
cp .env.example .env.local
# fill in VITE_GOOGLE_MAPS_API_KEY and VITE_GOOGLE_MAPS_MAP_ID
```

`.env.local` is gitignored. Never commit a real key.

---

## Loading the SDK

The SDK must **never** be in the initial bundle. Load it on demand, once, with a shared promise so concurrent callers do not inject two script tags.

```ts
// src/hooks/useGoogleMaps.ts
let loaderPromise: Promise<typeof google.maps> | null = null;

function loadMaps(): Promise<typeof google.maps> {
  if (loaderPromise) return loaderPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error('NO_API_KEY'));

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${key}` +
      `&libraries=places,marker,geometry&loading=async&v=weekly`;
    script.async = true;
    script.onload = () => resolve(google.maps);
    script.onerror = () => {
      loaderPromise = null;               // allow a retry
      reject(new Error('MAPS_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export function useGoogleMaps() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadMaps()
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch((err) => { if (!cancelled) { setError(err); setStatus('error'); } });
    return () => { cancelled = true; };
  }, []);

  return { status, error, maps: status === 'ready' ? google.maps : null };
}
```

**Degradation is a requirement, not a nicety.** With no key or a failed load, the app must still work: list view, detail pages, itineraries, haversine distances and the Google Maps handoff all function. Only map rendering, Places autocomplete and Directions are disabled, each with an explanatory placeholder rather than a blank box.

---

## The map

```ts
const map = new maps.Map(el, {
  center: anchor,
  zoom: 11,
  mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID,
  disableDefaultUI: true,      // the design system provides controls
  gestureHandling: 'greedy',   // one-finger pan on mobile
  clickableIcons: false,       // stop taps opening Google's own POIs
  minZoom: 8,
  maxZoom: 18,
});
```

`clickableIcons: false` matters more than it looks — without it, users tap Google's POI labels and get Google's place cards instead of our curated ones, which quietly undermines the whole product.

### Bali bounds

```ts
export const BALI_BOUNDS = {
  north: -8.0, south: -9.2, west: 114.4, east: 115.8,
};
map.fitBounds(BALI_BOUNDS);   // sensible default view
```

Same box the data validator uses, so a spot that renders off-island fails CI first.

### Theming

Create two styles in Cloud Console (Map Management → Map Styles) and two Map IDs, or apply a JSON style array at runtime. Cloud styling is preferable — it keeps the style out of the bundle and lets it be tuned without a deploy.

The dark map must be genuinely dark (`#131211`-family surfaces from `04-Design-System.md`), not Google's default "night" preset, which is blue and clashes with the warm palette.

Switch on `ThemeContext` change by recreating the map with the other Map ID. Vector maps cannot swap Map IDs in place.

### Markers

Use `AdvancedMarkerElement` (requires a vector Map ID) so pins can be real DOM nodes styled with CSS:

```ts
const pin = document.createElement('div');
pin.className = styles.pin;
pin.style.setProperty('--pin-color', category.color);

new maps.marker.AdvancedMarkerElement({ map, position: spot.coordinates, content: pin });
```

Never use the default red Google pin. Cluster above ~30 visible markers — either `@googlemaps/markerclusterer` or a simple grid-based clusterer; with 54 spots the naive approach is fine.

**Clean up on unmount.** Detach every marker (`marker.map = null`) and remove listeners, or repeated Explore visits leak markers and the map degrades.

---

## Places

Used in exactly one place: the onboarding "staying area" search.

```ts
const { AutocompleteSuggestion } = await maps.importLibrary('places');

const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
  input: query,
  includedRegionCodes: ['id'],
  locationRestriction: BALI_BOUNDS,
  sessionToken,                       // ← billing
});
```

Two rules:

1. **Always pass a session token.** Autocomplete billed without one is charged per keystroke; with one, an entire typing session plus the final details fetch bills as a single request. Create a fresh token per search session and discard it after the details call.
2. **Debounce at least 300ms** and require 3+ characters before firing. This is a cost control, not a UX preference.

Restrict to Bali with `locationRestriction` so results stay relevant.

`AutocompleteService` and `PlacesService` are the legacy classes and are being retired — use `AutocompleteSuggestion` and `Place` for new work.

### Optional: real photos and ratings

The Places API can supply genuine photos and Google ratings, which would resolve two known gaps in the dataset (`03-Data-Model.md`). It requires adding a `placeId` to each spot and costs per request. If you do this, cache aggressively — photo URLs are stable for a while, and re-fetching on every render is a fast way to a large bill.

---

## Directions

```ts
const service = new maps.DirectionsService();

const result = await service.route({
  origin,
  destination,
  waypoints: middle.map((s) => ({ location: s.coordinates, stopover: true })),
  optimizeWaypoints: true,
  travelMode: maps.TravelMode.DRIVING,
});
```

### Travel mode

| Onboarding choice | API mode |
|---|---|
| Scooter | `DRIVING` |
| Car | `DRIVING` |
| Taxi | `DRIVING` |
| Private driver | `DRIVING` |

**There is no two-wheeler mode for Indonesia.** Scooter routes and durations genuinely differ — scooters use shortcuts cars cannot and are less affected by jams. Say this in the UI rather than presenting a car estimate as a scooter estimate.

### Cost control

Directions is the most expensive of the three APIs, and an itinerary screen that recalculates on every render is the classic way to burn quota.

- Cache results in memory keyed by the ordered stop ids. Recompute only when the order changes.
- Limit waypoints to 10 (`optimizeWaypoints: true` allows up to 25 but pricing rises).
- Debounce recalculation after reorders — do not fire mid-drag.
- On failure, fall back to `haversineKm × 1.5` as a rough drive estimate and **label it as an estimate**.

---

## Handoff to Google Maps

```ts
// Navigate to one place
`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`

// View a place
`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
```

The second form is what `googleMapsUrl` already holds in `bali-spots.json`. Always `target="_blank" rel="noopener noreferrer"`.

On mobile these open the native app when installed. Do not try to detect it — the universal URL handles it.

---

## Cost model

Google **retired the $200 monthly credit in March 2025**. If you find a tutorial that mentions it, that tutorial is out of date.

The current model is a monthly free call allowance **per SKU**, in the Essentials tier 10,000 calls per SKU per month (Map Tiles SKUs get 100,000). It resets on the 1st at midnight Pacific. Check the [pricing page](https://developers.google.com/maps/billing-and-pricing/pricing) for the current figures and which tier each API sits in — both change, and neither is worth hardcoding into this doc.

**The allowances are per-product, not a shared pot.** That is the consequential difference. A render loop calling Directions will burn through the Directions allowance while Maps and Places sit barely touched, so nothing in an aggregate view looks wrong until the bill arrives. This is why per-API daily quota caps are load-bearing rather than merely prudent.

At MVP traffic this is comfortably free. The shape of usage matters far more than the volume:

| API | Charged per | Watch for |
|---|---|---|
| Maps JavaScript | map load | Remounting the map on every Explore visit |
| Places Autocomplete | session (with token) / request (without) | Missing session token — the single most expensive mistake here |
| Place Details | request | Fetching on hover or render instead of on selection |
| Directions | request | Recalculating on every itinerary render |

Set daily quota caps on all three. A cap that occasionally degrades the app is strictly better than an uncapped key.

---

## Testing without a key

The app must be developable and reviewable with no key at all:

- `MapView` renders an `EmptyState` explaining maps are unavailable.
- Explore defaults to list view.
- Places search falls back to the nine preset stay areas.
- Directions falls back to the haversine estimate.
- **No screen crashes, no blank grey boxes, no console errors.**

This is also how CI runs, and how a reviewer opening a preview deploy without secrets will see it — so treat the no-key path as a real user journey, not an error case.
