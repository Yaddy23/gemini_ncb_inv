import { useEffect, useState } from 'react';

/**
 * Reactive media query hook (SSR-safe).
 * @param {string} query CSS media query, e.g. '(max-width: 1023px)'
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Mobile chrome (top bar + drawer) applies below lg (1024px). */
export const useIsMobile = () => useMediaQuery('(max-width: 1023px)');
