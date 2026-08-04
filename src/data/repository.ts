/**
 * THE ONLY module that reads the JSON files.
 *
 * No screen, hook or component may import from data/*.json directly. This is
 * the seam that makes the future Supabase migration a one-file change instead
 * of a rewrite (docs/02-Architecture.md). A direct JSON import elsewhere is a
 * bug even if it works.
 *
 * Every function is async even though the data is bundled and resolves
 * immediately. That costs nothing now and means call sites never change when
 * the source becomes a network round-trip.
 */

import spotsFile from '@data/bali-spots.json';
import categoriesFile from '@data/categories.json';
import regionsFile from '@data/regions.json';
import stayAreasFile from '@data/stay-areas.json';
import ferriesFile from '@data/ferries.json';
import itinerariesFile from '@data/itineraries.sample.json';

import type {
  Category,
  FerryRoute,
  Itinerary,
  OnboardingInterest,
  Region,
  Spot,
  StayArea,
} from './types';

export async function getSpots(): Promise<Spot[]> {
  return spotsFile.spots as Spot[];
}

export async function getSpotById(id: string): Promise<Spot | undefined> {
  return (spotsFile.spots as Spot[]).find((s) => s.id === id);
}

export async function getSpotsByIds(ids: string[]): Promise<Spot[]> {
  const byId = new Map((spotsFile.spots as Spot[]).map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter((s): s is Spot => s !== undefined);
}

export async function getCategories(): Promise<Category[]> {
  return categoriesFile.categories as Category[];
}

export async function getOnboardingInterests(): Promise<OnboardingInterest[]> {
  return categoriesFile.onboardingInterests as OnboardingInterest[];
}

export async function getRegions(): Promise<Region[]> {
  return regionsFile.regions as Region[];
}

export async function getStayAreas(): Promise<StayArea[]> {
  return stayAreasFile.stayAreas as StayArea[];
}

export async function getFerryRoutes(): Promise<FerryRoute[]> {
  return ferriesFile.routes as FerryRoute[];
}

export async function getFerryRouteById(id: string): Promise<FerryRoute | undefined> {
  return (ferriesFile.routes as FerryRoute[]).find((r) => r.id === id);
}

export async function getSampleItineraries(): Promise<Itinerary[]> {
  return itinerariesFile.itineraries as Itinerary[];
}

/** The anchor used for distances before onboarding sets a real one. */
export function getDefaultAnchor() {
  return spotsFile._meta.distanceAnchor.center;
}

/**
 * Synchronous accessors — for module-level constants and tests only.
 * Screens and components use the async functions above so they keep working
 * unchanged when the data moves behind a network call.
 */
export const sync = {
  spots: () => spotsFile.spots as Spot[],
  categories: () => categoriesFile.categories as Category[],
  regions: () => regionsFile.regions as Region[],
  stayAreas: () => stayAreasFile.stayAreas as StayArea[],
};
