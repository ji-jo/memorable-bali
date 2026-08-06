# AGENTS.md

## Cursor Cloud specific instructions

Memorable Bali is a **frontend-only** React 18 + TypeScript SPA built with Vite 6. There is no backend, database, or auth — curated content lives in `data/*.json` (bundled at build time via `src/data/repository.ts`) and user state lives in browser `localStorage`. See `README.md` and `docs/08-Developer-Guide.md` for the authoritative developer docs.

### Services / commands

There is a single service (the Vite dev server). Standard commands are defined in `package.json` scripts:

- `npm run dev` — dev server. Note: it runs on **port 1234** (`vite.config.ts` sets `strictPort: true`), not the Vite default 5173. Some docs still mention 5173; the config is the source of truth.
- `npm run lint`, `npm run typecheck`, `npm run test` (Vitest, one-shot), `npm run build`, `npm run preview` (serves `dist/` on 4173).
- `npm run validate:data` and `npm run compute:distances` — zero-dependency Node data-tooling scripts run by CI (`.github/workflows/validate-data.yml`).

### Non-obvious notes

- **Local working tree is the source of truth for UI/components.** Treat the checked-out local codebase (and any local-only / unpushed work the user points you at) as authoritative. Remote GitHub can lag with outdated components — do not assume `origin/main` or GitHub history reflects the current design system or component set.
- **Google Maps is optional for dev.** Without `VITE_GOOGLE_MAPS_API_KEY` / `VITE_GOOGLE_MAPS_MAP_ID` in `.env.local`, the app runs degraded but fully usable: list view, place detail, itineraries, and haversine distances all work; only map rendering, Places autocomplete, and Directions show placeholders. Core flows can be tested with no credentials.
- **First load starts at the Landing page and requires completing the 5-step onboarding** (interests → stay length → area → transport → style) before `/home` is reachable. To reset onboarding, clear `localStorage` keys prefixed `bali-explorer:` (or use a fresh browser profile / incognito).
- `compute:distances` is anchored on Ubud and CI fails if `data/bali-spots.json` is stale; re-run it after editing spot coordinates.
