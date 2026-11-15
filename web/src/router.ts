import { useEffect, useState } from 'react';

export type View = 'kartyak' | 'deck' | 'szabalyok' | 'chain' | 'tanulas' | 'kezikonyv';
export const VIEWS: [View, string][] = [
  ['kartyak', 'Kártyák'], ['deck', 'Deck'], ['szabalyok', 'Szabályzat'], ['chain', 'Chain'], ['tanulas', 'Útmutató'], ['kezikonyv', 'Kézikönyv'],
];

/** A régi hash linkek (#d=, #c=, #r-..., #tud-...) változatlanul működnek. */
export function viewOf(h: string): View {
  if (/^#d=/.test(h)) return 'deck';
  if (/^#c=/.test(h)) return 'chain';
  if (/^#r-/.test(h)) return 'szabalyok';
  if (/^#tud-guide/.test(h) || /^#tanulas/.test(h)) return 'tanulas';
  if (/^#tud-/.test(h) || h === '#tudastar') return 'kezikonyv';
  const v = h.slice(1) as View;
  return VIEWS.some(([k]) => k === v) ? v : 'kartyak';
}

export function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}
