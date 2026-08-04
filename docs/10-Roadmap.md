# 10 — Roadmap

Everything here is **out of scope for v1**. The MVP scope is `01-PRD.md` and nothing else. This file exists so good ideas have somewhere to live that is not the current sprint.

---

## Phase 1 — MVP

Landing · onboarding · home · explore (map + list) · place detail · in-app navigation · itinerary builder · ferry info · light/dark · 54 curated places.

**Ships when** the release checklist in `09-Deployment.md` is clear.

---

## Phase 2 — Sharpen what exists

Small, high-value, no new infrastructure.

| Feature | Effort | Notes |
|---|---|---|
| **Open Now filter** | S | Parse `openingHours` against Bali time (UTC+8). Beware entries with only a `note`. |
| **Nearby recommendations on the map** | S | "Show me what's within 10km of here" from any pin. Data already supports it. |
| **Share itinerary via URL** | M | Encode stops into a query param, decode on load. No backend — but URLs get long past ~8 stops, so cap it. |
| **Estimated trip budget** | M | Sum `cost` across stops plus a transport estimate. Be explicit that it excludes food and accommodation. |
| **Offline favourites** | M | Service worker caching the shell and data. The dataset is already bundled, so this is mostly Workbox configuration. |
| **Scenic route suggestions** | M | Curated route polylines between regions (the Sidemen and Munduk roads especially). New data, not new architecture. |
| **Real photography** | M | Source and license images for all 54 spots. Content work, and the single biggest visual upgrade available. |
| **Resolve ratings** | S | Replace editorial placeholders with live Places ratings, or commit to an explicit editorial score. Do this before any real launch. |

## Phase 3 — Needs a backend

Everything here implies Supabase. Doing them well means doing the migration first.

| Feature | Effort | Notes |
|---|---|---|
| **Supabase migration** | L | The enabler. `02-Architecture.md` describes the seam; `03-Data-Model.md` the schema mapping. |
| **Accounts and sync** | M | Supabase Auth. Itineraries and visited state move server-side. Multi-device is the point. |
| **Crowd indicator** | L | Quiet / Moderate / Busy. Needs a real signal — Places popular times, or aggregated app usage. **Do not ship a fabricated one**; a wrong crowd indicator is worse than none. |
| **Editorial CMS** | M | So the curation can be updated without a deploy. Becomes necessary somewhere past ~80 places. |
| **User-submitted spots** | L | With editorial review. Risks the curation — the fifty-first place must still require deleting one. |

## Phase 4 — AI

| Feature | Effort | Notes |
|---|---|---|
| **AI itinerary generation** | L | "Three days, love waterfalls, hate crowds, staying in Ubud" → a plan. The dataset is small and well-structured, which makes this unusually tractable — the whole corpus fits in a prompt. |
| **Natural language search** | M | "Somewhere quiet near Ubud for sunrise" over the same 54 records. |
| **Trip debrief** | S | Turn visited places into a shareable summary. |

The reason to do AI here is that fifty richly-annotated places is a *better* substrate for a language model than ten thousand thin ones. That is a genuine advantage of the curated position.

## Phase 5 — Mobile

| Feature | Effort | Notes |
|---|---|---|
| **React Native app** | XL | Share `data/`, types and business logic; rewrite the UI. Google Maps SDKs differ per platform. |
| **Offline maps** | L | Licensing constraints — Google's terms restrict caching map tiles. May force Mapbox. |
| **Push notifications** | M | "You're 2km from Tirta Empul." Genuinely useful, genuinely easy to make annoying. |

---

## Deliberately not doing

| | Why |
|---|---|
| **User reviews and ratings** | Review aggregation is the thing we are positioned against (`00-Vision.md`). Adding it makes us a worse TripAdvisor. |
| **Booking and payments** | Different business, needs compliance, licensing and support. External links only. |
| **Social feed, follows, likes** | Every social feature dilutes the curation. |
| **Hotel and flight search** | Solved elsewhere, ruthlessly. |
| **Growing to thousands of places** | The whole product is that there are fifty. If the dataset passes ~80, something has gone wrong. |
| **Sponsored placements** | The instant a listing can be bought, the recommendations are worthless. This one is permanent. |

---

## How to decide what is next

1. Does it make the fifty places **better understood**, or does it add more places? Prefer the former.
2. Can it ship without a backend? If yes, it probably belongs before the migration.
3. Would a visitor notice on their first day in Bali? If not, it can wait.
4. Does it compromise the curation? Then it does not ship, regardless of how much traffic it would bring.
