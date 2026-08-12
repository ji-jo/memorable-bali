import { useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BoatIcon } from '@phosphor-icons/react/dist/csr/Boat';
import { CompassIcon } from '@phosphor-icons/react/dist/csr/Compass';
import { HouseIcon } from '@phosphor-icons/react/dist/csr/House';
import { MapTrifoldIcon } from '@phosphor-icons/react/dist/csr/MapTrifold';

import { MakerCredit } from '@/components/MakerCredit';
import {
  ExpandableTabs,
  type ExpandableTabsItem,
} from '@/components/motion/expandable-tabs';

const NAV: Array<ExpandableTabsItem & { to: string }> = [
  {
    id: 'home',
    label: 'Home',
    icon: <HouseIcon size={18} weight="duotone" />,
    content: <p className="px-3 pt-3 text-center text-sm text-current">Your Bali, at a glance.</p>,
    to: '/home',
  },
  {
    id: 'explore',
    label: 'Explore',
    icon: <CompassIcon size={18} weight="duotone" />,
    content: <p className="px-3 pt-3 text-center text-sm text-current">Find somewhere worth the detour.</p>,
    to: '/explore',
  },
  {
    id: 'trip',
    label: 'Trip',
    icon: <MapTrifoldIcon size={18} weight="duotone" />,
    content: <p className="px-3 pt-3 text-center text-sm text-current">Shape a day that feels unhurried.</p>,
    to: '/itinerary',
  },
  {
    id: 'ferry',
    label: 'Ferry',
    icon: <BoatIcon size={18} weight="duotone" />,
    content: <p className="px-3 pt-3 text-center text-sm text-current">Cross to the islands with a plan.</p>,
    to: '/ferry',
  },
];

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeRoute = useMemo(
    () => NAV.find((item) => pathname === item.to)?.id ?? null,
    [pathname],
  );
  const onPlace = pathname.startsWith('/place/');

  // Place detail owns the map chrome; hide the tab bar so the map can breathe.
  useEffect(() => {
    document.documentElement.classList.toggle('hide-app-nav', onPlace);
    return () => document.documentElement.classList.remove('hide-app-nav');
  }, [onPlace]);

  return (
    <>
      <Outlet />
      {!onPlace && (
        <ExpandableTabs
          key={pathname}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 shadow-none"
          items={NAV}
          defaultValue={activeRoute}
          onValueChange={(id) => {
            const destination = NAV.find((item) => item.id === id);
            if (destination) navigate(destination.to);
          }}
        />
      )}
      <MakerCredit />
    </>
  );
}
