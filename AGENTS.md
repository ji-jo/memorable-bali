# AGENTS.md

Project-specific guidance for AI coding agents.

<!-- ASTRYX:START -->
Astryx v0.2.0 · 154 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else style/className with tokens — var(--color-*|--spacing-*|--radius-*). No raw hex/px. (No StyleX/Tailwind compiler here — don't use xstyle/utility classes.)
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any raw <div>/<span> layout, imported .css/@apply, or hardcoded value (#hex, 16px) with the component or a token (var(--color-*|--spacing-*|…)). If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   154 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->

## Cursor Cloud specific instructions

Memorable Bali (revamp) is a **frontend-only** React 19 + TypeScript SPA (Vite 6). Maps use **MapLibre + OpenFreeMap** (no Google Maps key required for Explore). Curated content lives in `data/*.json`; user state is browser `localStorage` (`bali-explorer:*`). See `README.md` / `docs/08-Developer-Guide.md` for standard docs; npm scripts live in `package.json`.

### Source of truth

Treat the checked-out working tree as authoritative for UI. Prefer the latest local/revamp code over older GitHub history when they diverge.

### Services / commands

Single service: Vite on **port 1234** (`host: '127.0.0.1'`, `strictPort: true` in `vite.config.ts` — not 5173). Without an explicit IPv4 host, Vite may listen on `::1` only and browsers hitting `127.0.0.1:1234` get `ERR_CONNECTION_REFUSED`.

- `npm run dev` — start the app (`http://127.0.0.1:1234/`)
- `npm run test` — Vitest (currently green)
- `npm run validate:data` — curated JSON checks
- `npm run lint` / `npm run typecheck` / `npm run build` — see known issues below

Optional Node-only tooling keys (never `VITE_`): `UNSPLASH_ACCESS_KEY`, `LOCATION_IQ_ACCESS_TOKEN`, `GOOGLE_MAPS_API_KEY` for scripts in `.env.example`. Core Explore/Home/Itinerary flows work without them.

### Non-obvious notes

- First load is gated by **5-step onboarding**. Reset with `localStorage` keys prefixed `bali-explorer:`.
- Mobile Explore uses a bottom **Sheet**; desktop uses a floating side panel. Sheet `.content` is full-bleed (`padding: 0`); `ExploreResultsHeader` is end-to-end; FilterBar/listBody own their own horizontal inset.
- PlaceCard outline uses `outline` with `color-mix(... var(--color-accent) 20% ...)` at `0.5px` (not a dark border token).

### Known pre-existing failures (revamp `main`)

Do not treat these as setup blockers unless you are specifically fixing them:

- `npm run lint` — existing `react-hooks/set-state-in-effect` errors (e.g. Explore, PlaceDetail) plus other warnings
- `npm run typecheck` / `npm run build` — TS errors in `src/components/agents/loading-states/reasoning-text.tsx` and `src/components/motion/loader.tsx`

`npm run test` and `npm run validate:data` pass; `npm run dev` serves the app.
