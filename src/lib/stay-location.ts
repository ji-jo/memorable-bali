import { OpenLocationCode } from 'open-location-code';

import { BALI_CENTER, isWithinBali } from '@/lib/geo';
import type { Coordinates } from '@/data/types';

const olc = new OpenLocationCode();

/** Match "lat, lng" / "lat lng" / "lat;lng" with optional degree symbols. */
const COORD_PATTERN =
  /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export type ParsedLocation =
  | { ok: true; coordinates: Coordinates; kind: 'coordinates' | 'pluscode' }
  | { ok: false; message: string };

function looksLikePlusCode(value: string): boolean {
  return /\+/.test(value) || /^[2-9CFGHJMPQRVWX]{4,}/i.test(value.trim());
}

/**
 * Parse a typed stay location: decimal coordinates or a Google Plus Code
 * (Open Location Code). Short codes are recovered relative to Bali.
 */
export function parseStayLocationInput(raw: string): ParsedLocation {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter coordinates or a Google Plus Code.' };
  }

  const coordMatch = trimmed.match(COORD_PATTERN);
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lng = Number(coordMatch[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, message: 'Those coordinates look invalid.' };
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { ok: false, message: 'Latitude/longitude out of range.' };
    }
    const coordinates = { lat, lng };
    if (!isWithinBali(coordinates)) {
      return { ok: false, message: 'Pin a place inside Bali.' };
    }
    return { ok: true, coordinates, kind: 'coordinates' };
  }

  if (looksLikePlusCode(trimmed)) {
    try {
      // Strip trailing locality labels: "6P5V+2R Denpasar"
      const codeToken = trimmed.split(/\s+/)[0] ?? trimmed;
      let fullCode = codeToken.toUpperCase();
      if (!olc.isValid(fullCode)) {
        return { ok: false, message: 'That Plus Code is not valid.' };
      }
      if (olc.isShort(fullCode)) {
        fullCode = olc.recoverNearest(fullCode, BALI_CENTER.lat, BALI_CENTER.lng);
      }
      if (!olc.isFull(fullCode)) {
        return { ok: false, message: 'Need a full or short Plus Code.' };
      }
      const area = olc.decode(fullCode);
      const coordinates = {
        lat: area.latitudeCenter,
        lng: area.longitudeCenter,
      };
      if (!isWithinBali(coordinates)) {
        return { ok: false, message: 'That Plus Code is outside Bali.' };
      }
      return { ok: true, coordinates, kind: 'pluscode' };
    } catch {
      return { ok: false, message: 'Could not read that Plus Code.' };
    }
  }

  return {
    ok: false,
    message: 'Use coordinates (−8.68, 115.23) or a Google Plus Code (6P5V+2R).',
  };
}

export function formatStayCoordinates(coordinates: Coordinates): string {
  return `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`;
}

export function formatStayPlusCode(coordinates: Coordinates): string {
  try {
    return olc.encode(coordinates.lat, coordinates.lng);
  } catch {
    return '';
  }
}

/**
 * Short display name for stay labels that come back as full geocode strings
 * (e.g. "Kusamba, Dawan, Klungkung Regency" → "Kusamba").
 */
export function shortStayLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  const first = trimmed.split(',')[0]?.trim() ?? trimmed;
  return first || trimmed;
}
