import { useEffect, useState } from 'react';

/**
 * Navigation per Hash (#/budget, #/fixkosten, ...). GitHub Pages kennt keine
 * Umleitung auf index.html; mit Hash liefert ein Neuladen nie eine 404.
 */
export type Route =
  | { seite: 'budget' }
  | { seite: 'fixkosten' }
  | { seite: 'pot'; id: string }
  | { seite: 'einstellungen' };

export function leseRoute(hash: string): Route {
  const teile = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (teile[0]) {
    case 'fixkosten':
      return { seite: 'fixkosten' };
    case 'pot':
      return teile[1] ? { seite: 'pot', id: decodeURIComponent(teile[1]) } : { seite: 'budget' };
    case 'einstellungen':
      return { seite: 'einstellungen' };
    default:
      return { seite: 'budget' };
  }
}

export function zuRoute(r: Route): string {
  return r.seite === 'pot' ? `#/pot/${encodeURIComponent(r.id)}` : `#/${r.seite}`;
}

export function navigiere(r: Route) {
  window.location.hash = zuRoute(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => leseRoute(window.location.hash));
  useEffect(() => {
    const neu = () => {
      setRoute(leseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', neu);
    return () => window.removeEventListener('hashchange', neu);
  }, []);
  return route;
}
