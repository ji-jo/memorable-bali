# 05 — User Flows

## Map of the app

```
Landing
   │  (onboarded? → Home)
   ▼
Onboarding 1..5 ──skip──┐
   │                    │
   ▼                    ▼
  Home ◄──────────────────
   ├── Search overlay
   ├── Category chip ──► Explore (filtered)
   ├── Card ───────────► Place detail
   └── Map preview ────► Explore (map)

Explore  ⇄  map | list          (filters preserved across the toggle)
   └── pin / card ────────────► Place detail

Place detail
   ├── Add to itinerary ──────► Itinerary
   ├── Mark visited            (in place, optimistic)
   ├── Navigate ──────────────► In-app directions
   ├── Open in Google Maps ───► external
   └── Nearby card ───────────► Place detail (recursive)

Itinerary
   ├── Reorder
   ├── Optimise route
   └── Stop ──────────────────► Place detail
```

---

## Flow 1 — First run

**Goal**: from cold open to a Home screen that feels personalised, in under a minute.

1. Landing. Hero, one line, **Start** and **Skip**.
2. Steps 1–5 (interests → length of stay → staying area → transportation → travel style). Each has back, skip, and a progress indicator. Selections persist when backing up.
3. On finish, write `bali-explorer:onboarding` and route to Home.

**Skip at any point** completes onboarding with defaults: all interests, 1 week, Ubud anchor, scooter, balanced. Never leave a partially-written record — a half-finished onboarding must still produce a usable app.

**Return visits**: `/` finds the localStorage record and redirects to `/home` before first paint. The landing page is seen exactly once.

**Edge cases**
- Places search with no API key → the nine preset areas only, no error shown.
- Geolocation denied → stay area remains the anchor. Never block on the prompt.
- Back out of step 1 → return to Landing, nothing written.

---

## Flow 2 — Discover

**Goal**: from "I have a free day" to an opened place detail in a few taps.

Three entry points, all landing on the same detail page:

- **Browse** — Home rail → card → detail.
- **Filter** — category chip → Explore, pre-filtered → card or pin → detail.
- **Search** — search field → debounced results across name, description, category, region and tags → detail.

Filters live in the URL (`/explore?category=waterfalls&maxKm=25`), so a filtered view is shareable and survives refresh.

**No-results state** names which filter is responsible and offers to drop it — not a generic "nothing found".

---

## Flow 3 — Map ⇄ List

**Goal**: switch representation without losing your place.

The toggle is persistent in the Explore header. The invariant that matters: **switching modes must never reset filters, the result set, or scroll position.**

- Map → list: the list opens scrolled to whichever spot was last previewed.
- List → map: the map fits bounds to the current filtered set.
- Pin tap → bottom sheet (image, name, category, distance, rating, "View details"). Dismiss by swipe down, backdrop tap, or Escape.
- Above ~30 visible pins, cluster.
- From `--bp-lg`, both render side by side: list left, sticky map right. Hovering a card highlights its pin.

**Failure**: map fails to load → automatically fall back to list with an inline note, not a blank panel.

---

## Flow 4 — Place detail

1. Hero image, name, category, tags, rating, distance from stay.
2. `longDescription`.
3. Practical block — hours, duration, cost, best time.
4. **Local tips** — prominent. The highest-value content on the page.
5. Ferry block, when `ferry` is non-null.
6. Nearby cards.

Actions stay reachable while scrolling (sticky bar on mobile, sidebar from `--bp-lg`):

| Action | Behaviour |
|---|---|
| Add to itinerary | Adds to the active itinerary; toggles to Remove. If none exists, create "My Trip" silently — do not interrupt with a dialog. |
| Mark visited | Optimistic toggle, no confirmation, persists immediately. |
| Navigate | In-app directions (Flow 6). |
| Open in Google Maps | External tab. |

Tapping a Nearby card pushes another detail page. Back must return to the previous one with scroll position intact.

---

## Flow 5 — Build an itinerary

**Goal**: a realistic plan for a day, not a wishlist.

1. Add stops from detail pages or card actions.
2. Open Itinerary. Stops list in insertion order with dwell times defaulted from `visitDurationMin`.
3. **Reorder**: drag on desktop, long-press-drag on touch, **and** move-up/move-down buttons for keyboard and assistive tech. Drag-only is not acceptable.
4. **Optimise route**: nearest-neighbour from the stay anchor, then Directions API for real travel times. Show the before/after total so the user can judge whether to accept it.
5. Totals update live — travel time, visit time, trip duration, indicative cost range.
6. Warn on an over-stuffed day: more than the travel-style budget (relaxed 2, balanced 3–4, packed 5+), or more than ~10 hours end to end.

**Ferry-aware**: adding a spot with a non-null `ferry` inserts the crossing as its own segment in both directions and warns if the plan misses the last return. A Nusa Penida day that ignores the boat is not a plan.

**Persistence**: every mutation writes to localStorage immediately. There is no save button.

**Edge cases**
- Empty itinerary → an empty state that routes to Explore.
- One stop → totals show visit time only, optimise is disabled.
- Directions unavailable → fall back to haversine × 1.5 as a rough drive estimate, and **label it as an estimate**.

---

## Flow 6 — Navigate

1. **Navigate** on a detail page or itinerary stop.
2. Origin: geolocation if already granted, otherwise the stay anchor. Never block waiting on a permission prompt.
3. Directions API renders the route polyline in-app with distance and duration.
4. Step list below the map.
5. Secondary action hands off to Google Maps for live turn-by-turn.

Travel mode follows the onboarding transportation choice. **Scooter maps to `DRIVING`** — the API has no two-wheeler mode for Indonesia. Say so in the UI rather than implying a precision we do not have; scooter routes and times genuinely differ.

There is no voice guidance. That is Google Maps' job and the handoff exists for it.

---

## Flow 7 — Ferry

Triggered from a Nusa spot's detail page, from the itinerary when such a spot is added, or from the standalone Ferry screen.

Shows: route, crossing time, departure ports with a map, indicative schedule, indicative price, operators and aggregators.

Every booking link is external. **No payments, no seat holding, no booking state.**

The screen must be explicit that schedules are indicative and crossings are cancelled for weather, especially December–February. Anything less is setting someone up to miss a flight.

---

## Flow 8 — Theme

Follows the system by default. A manual override in settings persists to `bali-explorer:theme`.

The resolved theme is applied to `document.documentElement` by an inline script in `index.html` **before first paint**. Without it, dark-mode users get a white flash on every load — which on a premium visual product is the most noticeable bug in the app.
