import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import { StorageKeys } from '@/lib/storage';
import { getDefaultAnchor, sync } from '@/data/repository';
import type { Coordinates, OnboardingPreferences } from '@/data/types';

/**
 * Skipping onboarding entirely must still produce a working app, so these
 * defaults are a complete, valid preference set — never a partial record.
 */
export const DEFAULT_PREFERENCES: OnboardingPreferences = {
  interests: ['all'],
  lengthOfStay: '1-week',
  stayAreaId: 'ubud',
  stayAnchor: getDefaultAnchor(),
  stayAreaLabel: 'Ubud',
  transportation: ['scooter'],
  travelStyle: 'balanced',
  completedAt: '',
};

/** Stops per day the itinerary builder suggests, by travel style. */
export const STOPS_PER_DAY = {
  relaxed: 2,
  balanced: 4,
  packed: 6,
} as const;

interface OnboardingContextValue {
  preferences: OnboardingPreferences;
  /** True once onboarding has been completed or explicitly skipped. */
  isOnboarded: boolean;
  /** The live distance anchor — every distance in the app derives from this. */
  anchor: Coordinates;
  update: (patch: Partial<OnboardingPreferences>) => void;
  complete: (patch?: Partial<OnboardingPreferences>) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useLocalStorage<OnboardingPreferences>(
    StorageKeys.onboarding,
    DEFAULT_PREFERENCES,
  );

  const update = useCallback(
    (patch: Partial<OnboardingPreferences>) => {
      setPreferences((prev) => ({ ...prev, ...patch }));
    },
    [setPreferences],
  );

  const complete = useCallback(
    (patch: Partial<OnboardingPreferences> = {}) => {
      setPreferences((prev) => ({
        ...prev,
        ...patch,
        completedAt: new Date().toISOString(),
      }));
    },
    [setPreferences],
  );

  const reset = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, [setPreferences]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      preferences,
      isOnboarded: preferences.completedAt !== '',
      anchor: preferences.stayAnchor,
      update,
      complete,
      reset,
    }),
    [preferences, update, complete, reset],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return ctx;
}

/** Resolve a stay area id to its anchor and label. */
export function resolveStayArea(id: string) {
  const area = sync.stayAreas().find((a) => a.id === id);
  return area ? { anchor: area.center, label: area.label } : null;
}
