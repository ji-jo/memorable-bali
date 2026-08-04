# 11 — Claude Code Implementation Prompt

Everything below the line is the build prompt. Paste it into a fresh Claude Code session in this repository.

It is written to need no follow-up questions: every decision the other docs already made is restated here inline, so the session does not have to go hunting or guess.

---

## The prompt

> Build the Bali Explorer MVP in this repository. The complete specification is in `docs/` and the curated dataset is already in `data/` — read `docs/01-PRD.md`, `docs/02-Architecture.md`, `docs/03-Data-Model.md` and `docs/04-Design-System.md` before writing any code. Do not re-derive decisions those files already make.
>
> ### Stack — already decided, do not substitute
>
> React 18 + Vite + TypeScript (strict). React Router for routing. **CSS Modules with CSS custom-property tokens** for styling. Vitest + React Testing Library for tests. Google Maps JavaScript, Places and Directions APIs, all client-side. No backend, no database, no auth.
>
> **Do not install a component library.** No MUI, no shadcn, no Chakra, no Tailwind. Every component is handcrafted — the look is the product, and a generic kit would flatten it. This is the single most important constraint in the brief.
>
> ### Data — already written, do not regenerate
>
> `data/` contains 54 curated places plus categories, regions, stay areas, ferry routes and three sample itineraries. **Do not modify these files and do not invent new places.** The schema and every field's meaning is in `docs/03-Data-Model.md`.
>
> Two things about the data you must respect:
>
> 1. **`description` is 50–80 characters, enforced by `scripts/validate-spots.mjs` in CI.** Card layouts must fit it on one line at 360px without truncating.
> 2. **`visited` is always `false` in the JSON.** It is per-user state. Real state lives in `localStorage` under `bali-explorer:visited` as a `string[]` of spot ids, merged at read time. Never write back to the JSON.
>
> `scripts/compute-distances.mjs` fills `distanceFromStayKm` relative to Ubud as a first-run fallback. Once onboarding sets a stay area, recompute all distances at runtime with the haversine helper in `docs/03-Data-Model.md`. These are **straight-line** distances — Bali road distance runs 1.3–1.8× higher — so label them "away", never "drive".
>
> ### The one architectural rule
>
> **Only `src/data/repository.ts` may import a JSON file.** Every screen, hook and component reads through it. This is the seam that makes a later Supabase migration a one-file change. Make the repository functions `async` from the start even though they resolve immediately — retrofitting that later means touching every call site.
>
> ### Build order
>
> Work in these phases. Verify each before moving on.
>
> **1. Foundation**
> Scaffold Vite + React + TS. Add `resolveJsonModule` to `tsconfig.json`. Write `src/styles/reset.css`, `src/styles/tokens.css` (every token from `docs/04-Design-System.md`, both themes) and `global.css`. Build `src/data/types.ts`, `repository.ts` and `queries.ts`. Add `useLocalStorage` (namespaced `bali-explorer:`, versioned, try/catch wrapped — it must survive a corrupt or stale record without crashing). Set up `ThemeContext` with light/dark/system, plus the **inline script in `index.html` that applies the resolved theme before first paint** — without it dark-mode users get a white flash on every load.
>
> **2. Primitives**
> `Button`, `Chip`, `Sheet`, `SpotImage`, `Rating`, `Skeleton`, `EmptyState`, `ThemeToggle`. Signatures are in `docs/06-Components.md`.
> `SpotImage` matters more than it looks: **`/images/spots/*.jpg` do not exist in this repo.** Its fallback — a gradient built from the category colour — is what users will actually see. Get it right; never show a broken image icon.
>
> **3. Shell and routing**
> `AppShell` with a bottom tab bar below 768px (56px + `env(safe-area-inset-bottom)`) and top nav above. Routes exactly as listed in `docs/02-Architecture.md`. Route-level `React.lazy` for Explore, PlaceDetail, Itinerary and Ferry.
>
> **4. Landing and onboarding**
> Five steps per `docs/01-PRD.md` §F2. Every step skippable, every step reversible with selections preserved. Skipping entirely must still produce a working Home (all interests, 1 week, Ubud, scooter, balanced). Write `bali-explorer:onboarding`; `/` redirects to `/home` when it exists. Hide the `shopping` interest — no spots support it, and an interest that returns zero results should not be offered.
>
> **5. Home**
> Search entry, category chips, and the rails: Recommended Today, Hidden Gems, Trending, Nearby, map preview. Seed the "Recommended Today" shuffle from the date so it does not reorder on every render. **Label the Trending rail honestly** — with no backend there is no trend signal, so call it "Editor's picks this month" rather than implying analytics that do not exist.
>
> **6. Explore**
> Map and list are **one synced view, never two modes to switch between** — read `docs/01-PRD.md` §F5 and `docs/05-User-Flows.md` Flow 3 before building this, the interaction model is specific. Below 1024px the map is full-bleed and fixed, with a draggable `Sheet` (`peek`/`half`/`full` snap points) holding the list on top of it, plus a non-drag button between `peek` and `full` for keyboard/screen-reader users. At 1024px and above, list and map sit in a fixed two-column layout instead — same sync, no sheet. Either way: tapping a pin highlights and scrolls to its card (snapping the sheet to `half` below 1024px); hovering or tapping a card highlights its pin. One `selectedId`, two renderings — do not write separate mobile and desktop sync logic. Filter state lives in the URL query string and must survive every interaction above.
>
> **7. Place detail**
> Everything in `docs/01-PRD.md` §F6, in that order. The `tips` array is the highest-value content on the page — give it visual weight, do not bury it below the fold.
>
> **8. Itinerary**
> Add, remove, reorder, optimise, total up. **Reordering must work by keyboard** — provide move-up/move-down buttons alongside drag. Drag-only fails the accessibility target. Ferry-aware: a spot with a non-null `ferry` inserts the crossing in both directions and warns if the plan misses the last return.
>
> **9. Navigation and ferry**
> In-app Directions with the polyline and step list, plus a handoff to Google Maps. Ferry screen and detail-page block, with external booking links only — no payments.
>
> **10. Polish**
> Empty states everywhere, error boundaries per screen, focus management, `prefers-reduced-motion`, Lighthouse pass.
>
> ### Google Maps — the expensive mistakes to avoid
>
> Read `docs/07-Google-Maps.md` before touching any of this.
>
> - The SDK must **never** be in the initial bundle. Load on demand via `useGoogleMaps()` with a shared promise so concurrent callers inject one script tag.
> - **Places Autocomplete must use a session token.** Without one you are billed per keystroke. Debounce 300ms, require 3+ characters.
> - **Cache Directions results** keyed by ordered stop ids. An itinerary screen that recalculates on every render is the fastest way to burn the free tier.
> - Set `clickableIcons: false` on the map, or users tap Google's own POIs and get Google's cards instead of our curated ones.
> - Use `AdvancedMarkerElement` with custom DOM pins coloured from `categories.json`. Never the default red pin. Detach markers on unmount.
>
> **The app must work fully without an API key.** List view, detail pages, itineraries, distances and the Google Maps handoff all function; only map rendering, Places search and Directions degrade, each with an explanatory placeholder. No crashes, no blank grey boxes, no console errors. Develop against this path first — it is also how CI and key-less preview deploys will see the app.
>
> ### Design non-negotiables
>
> - Mobile-first. Write the mobile rule, then `min-width` queries.
> - Light and dark, following system by default, manual override persisted.
> - **No hardcoded colours, spacing or radii.** If a token is missing, add it to `tokens.css`.
> - Photography first, chrome last. Cards are images with text on them.
> - Transitions on `transform` and `opacity` only.
> - 44×44px minimum touch targets, visible `:focus-visible` rings, `aria-label` on every icon-only button.
> - Copy style: sentence case, second person, specific over enthusiastic. If a place is crowded, the UI says so.
>
> ### Done means
>
> - `npm run build` succeeds with zero TypeScript errors.
> - `node scripts/validate-spots.mjs` still exits 0 (you should not have touched the data, but confirm).
> - Every route renders on mobile and desktop, in both themes.
> - The full no-API-key path works with no console errors.
> - Lighthouse mobile: performance ≥ 90, accessibility ≥ 95.
> - A keyboard-only pass through onboarding → explore → detail → add to itinerary → reorder works end to end.
> - Tests cover `lib/geo.ts`, `data/queries.ts`, itinerary reorder and totals, and the `useLocalStorage` corrupt/stale-record paths.
>
> ### How to work
>
> Commit after each phase with a descriptive message. Run `npm run typecheck` and `npm run validate:data` before each commit. If something in the docs is genuinely ambiguous, pick the option most consistent with `docs/00-Vision.md` — curated over comprehensive, honest over enthusiastic, quality over quantity — state the assumption in your commit message, and keep going. Do not stop to ask unless proceeding either way would waste substantial work.

---

## Using this prompt in pieces

The full prompt builds the whole MVP in one session. For a phased approach, run it once through **phase 3** to get a verifiable shell, then feed later phases individually — each phase section above is self-contained enough to stand alone, provided the session has read `docs/03-Data-Model.md` and `docs/04-Design-System.md` first.

## Known gaps the build cannot close

State these up front so nobody discovers them at review:

1. **Images do not exist.** The gradient fallback is the intended first-build appearance. Sourcing licensed photography is a content task.
2. **`rating` is an editorial placeholder**, not a Google rating. Either relabel it or wire up live Places data before launch — see `docs/03-Data-Model.md`.
3. **Coordinates, hours and prices are unverified.** The validator checks structure, not truth. Someone must reconcile against Google Places before this is pointed at a real domain.
4. **Map screens cannot be visually verified without an API key.** Build and review the no-key path first; it is a real user journey, not an error case.
