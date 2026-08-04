import { NavLink, Outlet } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useItinerary } from '@/state/ItineraryContext';
import styles from './AppShell.module.css';

const NAV = [
  { to: '/home', label: 'Home', icon: '⌂' },
  { to: '/explore', label: 'Explore', icon: '◎' },
  { to: '/itinerary', label: 'Trip', icon: '⋮⋮' },
  { to: '/ferry', label: 'Ferry', icon: '⛴' },
] as const;

export function AppShell() {
  const { active } = useItinerary();
  const stopCount = active?.stops.length ?? 0;

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className={styles.topBar}>
        <NavLink to="/home" className={styles.brand}>
          Memorable Bali
        </NavLink>
        <nav className={styles.topNav} aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.topLink} ${isActive ? styles.topLinkActive : ''}`
              }
            >
              {item.label}
              {item.to === '/itinerary' && stopCount > 0 && (
                <span className={styles.badge} aria-label={`${stopCount} stops`}>
                  {stopCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <ThemeToggle />
      </header>

      <main id="main" className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.tabBar} aria-label="Main">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
          >
            <span className={styles.tabIcon} aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
            {item.to === '/itinerary' && stopCount > 0 && (
              <span className={styles.badge} aria-label={`${stopCount} stops`}>
                {stopCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
