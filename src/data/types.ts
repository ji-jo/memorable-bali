/**
 * The data contract. Mirrors data/*.json exactly — see docs/03-Data-Model.md.
 *
 * ⚠️ The dataset is UNVERIFIED. Coordinates, hours, prices and especially
 * `rating` were written from model knowledge, not a live source. `rating` is an
 * editorial placeholder, NOT a scraped Google rating. Reconcile against Google
 * Places before launch.
 */

export type SpotTag = 'Memorable' | 'Must Visit' | 'Cultural' | 'Outworldly';

export type TravelStyle = 'relaxed' | 'balanced' | 'packed';

export type Transportation = 'scooter' | 'car' | 'taxi' | 'private-driver';

export type LengthOfStay = '1-day' | 'weekend' | '3-days' | '5-days' | '1-week' | '2-weeks';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Cost {
  currency: 'IDR';
  min: number;
  max: number;
  note: string;
}

export interface OpeningHours {
  open?: string;
  close?: string;
  note: string;
}

export interface Spot {
  /** Stable kebab-case slug. Appears in URLs (/place/:id). Never renumber. */
  id: string;
  name: string;
  /** 50–80 characters, enforced by scripts/validate-spots.mjs. One card line. */
  description: string;
  /** 2–3 sentences for the detail page. */
  longDescription: string;
  googleMapsUrl: string;
  /** Always false in JSON. Real state lives in localStorage — never write back. */
  visited: boolean;
  /** 0–5, one decimal. Editorial placeholder, NOT a Google rating. */
  rating: number;
  /** Haversine km from the JSON's anchor. Recomputed at runtime after onboarding. */
  distanceFromStayKm: number;
  tags: SpotTag[];
  /** FK → Category.id. Exactly one; the primary filter bucket. */
  category: string;
  /** FK → Region.id. Where the place IS, not where the visitor sleeps. */
  region: string;
  /** Optional Google Places resource name after reconcile. */
  placeId?: string;
  coordinates: Coordinates;
  /** Paths under public/images/spots/. SpotImage falls back to a gradient if missing. */
  images: string[];
  openingHours: OpeningHours;
  visitDurationMin: number;
  cost: Cost;
  /** Free text, e.g. "07:00–09:00". Parsed loosely for the Sunset interest. */
  bestTime: string;
  /** At least 2. This is the curation the product sells. */
  tips: string[];
  /** FKs → Spot.id. Powers "Nearby recommendations". */
  nearby: string[];
  /** null, or a FerryRoute.id. Required when region === 'nusa'. */
  ferry: string | null;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  /** Hex. Tints map pins and chips. */
  color: string;
  description: string;
}

/**
 * A SEPARATE vocabulary from Category — the onboarding spec lists interests
 * that do not map 1:1 to categories, so the mapping is explicit data rather
 * than logic buried in a component.
 */
export interface OnboardingInterest {
  id: string;
  label: string;
  matchesCategories: string[];
  matchesTags: SpotTag[];
  /** Only 'sunset' uses this — it has no category of its own. */
  matchesBestTimeAfter?: string;
  note?: string;
}

export interface Region {
  id: string;
  label: string;
  blurb: string;
  center: Coordinates;
}

export interface StayArea {
  id: string;
  label: string;
  region: string;
  /** THE distance anchor. Onboarding's choice here drives every distance. */
  center: Coordinates;
  blurb: string;
  suitsTravelStyle: TravelStyle[];
}

export interface FerryPort {
  id: string;
  name: string;
  coordinates: Coordinates;
  note: string;
  arrivesAt: string;
}

export interface FerryOperator {
  name: string;
  bookingUrl: string;
}

export interface FerryRoute {
  id: string;
  label: string;
  destinationRegion: string;
  crossingMinutes: { min: number; max: number };
  departurePorts: FerryPort[];
  /** Indicative only. Schedules change and crossings cancel for weather. */
  indicativeSchedule: { outbound: string[]; return: string[]; note: string };
  indicativePrice: Cost;
  operators: FerryOperator[];
  aggregators: FerryOperator[];
  tips: string[];
}

export interface ItineraryStop {
  /** 1..n, no gaps. */
  order: number;
  spotId: string;
  /** 'HH:MM' */
  arriveAt: string;
  dwellMinutes: number;
  /** Editorial estimate, not Directions API output. */
  travelMinutesFromPrevious: number;
  note?: string;
}

export interface Itinerary {
  id: string;
  title: string;
  summary: string;
  lengthOfStay: LengthOfStay;
  travelStyle: TravelStyle;
  suggestedStayArea: string;
  interests: string[];
  transportation: Transportation[];
  estimatedTotalMinutes: number;
  estimatedCost: Cost;
  stops: ItineraryStop[];
}

/** Written to localStorage at bali-explorer:onboarding. */
export interface OnboardingPreferences {
  interests: string[];
  lengthOfStay: LengthOfStay;
  /** A StayArea.id, or 'custom' when chosen via Places search. */
  stayAreaId: string;
  /** The resolved anchor — from a preset area or a Places result. */
  stayAnchor: Coordinates;
  stayAreaLabel: string;
  transportation: Transportation[];
  travelStyle: TravelStyle;
  completedAt: string;
}

/** Explore's filter state. Lives in the URL query string, not context. */
export interface ExploreFilters {
  category: string | null;
  tags: SpotTag[];
  region: string | null;
  maxKm: number | null;
  maxDurationMin: number | null;
}
