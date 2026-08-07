import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteLoading } from '@/components/RouteLoading';
import { OnboardingProvider, useOnboarding } from '@/state/OnboardingContext';
import { VisitedProvider } from '@/state/VisitedContext';
import { ItineraryProvider } from '@/state/ItineraryContext';

import Landing from '@/screens/Landing';
import Onboarding from '@/screens/Onboarding';
import Home from '@/screens/Home';

// Route-level splitting. Landing and Home stay in the entry chunk so first
// paint is immediate; the heavier screens (and the Maps SDK) load on demand.
const Explore = lazy(() => import('@/screens/Explore'));
const PlaceDetail = lazy(() => import('@/screens/PlaceDetail'));
const ItineraryScreen = lazy(() => import('@/screens/Itinerary'));
const Ferry = lazy(() => import('@/screens/Ferry'));
const NotFound = lazy(() => import('@/screens/NotFound'));

/** `/` redirects straight to Explore once onboarding has been completed. */
function LandingGate() {
  const { isOnboarded } = useOnboarding();
  return isOnboarded ? <Navigate to="/explore" replace /> : <Landing />;
}

function AppRoutes() {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<LandingGate />} />
          <Route path="/onboarding" element={<Navigate to="/onboarding/1" replace />} />
          <Route path="/onboarding/:step" element={<Onboarding />} />

          <Route element={<AppShell />}>
            <Route path="/home" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/place/:id" element={<PlaceDetail />} />
            <Route path="/itinerary" element={<ItineraryScreen />} />
            <Route path="/ferry" element={<Ferry />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <OnboardingProvider>
      <VisitedProvider>
        <ItineraryProvider>
          <AppRoutes />
        </ItineraryProvider>
      </VisitedProvider>
    </OnboardingProvider>
  );
}
