# 04 — Design System

## The brief, in one line

Clean, minimal, editorial, premium, mobile-first, highly visual. It should feel like a well-made travel magazine that happens to be an app — not a dashboard, not a marketplace.

## What "BEE UI" and "Fluid Functionalism" mean here

These are the stated design languages. Translated into rules you can actually build against:

**BEE UI** — *Bold, Editorial, Effortless.*
- Type does the heavy lifting. Big headings, generous leading, real hierarchy. If a screen looks flat, the type scale is being under-used.
- Photography is the interface. Cards are images with text on them, not text boxes with thumbnails.
- Chrome recedes. Borders, shadows and dividers are the last resort, not the first.

**Fluid Functionalism** — *every visual decision earns its place, and nothing snaps.*
- Space, type and radii scale continuously with the viewport (`clamp()`), not in breakpoint jumps.
- Motion is short and physical. Things move because the user moved them.
- Decoration that carries no information gets cut.

**Practical consequence: no component library.** No MUI, no shadcn, no Chakra. Handcrafted components in `src/components/`, styled with CSS Modules. The look is the product; a generic component kit would flatten it.

---

## Tokens

All tokens are CSS custom properties on `:root` in `src/styles/tokens.css`. Nothing in the app hardcodes a colour, spacing value or radius — if you find yourself typing a hex code in a `.module.css`, a token is missing.

### Colour

Two themes. Dark is not an inversion of light — the ramps are tuned separately so photography sits well on both.

```css
:root {
  /* Surfaces */
  --color-bg:              #FCFBF8;  /* warm off-white, not pure white */
  --color-surface:         #FFFFFF;
  --color-surface-raised:  #FFFFFF;
  --color-surface-sunken:  #F4F1EB;

  /* Text */
  --color-text:            #1A1815;
  --color-text-secondary:  #5C574E;
  --color-text-tertiary:   #8B8579;
  --color-text-inverse:    #FCFBF8;

  /* Lines */
  --color-border:          #E6E1D8;
  --color-border-strong:   #CFC8BA;

  /* Brand — volcanic clay, drawn from Balinese terracotta */
  --color-accent:          #C0553B;
  --color-accent-hover:    #A9462F;
  --color-accent-subtle:   #F7E9E4;
  --color-accent-text:     #FFFFFF;

  /* Secondary — rice-terrace green, for "visited" and success */
  --color-success:         #3F7D5C;
  --color-success-subtle:  #E4EFE8;

  --color-warning:         #B8763E;
  --color-danger:          #B3392B;

  /* Scrims for text over photography */
  --color-scrim:           rgba(20, 18, 15, 0.55);
  --color-scrim-strong:    linear-gradient(180deg, transparent 30%, rgba(20, 18, 15, 0.85) 100%);
}

:root[data-theme='dark'] {
  --color-bg:              #131211;
  --color-surface:         #1C1A18;
  --color-surface-raised:  #24211E;
  --color-surface-sunken:  #0E0D0C;

  --color-text:            #F2EFE9;
  --color-text-secondary:  #A8A197;
  --color-text-tertiary:   #78726A;
  --color-text-inverse:    #131211;

  --color-border:          #2E2B27;
  --color-border-strong:   #454039;

  --color-accent:          #E0725A;   /* lifted for contrast on dark */
  --color-accent-hover:    #EC8570;
  --color-accent-subtle:   #33211C;
  --color-accent-text:     #131211;

  --color-success:         #5FA07C;
  --color-success-subtle:  #1B2A22;

  --color-warning:         #D19A5E;
  --color-danger:          #D9584A;

  --color-scrim:           rgba(0, 0, 0, 0.6);
  --color-scrim-strong:    linear-gradient(180deg, transparent 30%, rgba(0, 0, 0, 0.9) 100%);
}
```

**Contrast**: `--color-text` on `--color-bg` clears 7:1 in both themes. `--color-text-secondary` clears 4.5:1. `--color-text-tertiary` is for non-essential metadata only — never body copy. Verify with a checker after any palette change; do not eyeball it.

**Category colours** live in `categories.json`, not here. They tint map pins and category chips. On dark, render them at 85% opacity over the surface rather than swapping to a second set.

### Theme switching

```ts
type Theme = 'light' | 'dark' | 'system';
// Stored at bali-explorer:theme
// Applied as document.documentElement.dataset.theme = resolved
```

Default to `system` via `matchMedia('(prefers-color-scheme: dark)')` and listen for changes. Set the attribute in a small inline script in `index.html` **before** first paint, or the app flashes light on load for dark-mode users.

### Type

One family for UI, one for editorial headings. Both self-hosted via `@fontsource` — no Google Fonts CDN request, which keeps the page fast and avoids a third-party dependency at runtime.

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-display: 'Fraunces', Georgia, 'Times New Roman', serif;

  /* Fluid scale — min at 360px, max at 1280px */
  --text-xs:   0.75rem;                                   /* 12  — labels, meta */
  --text-sm:   0.875rem;                                  /* 14  — captions */
  --text-base: 1rem;                                      /* 16  — body */
  --text-lg:   clamp(1.125rem, 1.05rem + 0.35vw, 1.25rem);
  --text-xl:   clamp(1.375rem, 1.2rem + 0.8vw, 1.75rem);
  --text-2xl:  clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem);
  --text-3xl:  clamp(2.25rem, 1.6rem + 2.9vw, 3.75rem);

  --leading-tight:  1.15;
  --leading-snug:   1.35;
  --leading-normal: 1.6;

  --tracking-tight: -0.02em;   /* display sizes only */
  --tracking-wide:  0.08em;    /* uppercase labels only */

  --weight-regular: 400;
  --weight-medium:  500;
  --weight-semibold: 600;
}
```

Usage rules:

- `--font-display` is for page titles, place names on detail pages, and section headings. Nowhere else.
- Body copy is `--font-sans` at `--text-base` / `--leading-normal`. Never smaller than 16px for reading text on mobile.
- Uppercase only for category labels and tag badges, always with `--tracking-wide`.
- Measure caps at ~68 characters for `longDescription`.

### Space

A 4px base scale. Every margin, padding and gap uses one of these.

```css
:root {
  --space-1: 0.25rem;   /*  4 */
  --space-2: 0.5rem;    /*  8 */
  --space-3: 0.75rem;   /* 12 */
  --space-4: 1rem;      /* 16 */
  --space-5: 1.5rem;    /* 24 */
  --space-6: 2rem;      /* 32 */
  --space-7: 3rem;      /* 48 */
  --space-8: 4rem;      /* 64 */

  /* Page gutter, fluid */
  --gutter: clamp(1rem, 0.6rem + 2vw, 2rem);
  --content-max: 72rem;
}
```

### Radius, elevation, motion

```css
:root {
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-full: 999px;

  /* Soft and low. Premium reads as restraint, not float. */
  --shadow-sm: 0 1px 2px rgba(20, 18, 15, 0.06);
  --shadow-md: 0 4px 16px rgba(20, 18, 15, 0.08);
  --shadow-lg: 0 12px 32px rgba(20, 18, 15, 0.12);

  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 320ms;
  --ease-out:  cubic-bezier(0.2, 0, 0, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}

:root[data-theme='dark'] {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.6);
}
```

Shadows read poorly on dark surfaces. On dark, prefer a `--color-border` outline or a lighter `--color-surface-raised` to signal elevation, and keep shadows for genuinely floating elements (modals, the map sheet).

**Motion**: transitions on `transform` and `opacity` only — never `width`, `height`, `top` or `left`. Respect the user:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Layout

Mobile-first, always. Write the mobile rule, then add `min-width` queries.

```css
:root {
  --bp-sm: 480px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
}
```

Because CSS custom properties do not work in media query conditions, keep the literal values in `src/styles/breakpoints.css` as comments and write `@media (min-width: 768px)` directly. One source of truth, documented.

Shell:

| Viewport | Navigation |
|---|---|
| < `--bp-md` (768px) | Fixed bottom tab bar, 4 items, 56px tall + safe-area inset |
| ≥ `--bp-md` (768px) | Top bar, horizontal nav |

Reserve safe areas on mobile — `padding-bottom: max(var(--space-4), env(safe-area-inset-bottom))` on the tab bar, or it sits under the iOS home indicator.

Explore has its own breakpoint, independent of the nav shell above — it needs more horizontal room than the nav bar does before a side-by-side layout is usable:

| Viewport | Explore |
|---|---|
| < `--bp-lg` (1024px) | Full-bleed map behind a draggable bottom sheet holding the list |
| ≥ `--bp-lg` (1024px) | Split: list in a fixed left panel, map fixed right |

Both layouts are the same view, synced — never a toggle between two separate screens. See `05-User-Flows.md` Flow 3 and `06-Components.md`'s Explore layout note for the interaction model.

---

## Component conventions

Every component is a folder:

```
src/components/PlaceCard/
├── PlaceCard.tsx
├── PlaceCard.module.css
└── index.ts
```

Rules:

- **CSS Modules only.** No global classes except the reset and token files. No inline `style` except for genuinely dynamic values (a category colour, a map pin position).
- **No `!important`.** If you need it, the specificity is wrong.
- **Compose tokens, never raw values.** `padding: var(--space-4)`, not `padding: 16px`.
- Props are explicit and typed. No `...rest` spreading onto DOM nodes unless the component is a genuine primitive wrapper.

### Focus and touch

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

Never remove focus rings. Minimum touch target 44×44px — pad the hit area rather than growing the visual element.

### Images

Every image needs `width`, `height` (or `aspect-ratio`) to prevent layout shift, `loading="lazy"` below the fold, and a real `alt`. Card covers are `aspect-ratio: 4/3`; detail heroes are `16/9` on mobile, `21/9` from `--bp-lg`.

Since `/images/spots/*.jpg` do not exist yet (see `03-Data-Model.md`), ship a `<SpotImage>` that falls back to a gradient built from the category colour when the source fails. The UI should never show a broken image icon.

---

## Writing style

The copy is part of the design.

- Sentence case everywhere except category chips and tag badges.
- Second person, present tense: "Go before 8am", not "Visitors should arrive early".
- Specific over enthusiastic. "Around 500 steps in full sun" beats "a bit of a walk".
- Never oversell. If a place is crowded, the tip says so — that honesty is what makes the curation trustworthy, and trust is the entire proposition.
