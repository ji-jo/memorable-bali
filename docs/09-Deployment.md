# 09 — Deployment

Static build, deployed to Vercel from GitHub. No server, no runtime environment, no containers.

---

## Vercel setup

### First deploy

1. Push to GitHub.
2. Vercel → **Add New Project** → import `ji-jo/memorable-bali`.
3. Framework preset: **Vite** (auto-detected).

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Node version | 20.x |

4. Add environment variables (below).
5. Deploy.

### Environment variables

Set both for **Production**, **Preview** and **Development**:

| Variable | Notes |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Public by design — see the warning below |
| `VITE_GOOGLE_MAPS_MAP_ID` | Vector map ID, required for advanced markers |

> **`VITE_`-prefixed variables are compiled into the client bundle and are publicly readable.** There is no way to hide them in a frontend-only app. The key is protected by HTTP referrer restrictions and quota caps in Google Cloud, not by Vercel's env var UI. Configure those restrictions *before* the first production deploy — see `07-Google-Maps.md`.
>
> Never put a secret that must stay secret into a `VITE_` variable.

Use a **separate key for Preview and Development** with `localhost` and `*.vercel.app` referrers, and keep the production key restricted to your production domain only.

### SPA routing

Client-side routing means `/place/tanah-lot` must serve `index.html` rather than 404. Vercel's Vite preset usually handles this, but make it explicit:

```json
// vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

Vite fingerprints filenames in `assets/`, so the immutable cache header is safe there. Do not apply it to `index.html`.

### Custom domain

Vercel → Settings → Domains. Add the domain, point DNS at Vercel, TLS is automatic. **Then add the new domain to the Google Maps key referrer list** — otherwise maps break the moment you cut over, and it will look like a deploy failure.

---

## Preview deploys

Every PR gets a URL. This is the review surface:

- Open it **on a phone**. Mobile-first means desktop review misses real problems.
- Check both themes.
- Check the no-API-key path if previews use a restricted key.
- Run Lighthouse mobile against the preview, not localhost — local numbers are optimistic.

---

## CI

`.github/workflows/validate-data.yml` runs on every push and PR:

```yaml
name: Validate data
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: node scripts/validate-spots.mjs
```

No `npm install` — the validator has zero dependencies, so this passes from the very first commit, before the app exists.

### Adding app checks

Once `package.json` exists, extend the same workflow rather than adding a second one:

```yaml
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

`npm run build` in CI catches the failure mode Vercel would otherwise find for you: a type error or missing import that only appears in a production build.

### Branch protection

On `main`: require the workflow to pass, require one approving review, require branches to be up to date before merge. Disallow force pushes.

---

## Release checklist

Before pointing a real domain at this:

**Data**
- [ ] `node scripts/validate-spots.mjs` exits 0
- [ ] Coordinates spot-checked in Google Maps — every pin lands on the right place
- [ ] Opening hours and prices reconciled against a live source
- [ ] **`rating` resolved** — either relabelled as an editorial score or replaced with live Places data. Shipping placeholder numbers that look like Google ratings is the one thing that would undermine the trust the product depends on (`03-Data-Model.md`)
- [ ] Ferry schedules checked against operator sites
- [ ] Images sourced and licensed, or the gradient fallback confirmed working everywhere

**Google Cloud**
- [ ] Referrer restrictions include the production domain
- [ ] Key restricted to Maps JavaScript, Places, Directions only
- [ ] Daily quota caps set on all three
- [ ] Billing budget alert configured
- [ ] Separate dev/preview key in use

**App**
- [ ] Lighthouse mobile: performance ≥ 90, accessibility ≥ 95
- [ ] Both themes checked on a real device
- [ ] No-API-key path degrades cleanly, no console errors
- [ ] Keyboard-only pass through onboarding, explore, detail and itinerary reorder
- [ ] Deep links work (`/place/:id` served directly, not 404)
- [ ] localStorage survives refresh; a corrupt record resets silently

**Ops**
- [ ] `main` protected
- [ ] Vercel Analytics enabled if wanted (privacy-friendly, no cookie banner needed)

---

## Rollback

Vercel → Deployments → pick the last good one → **Promote to Production**. Instant, no rebuild.

If the cause was data rather than code, revert the data commit and redeploy — the dataset is version-controlled like everything else, which is one of the quiet benefits of shipping JSON instead of a database.

---

## Cost

| | Expected |
|---|---|
| Vercel Hobby | Free — static site, well inside limits |
| GitHub Actions | Free on public repos |
| Google Maps | Free at MVP traffic — the Essentials tier includes ~10k calls per SKU per month, allocated per product rather than as one shared pot. Holds **provided** Places uses session tokens and Directions results are cached (`07-Google-Maps.md`) |

The realistic risk is not traffic. It is an uncapped key plus a render loop calling Directions. Set the quota caps.
