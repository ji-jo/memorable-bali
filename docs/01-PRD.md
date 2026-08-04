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

Two modes over the same filtered result set. **The mode toggle must never reset filters or scroll position.**

### Map view
- Google Map, pins coloured by category, clustered when zoomed out.
- Tapping a pin opens a bottom sheet preview: cover image, name, category, distance, rating, and a link through to the detail page.
- "Recenter" control returns to the stay anchor.

### List view
Each card shows exactly: cover image, category, distance from stay, estimated duration, rating, and the 50–80 character description. Nothing else — the card is deliberately spare.

### Filters (both modes)
Category, tag, region, max distance, max duration. Active filters shown as removable chips with a "clear all". Filter state lives in the URL query string so a filtered view is linkable and survives refresh.

**Done when**: switching modes preserves filters and result set, and 54 pins render without jank on a mid-range phone.

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
- **Navigate** — in-app directions (F7)
- **Open in Google Maps** — external, `target="_blank" rel="noopener noreferrer"`

**Done when**: every field in the `Spot` type is rendered or deliberately omitted, and both toggles survive a page refresh.

---

## F7 — Navigation

Directions stay **inside the app** by default.

- Origin: current geolocation if granted, otherwise the stay anchor. Never block on a permission prompt.
- Directions API for the route; render the polyline on the map with distance and duration.
- Travel mode follows the onboarding transportation choice — scooter maps to `DRIVING` (the API has no two-wheeler mode for Indonesia; note this in the UI rather than pretending otherwise).
- Step list below the map. **No turn-by-turn voice guidance** — that is what Google Maps is for.
- A clear secondary action hands off to Google Maps for live turn-by-turn.

**Done when**: a route renders in-app with a realistic duration, and the handoff opens the correct destination in Google Maps.

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
