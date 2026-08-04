# 08 — Developer Guide

## Prerequisites

- **Node 20+** (Node 18 works; the scripts use nothing newer)
- npm (lockfile is npm; do not mix package managers)
- A Google Maps API key — optional for most work, see below

## Setup

```bash
git clone https://github.com/ji-jo/memorable-bali.git
cd memorable-bali
npm install
cp .env.example .env.local     # add your key, or leave it blank
npm run dev                    # http://localhost:5173
```

**You do not need an API key to develop.** Without one the app runs in degraded mode: list view, detail pages, itineraries and haversine distances all work; map rendering, Places search and Directions show explanatory placeholders. Only work on those three features requires a key.

## Scripts

```bash
npm run dev                # Vite dev server
npm run build              # typecheck + production build to dist/
npm run preview            # serve dist/ locally — always check this before deploying
npm run typecheck          # tsc --noEmit
npm run lint               # eslint
npm run test               # vitest
npm run validate:data      # node scripts/validate-spots.mjs
npm run compute:distances  # node scripts/compute-distances.mjs
```

> Until the app itself is scaffolded, the two data scripts run directly with no install step:
> ```bash
> node scripts/validate-spots.mjs
> node scripts/compute-distances.mjs
> ```

## Repository layout

```
memorable-bali/
├── data/          the curated dataset — see 03-Data-Model.md
├── docs/          this documentation
├── scripts/       zero-dependency data tooling
├── public/        static assets, including images/spots/
└── src/           the app — see 02-Architecture.md
```

---

## Conventions

### The one hard rule

**Nothing outside `src/data/repository.ts` may import a JSON file.** Every screen, hook and component goes through the repository. This is the seam that makes the Supabase migration a one-file change (`02-Architecture.md`). A direct `import spots from '../../data/bali-spots.json'` in a component is a bug, regardless of whether it works.

### Files

| Kind | Convention |
|---|---|
| Components | `PascalCase/` folder with `Component.tsx`, `Component.module.css`, `index.ts` |
| Hooks | `useCamelCase.ts` |
| Utilities | `camelCase.ts` |
| Types | `PascalCase`, in `src/data/types.ts` or co-located |
| CSS classes | `camelCase` in modules (`styles.cardTitle`) |
| Storage keys | always `bali-explorer:` prefixed |

### TypeScript

Strict mode on. No `any` — use `unknown` and narrow. Prefer `interface` for object shapes, `type` for unions. Export types alongside the code that owns them.

### CSS

CSS Modules only. No global classes beyond the reset and token files. **Never hardcode a colour, spacing value or radius** — if a token is missing, add it to `tokens.css` rather than typing a hex code. No `!important`; if you need it, the specificity is wrong.

Mobile-first: write the mobile rule, then add `min-width` queries.

### React

Function components with hooks. Keep components small and composable — more than ~8 props usually means two components. Do not memoise reflexively; 54 records is small, and premature `useMemo` costs readability more than it saves.

Ephemeral state (filters, search text, map mode) belongs in the URL query string, not context — that makes views linkable and refresh-safe for free.

### Accessibility

Not optional; `01-PRD.md` targets WCAG 2.1 AA.

- Every interactive element is keyboard reachable with a visible `:focus-visible` ring.
- Icon-only buttons need `aria-label`. This is the most common failure — check it first.
- Toggles use `aria-pressed`. Result counts use `aria-live="polite"`.
- Minimum 44×44px touch targets.
- Anything drag-based needs a keyboard equivalent — itinerary reordering especially.

---

## Working with the data

### Adding a place

1. Copy an existing record in `data/bali-spots.json` as a template.
2. `id` is a stable kebab-case slug. It appears in URLs — never renumber it.
3. `description` **must be 50–80 characters**. CI fails outside that window.
4. `visited` is always `false`. Real state lives in localStorage.
5. Write at least two genuinely specific tips. "Bring water" is not curation; "around 500 steps in full sun, and no warung at the bottom" is.
6. Add `nearby` ids — the genuinely closest spots, not thematically similar ones. Links over 60km trigger a warning. Reciprocity is not required and often wrong: A's three nearest are not necessarily B's.
7. Run the scripts:

```bash
node scripts/compute-distances.mjs   # fills distanceFromStayKm, fixes _meta.count
node scripts/validate-spots.mjs      # must exit 0
```

### What the validator checks

Id uniqueness and slug format · the 50–80 description window · rating range and precision · the four-value tag enum · every foreign key (`category`, `region`, `nearby`, `ferry`, itinerary `spotId` and `interests`) · coordinates inside Bali's bounding box · `visited === false` · itinerary `order` continuity · `_meta.count` accuracy · unknown fields.

It checks structure. **It cannot check truth** — coordinates, hours and prices are unverified (`03-Data-Model.md`).

### Editing tips and descriptions

The editorial content *is* the product. Before committing a change, re-read `00-Vision.md`. Specific beats enthusiastic; honest beats promotional. If a place is crowded, say so.

---

## Git workflow

Branch from `main`:

```
feature/explore-map-view
fix/itinerary-reorder-keyboard
data/add-west-bali-spots
docs/update-deployment
```

Commits: imperative, present tense, explaining *why* when it is not obvious.

```
Add keyboard reordering to itinerary stops

Drag-only reordering excluded keyboard and screen reader users,
failing the AA target in 01-PRD.md.
```

Before opening a PR:

```bash
npm run typecheck && npm run lint && npm run test && npm run validate:data && npm run build
```

Every PR gets a Vercel preview deploy. Check it on a phone — this is a mobile-first product and desktop review misses real problems.

---

## Debugging

**Map is blank** — check the key exists in `.env.local`, that the referrer restriction includes `http://localhost:5173/*`, that Maps JavaScript API is enabled, and the console for `MAPS_LOAD_FAILED`.

**Markers do not render** — `AdvancedMarkerElement` needs a **vector** Map ID and the `marker` library in the script URL.

**Places autocomplete returns nothing** — Places API enabled? Key restricted to it? Query at least 3 characters?

**Dark mode flashes white on load** — the inline theme script in `index.html` is missing or running after first paint.

**localStorage seems ignored** — check the `bali-explorer:` prefix and the `__v` version field; a shape change discards old records by design.

**Distances look wrong** — they are straight-line, not road. Bali road distance runs 1.3–1.8× haversine. That is expected; the label must say "away", not "drive".

## Where to look

| Question | File |
|---|---|
| What are we building and why | `00-Vision.md`, `01-PRD.md` |
| How is it structured | `02-Architecture.md` |
| What does the data look like | `03-Data-Model.md` |
| What should it look like | `04-Design-System.md` |
| How does a user move through it | `05-User-Flows.md` |
| What components exist | `06-Components.md` |
| How do the Google APIs work | `07-Google-Maps.md` |
| How do I ship it | `09-Deployment.md` |
| What comes next | `10-Roadmap.md` |
