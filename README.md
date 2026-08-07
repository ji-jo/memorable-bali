# Memorable Bali

A curated travel companion for Bali. Roughly fifty hand-picked places instead of ten thousand — because the hard part of planning a trip is not finding options, it is knowing which ones are worth your Tuesday.

> "Someone already did the research for me."

**Status: documentation and dataset complete. The application has not been built yet.** This repository currently contains the full specification, the curated dataset, and the tooling that validates it. `docs/11-Cloud-Code-Prompt.md` is the build prompt for the next step.

---

## What is here

```
memorable-bali/
├── docs/                       the complete specification
│   ├── 00-Vision.md            what we are making and why
│   ├── 01-PRD.md               MVP scope, feature by feature
│   ├── 02-Architecture.md      structure, state, the Supabase seam
│   ├── 03-Data-Model.md        the schema — start here if you touch data
│   ├── 04-Design-System.md     tokens, type, colour, motion
│   ├── 05-User-Flows.md        how a visitor moves through the app
│   ├── 06-Components.md        component inventory with prop signatures
│   ├── 07-Google-Maps.md       Maps, Places, Directions — and the billing traps
│   ├── 08-Developer-Guide.md   setup, conventions, debugging
│   ├── 09-Deployment.md        Vercel, CI, release checklist
│   ├── 10-Roadmap.md           what comes after the MVP, and what never will
│   └── 11-Cloud-Code-Prompt.md the build prompt
│
├── data/
│   ├── bali-spots.json         54 curated places
│   ├── categories.json         11 categories + onboarding interests
│   ├── regions.json            7 geographic zones
│   ├── stay-areas.json         9 stay areas (the distance anchors)
│   ├── ferries.json            Nusa crossings
│   └── itineraries.sample.json 3 worked itineraries
│
└── scripts/
    ├── validate-spots.mjs      zero-dependency data validator
    └── compute-distances.mjs   fills distanceFromStayKm
```

## Try the data tooling

No install step — the scripts have no dependencies.

```bash
node scripts/validate-spots.mjs
```

```
  69 spots, 11 categories, 7 regions, 9 stay areas
  by region:   ubud 17  south 12  bukit 8  east 10  north 11  west 5  nusa 6
  by category: nature 8  temples 9  culture 6  waterfalls 7  wellness 2  food 13
               beaches 13  photography 2  hidden-gems 3  adventure 2  hotels 4

  All data valid.
```

It checks id uniqueness, the 50–80 character description window, the tag enum, every foreign key, coordinates inside Bali's bounding box, and schema drift. It runs in CI on every push.

```bash
node scripts/compute-distances.mjs   # recompute distances after adding a place
```

## ⚠️ The dataset is unverified

Coordinates, opening hours, prices and ratings were written from model knowledge, not from a live source. They are plausible and internally consistent but **have not been checked**. `rating` in particular is an editorial placeholder — it is *not* a scraped Google rating.

Before this is pointed at a real domain, someone must reconcile every record against Google Places. The validator enforces structure; it cannot enforce truth. `data/bali-spots.json` carries the same warning in its `_meta.provenance` block, and `docs/03-Data-Model.md` explains what needs checking.

Descriptions and tips are editorial judgement — that curation is the product, so a human who knows Bali should read them.

## Building the app

The MVP is React + Vite + TypeScript, CSS Modules, Google Maps APIs, local JSON, deployed static to Vercel. No backend, no accounts, no payments.

Open a Claude Code session in this repository and use the prompt in `docs/11-Cloud-Code-Prompt.md`. It restates every decision the docs already make, so the build should not need follow-up questions.

Then:

```bash
cp .env.example .env.local     # add a Google Maps key, or leave it blank
npm install
npm run dev
```

**A key is optional for development.** Without one the app runs degraded — list view, detail pages, itineraries and distances all work; only map rendering, Places search and Directions show placeholders.

## The position, briefly

| Not this | Because |
|---|---|
| Google Maps | They win on coverage and routing. We use their APIs rather than compete. |
| TripAdvisor | Review aggregation is a popularity contest. This is editorial judgement. |
| A booking platform | No payments, no inventory. Ferry links go out to the operator. |
| A comprehensive directory | Fifty-odd places. Adding the next one should mean removing one. |

No sponsored placements, ever. The moment a listing can be bought, the recommendations are worthless.

Full reasoning in `docs/00-Vision.md`.

## Contributing a place

1. Copy an existing record in `data/bali-spots.json`.
2. `description` must be **50–80 characters** — CI fails outside that.
3. `visited` is always `false`; real state lives in localStorage.
4. Write at least two genuinely specific tips. "Bring water" is not curation.
5. Set `nearby` to the genuinely closest spots — the validator warns past 60km.
6. Run `node scripts/compute-distances.mjs` then `node scripts/validate-spots.mjs`.

Details in `docs/08-Developer-Guide.md`.
