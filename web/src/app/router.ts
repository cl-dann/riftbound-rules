import { useEffect, useState } from 'react';

export type View = 'kartyak' | 'deck' | 'szabalyok' | 'chain' | 'hogyan' | 'tanulas' | 'kezikonyv';
export const VIEWS: [View, string][] = [
  ['kartyak', 'Kártyák'], ['deck', 'Deck'], ['szabalyok', 'Szabályzat'], ['chain', 'Chain'], ['hogyan', 'How to Play'], ['tanulas', 'Practice'], ['kezikonyv', 'Fogalomtár'],
];

/** A régi hash linkek (#d=, #c=, #r-..., #tud-...) változatlanul működnek. */
export function viewOf(h: string): View {
  if (/^#d=/.test(h)) return 'deck';
  if (/^#kartya\//.test(h)) return 'kartyak';
  if (/^#c=/.test(h)) return 'chain';
  if (/^#r-/.test(h) || /^#fmt-/.test(h)) return 'szabalyok';
  if (/^#tud-guide/.test(h) || /^#hogyan/.test(h)) return 'hogyan';
  if (/^#tanulas/.test(h)) return 'tanulas';
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
