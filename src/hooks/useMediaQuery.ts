import { useEffect, useState } from 'react';

/**
 * Subscribe to a media query.
 *
 * Explore needs this rather than CSS alone: rendering the list in both the
 * mobile sheet and the desktop panel and hiding one with CSS would duplicate
 * every card in the DOM, and `querySelector('[data-spot-id]')` would then find
 * the hidden copy first — silently breaking pin-to-card scrolling.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);

    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Explore switches layout here — see docs/04-Design-System.md. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
