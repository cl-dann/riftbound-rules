/* localStorage a határon, ellenőrzéssel. A kulcsok és a formátum változatlan: rb-deck (a decklista szövege),
   rb-view2 (a Kártyák nézetmódja). Hiba vagy érvénytelen érték esetén a korábbi alapérték.
   Itt szándékosan nincs zod: ez a modul a kezdő bundle része, a két érték ellenőrzése egy-egy típusőr. */
export type CardsViewMode = 'grid' | 'list';

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* privát mód vagy tele tár */ } };

export const readViewMode = (): CardsViewMode => { const v = get('rb-view2'); return v === 'grid' || v === 'list' ? v : 'grid'; };
export const writeViewMode = (m: CardsViewMode) => put('rb-view2', m);
export const readDeck = (): string => get('rb-deck') || '';
export const hasDeck = () => !!get('rb-deck');
export const writeDeck = (t: string) => put('rb-deck', t);
