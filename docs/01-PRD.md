# 01 — Product Requirements

Scope for MVP v1. Anything not listed here is in `10-Roadmap.md` and should not be built.

**Definition of the MVP**: a visitor can onboard, discover curated places on a map and in a list, read a genuinely useful detail page, build an itinerary, and get directions — entirely from local data, with no account and no backend.

---

## F1 — Landing

A single screen that states what the app is and starts onboarding.

- Hero image, product name, one line of positioning, one primary action.
- Secondary action: **Skip** — goes straight to Home with sensible defaults (all interests, Ubud anchor, balanced style).
- If `bali-explorer:onboarding` exists in localStorage, redirect to Home immediately. Returning users never see this twice.

**Done when**: a first-time visitor reaches Home in one tap, and a returning visitor never sees the landing page at all.

---

## F2 — Onboarding

Five steps, each on its own screen, with a progress indicator and a back control. Every step is skippable.

| Step | Input | Options |
|---|---|---|
| 1 | Interests (multi-select) | From `categories.json` → `onboardingInterests`. "All" clears the rest. Hide `shopping` — no spots support it yet. |
| 2 | Length of stay (single) | 1 Day, Weekend, 3 Days, 5 Days, 1 Week, 2 Weeks |
| 3 | Staying area (single) | The nine from `stay-areas.json`, plus a Google Places search field for anywhere else |
| 4 | Transportation (multi) | Scooter, Car, Taxi, Private Driver |
| 5 | Travel style (single) | Relaxed, Balanced, Packed |

Result is written to `bali-explorer:onboarding` and drives:

- **Interests** → default filter on Home and Explore.
- **Stay area** → the distance anchor. Every `distanceFromStayKm` is recomputed via haversine and the map centres here.
- **Travel style** → stops per day suggested by the itinerary builder: relaxed 2, balanced 3–4, packed 5+.
- **Length of stay + transportation** → itinerary suggestions and a scooter-safety note on spots with rough access roads.

**Done when**: completing all five steps changes what Home shows, and skipping every step still produces a working Home screen.

**Requirements**: no dead ends — every step has a forward path. Selections persist if the user backs up. The Places search must degrade to the nine preset areas if no API key is configured.

---

## F3 — Home

The dashboard. Sections, in order:

1. **Search** — opens the search overlay (F4).
2. **Quick categories** — horizontally scrolling chips from `categories.json`. Tapping one opens Explore filtered.
3. **Recommended today** — 5–6 spots matching onboarding interests, ranked by rating then proximity. Deterministic per day: seed the shuffle from the date so the rail does not reorder on every render.
4. **Hidden gems** — spots tagged `Outworldly` or categorised `hidden-gems`.
5. **Trending** — a stable editorial selection. **Do not fake live trend data.** With no backend there is no real signal; label the rail honestly ("Editor's picks this month") rather than implying analytics we do not have.
6. **Nearby** — nearest spots to the stay anchor by haversine, ascending.
7. **Map preview** — a static-ish map showing filtered pins; tapping opens full Explore.

**Done when**: every rail is populated from local data, horizontally scrollable with momentum, and each card routes to its detail page.

---

## F4 — Search

- Opens as a full-screen overlay on mobile, a dropdown from `--bp-md` up.
- Matches against `name`, `description`, `category` label, `region` label and `tags`. Case- and accent-insensitive.
- Debounce 150ms. With 54 records, filter in memory — no index, no library.
- Empty state suggests categories. No-results state offers to clear filters.
- Recent searches in localStorage, capped at 5.

**Done when**: typing "water" surfaces every waterfall plus Tirta Empul and the water palaces.

---

## F5 — Explore

Map and list are **one synced view, not two modes to switch between.** The layout differs by breakpoint; the interaction model does not.

### Layout
- **< `--bp-lg` (1024px)** — map is full-bleed and always at least partly visible. The list lives in a draggable bottom sheet on top of it, with snap points `peek` (map dominant, one card visible as a drag handle) / `half` (both usable) / `full` (list dominant, map mostly covered). A non-drag button also jumps between `peek` and `full` — the sheet must be reachable without a drag gesture, for keyboard and screen-reader users.
- **≥ `--bp-lg` (1024px)** — list in a fixed left panel, map fixed right, both always fully visible.

### Sync (both breakpoints)
- Hovering or tapping a card highlights its pin on the map.
- Tapping a pin highlights the matching card and scrolls it into view. On mobile this also snaps the sheet to at least `half`, so the card is actually visible.
- Tapping a cluster zooms in. Clusters never open a card.
- **Filters and the result set persist across everything above.** Nothing in this flow ever resets them.

### Map
- Pins: circular cover-image thumbnail, thin ring in the category colour, checkmark overlay if visited. Selected pins scale up. Never the default red Google pin.
- Clustered above ~30 visible pins.
- "Recenter" control returns to the stay anchor.

### List (in the sheet or side panel)
Each card shows exactly: cover image, category, distance from stay, estimated duration, rating, and the 50–80 character description. Nothing else — the card is deliberately spare.

### Filters
Category, tag, region, max distance, max duration. Active filters shown as removable chips with a "clear all". Filter state lives in the URL query string so a filtered view is linkable and survives refresh.

**Done when**: hovering/tapping a card and tapping its pin produce the same highlight from either direction, the sheet's `peek`/`half`/`full` states are reachable by keyboard, filters survive every interaction above, and 54 pins render without jank on a mid-range phone.

---

## F6 — Place detail

Route: `/place/:id`.

Above the fold: hero image, name, category, tags, rating, distance from stay.

Body, in order:
1. `longDescription`
2. **Practical block** — opening hours, estimated visit duration, estimated cost, best time to visit
3. **Local tips** — the `tips` array, prominent. This is the highest-value content on the page; do not bury it.
4. **Ferry block** — only when `ferry` is non-null. Operators, ports, indicative schedule, external booking links, and a plain warning that schedules change and crossings cancel for weather.
5. **Nearby** — cards for each `nearby` id.

Actions, persistent on scroll:
- **Add to itinerary** (or Remove, if already added)
- **Mark as visited** — toggles `bali-explorer:visited`, optimistic, no confirmation
- **Open in Maps** — external Google Maps handoff (F7)
- **Open in Google Maps** — external, `target="_blank" rel="noopener noreferrer"`

**Done when**: every field in the `Spot` type is rendered or deliberately omitted, and both toggles survive a page refresh.

---

## F7 — Navigation

**Shipped scope: external handoff only.** Every place page links out to Google Maps via the record's `googleMapsUrl`. No API key needed, no per-user cost, and the native app opens when installed.

This is a deliberate narrowing of the original brief, which called for directions to stay inside the app. The reason is billing: an embedded browsing map is one Dynamic Maps load per session, but in-app Directions is a per-request charge that scales with every user who taps Navigate — and the per-SKU free allowance (`07-Google-Maps.md`) is consumed by exactly that pattern. The handoff gives the same outcome for nothing.

### Deferred: in-app Directions

Kept here rather than in the roadmap because the groundwork exists — `MapView` already accepts a `route` prop and the loader requests the `geometry` library. Building it means:

- Origin: current geolocation if already granted, otherwise the stay anchor. Never block on a permission prompt.
- Directions API for the route; render the polyline with distance and duration.
- Travel mode from the onboarding transportation choice. **Scooter maps to `DRIVING`** — the API has no two-wheeler mode for Indonesia, and scooter routes genuinely differ. Say so in the UI rather than implying a precision we do not have.
- Step list below the map. No turn-by-turn voice guidance — that is what the handoff is for.
- Cache results by ordered stop ids. An itinerary screen that recalculates on every render is the fastest way to burn the allowance.

**Done when (shipped)**: every place page opens the correct destination in Google Maps, in the native app where installed.

---

## F8 — Itinerary

Local only. No accounts, no sync.

- Add or remove any spot from the detail page or a card action.
- **Reorder** by drag on desktop and long-press-drag on touch, with a keyboard-accessible alternative (move up / move down buttons). Drag-only reordering is not acceptable.
- **Optimised route** — nearest-neighbour ordering from the stay anchor, then Directions API for real travel times. With ≤10 stops this is instant; do not over-engineer it.
- Per-stop: travel time from previous, dwell time (defaulted from `visitDurationMin`, user-editable).
- Totals: travel time, visit time, trip duration, and an indicative cost range summed from each `cost`.
- **Ferry-aware**: a stop with non-null `ferry` inserts the crossing as its own segment with its duration, and warns if the plan misses the last return.
- Multiple named itineraries, all in localStorage.

**Done when**: a five-stop Ubud day produces a sensible order, a believable total duration, and survives a refresh.

---

## F9 — Ferry support

Surfaced in three places: the detail page of any Nusa spot, the itinerary when such a spot is added, and a standalone reference view.

Shows operators, departure ports, indicative schedules, crossing time, indicative price, and external booking links.

**No payment processing, no booking, no seat holding.** Every link is external.

**Done when**: adding Kelingking Beach to an itinerary visibly accounts for the crossing in both directions.

---

## Non-functional

| | Target |
|---|---|
| Lighthouse performance (mobile) | ≥ 90 |
| Lighthouse accessibility | ≥ 95 |
| First Contentful Paint (4G) | < 1.5s |
| JS bundle, gzipped, excl. Maps | < 200KB |
| Support | Last 2 versions of Chrome, Safari, Firefox, Edge; iOS Safari 15+ |
| Accessibility | WCAG 2.1 AA — keyboard reachable, visible focus, 4.5:1 text contrast, reduced-motion respected |
| Themes | Light and dark, following system by default, with a manual override |

The map is lazy-loaded. It must never be in the initial bundle, and no screen without a map may load the Maps SDK.

---

## Out of scope for v1

Accounts, auth, any backend, payments, user reviews, photo uploads, sharing itineraries by URL, offline service worker, push notifications, i18n, React Native. All tracked in `10-Roadmap.md`.

## Open decisions

- **Ratings** are editorial placeholders, not Google ratings (see `03-Data-Model.md`). Either label them as ours or replace with live Places data before launch — shipping ambiguous stars is the one thing that would undermine the trust the product depends on.
- **Images** do not exist yet. The build ships a gradient fallback; sourcing licensed photography is a content task, not an engineering one.
