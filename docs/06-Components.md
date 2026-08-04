# 06 — Components

Handcrafted React components. No MUI, no shadcn, no Chakra — see `04-Design-System.md` for why.

Every component is a folder with a `.tsx`, a `.module.css` and an `index.ts`. Props are explicit and typed; no `...rest` spreading onto DOM nodes unless the component is a genuine primitive wrapper.

Types referenced below come from `src/data/types.ts` (`03-Data-Model.md`).

---

## Primitives

### `Button`
```ts
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}
```
Minimum 44px touch target at every size — pad the hit area rather than growing the visual box. `loading` disables and swaps content for a spinner while preserving width, so the layout does not jump.

### `Chip`
```ts
interface ChipProps {
  label: string;
  selected?: boolean;
  color?: string;        // category colour; tints background when selected
  icon?: ReactNode;
  onToggle?: () => void;
  onRemove?: () => void; // renders an × — used for active filter chips
}
```
Used for categories, interests and active filters. Renders as `<button>` when interactive, `<span>` when not.

### `Sheet`
```ts
interface SheetProps {
  open: boolean;
  onClose: () => void;
  snapPoints?: ('peek' | 'half' | 'full')[];
  children: ReactNode;
}
```
Bottom sheet on mobile, side panel from `--bp-lg`. Must handle: focus trap while open, Escape to close, swipe-down to dismiss, backdrop click, and body scroll lock. Animate `transform` only.

### `SpotImage`
```ts
interface SpotImageProps {
  src: string;
  alt: string;
  aspect?: '4/3' | '16/9' | '21/9' | '1/1';
  priority?: boolean;       // skips lazy loading, for above-fold heroes
  categoryColor?: string;   // seeds the fallback gradient
}
```
**Required wherever a spot image renders.** The `/images/spots/*.jpg` assets do not exist yet (`03-Data-Model.md`), so this component's fallback is what users will actually see on first build: on error or missing src, render a gradient derived from `categoryColor` with the spot initial. Never a broken image icon.

Always sets explicit dimensions or `aspect-ratio` to prevent layout shift.

### Others
`Rating` (stars + numeric, `aria-label="Rated 4.5 out of 5"`), `Skeleton` (respects reduced-motion), `EmptyState` (illustration, message, action), `ThemeToggle`.

---

## Domain components

### `PlaceCard`
```ts
interface PlaceCardProps {
  spot: Spot;
  variant?: 'default' | 'compact' | 'wide';
  distanceKm?: number;      // from the live anchor, overrides spot.distanceFromStayKm
  showVisited?: boolean;
  onClick?: () => void;
}
```
The workhorse. Renders exactly: cover image, category, distance, estimated duration, rating, and the 50–80 character `description`. **Nothing else.** The card is deliberately spare — extra metadata is what makes a directory feel like a directory.

- `default` — vertical, 4:3 cover, for grids and rails.
- `compact` — horizontal, 88px thumbnail, for map sheets and itinerary stops.
- `wide` — 16:9 cover, for featured rails.

Wrap in `<Link to={`/place/${spot.id}`}>`, not an onClick handler on a div — middle-click and open-in-new-tab must work.

### `TagBadge`
```ts
interface TagBadgeProps {
  tag: 'Memorable' | 'Must Visit' | 'Cultural' | 'Outworldly';
  size?: 'sm' | 'md';
}
```
The four editorial tags. Distinct visual treatment per tag, uppercase with `--tracking-wide`. Keep it quiet — a card with three loud badges is noise.

### `CategoryChip`
`Chip` bound to a `Category`, pulling `label`, `icon` and `color` from `categories.json`.

### `VisitedToggle`
```ts
interface VisitedToggleProps {
  spotId: string;
  variant?: 'icon' | 'button';
}
```
Reads and writes `VisitedContext`. Optimistic, no confirmation, persists immediately. `aria-pressed` reflects state. This is the user's checkbox from the data spec — it never writes to the JSON.

### `MapView`
```ts
interface MapViewProps {
  spots: Spot[];
  center?: Coordinates;
  zoom?: number;
  selectedId?: string | null;
  route?: google.maps.DirectionsResult | null;
  onSelectSpot?: (id: string) => void;
  onBoundsChange?: (bounds: google.maps.LatLngBounds) => void;
  cluster?: boolean;        // default true above ~30 pins
  height?: string;
}
```
The only component that touches the Maps SDK directly. Everything else goes through it.

Responsibilities: load via `useGoogleMaps()`, render category-coloured pins, cluster when dense, fit bounds to `spots` on change, apply the light or dark map style from `ThemeContext`, and render `route` when present.

**Must degrade.** No API key or a load failure renders an `EmptyState` explaining that maps are unavailable — never a blank grey box, never a crash.

### `MapPin`
```ts
interface MapPinProps {
  spot: Spot;
  color: string;
  selected?: boolean;
  visited?: boolean;
}
```
Custom `AdvancedMarkerElement` content. Selected pins scale up and lift; visited pins show a check. Do not use default red Google pins — they undo the design system in one stroke.

### `FilterBar`
```ts
interface FilterBarProps {
  filters: ExploreFilters;                       // category, tags, region, maxKm, maxDurationMin
  onChange: (next: ExploreFilters) => void;
  resultCount: number;
}
```
Reads from and writes to the URL query string, not local state — that is what makes filtered views linkable. Active filters render as removable chips with a "clear all". Always shows the result count.

### `SearchOverlay`
```ts
interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}
```
Full-screen on mobile, dropdown from `--bp-md`. Debounced 150ms, in-memory filter over 54 records — no search library. Matches name, description, category label, region label and tags, case- and accent-insensitive. Recent searches capped at 5. Keyboard: ↑/↓ to move, Enter to open, Escape to close.

### `ItineraryStop`
```ts
interface ItineraryStopProps {
  stop: ItineraryStop;
  spot: Spot;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onReorder: (from: number, to: number) => void;
  onRemove: () => void;
  onDwellChange: (minutes: number) => void;
}
```
Shows order number, `PlaceCard` in `compact`, travel time from previous, and an editable dwell time.

**Reordering must be keyboard accessible.** Provide move-up/move-down buttons alongside drag. Drag-only reordering excludes keyboard and screen-reader users and fails the AA target in `01-PRD.md`.

### `RouteSummary`
```ts
interface RouteSummaryProps {
  totalTravelMinutes: number;
  totalVisitMinutes: number;
  totalCost: { min: number; max: number; currency: string };
  stopCount: number;
  warnings?: string[];      // "Over 10 hours", "Misses the last ferry"
}
```
Sticky at the top of the itinerary. Warnings are prominent — an itinerary that quietly misses the last boat from Nusa Penida is worse than no itinerary.

### `FerryInfo`
```ts
interface FerryInfoProps {
  route: FerryRoute;
  compact?: boolean;
}
```
Operators, ports, indicative schedule and price, external booking links (`target="_blank" rel="noopener noreferrer"`).

**Must state that schedules are indicative and crossings cancel for weather.** That caveat is not optional copy — it is the difference between helpful and harmful.

### `NearbyRail`
Horizontal scroller of `PlaceCard`s resolved from a spot's `nearby` ids. Snap scrolling, momentum, no scrollbar on touch.

---

## Layout

### `AppShell`
Bottom tab bar below `--bp-md` (Home, Explore, Itinerary, Settings — 56px plus `env(safe-area-inset-bottom)`), top nav above it. Renders the router outlet.

### `Section`
```ts
interface SectionProps {
  title: string;
  subtitle?: string;
  action?: { label: string; to: string };
  scrollable?: boolean;     // horizontal rail
  children: ReactNode;
}
```
Every Home rail. Uses `--font-display` for the title.

### `Rail`
Horizontal snap-scrolling container with consistent gutters. Cards peek at the right edge to signal more content — no arrows on touch.

---

## Conventions

**Composition over configuration.** If a component has more than about eight props, it is probably two components.

**Loading**: skeletons matching final layout, never spinners for content.

**Empty**: every list handles zero results with a message naming the cause and an action.

**Errors**: a boundary per screen. Errors show a message and a retry, never a white page.

**Accessibility, non-negotiable**: keyboard reachable, visible `:focus-visible`, `aria-label` on icon-only buttons, `aria-pressed` on toggles, `aria-live="polite"` on filter result counts, and a logical heading order. Icon-only buttons without labels are the most common failure — check them first.

**Testing**: co-locate `Component.test.tsx`. Test behaviour, not markup. Priorities: `PlaceCard` renders every required field, `FilterBar` round-trips through the URL, `ItineraryStop` reorders by keyboard, `SpotImage` falls back on error, `MapView` degrades without a key.
