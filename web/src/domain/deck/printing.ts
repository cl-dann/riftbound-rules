/* Nyomat a decklistában: a sor végén szögletes zárójelben a nyomat kódja és opcionálisan a "foil" szó,
   például "2 Ahri, Inquisitive [ogn-119a-298 foil]". Jelölés nélkül a sor a mai viselkedést követi (névenként a legolcsóbb
   nyomat normál ára), így a régi #d= linkek és mentett decklisták változatlanok. A jelölés a decklista szövegében
   utazik, ezért a #d= link, a mentés és a PDF is ugyanazt a nyomatot látja. */
import type { Card } from '../data/schema';
import type { PriceRow, Prices } from './prices';

/** A Cardmarket árfájl szettnevei (a nyomat kódjának eleje). */
export const SETN: Record<string, string> = { ogn: 'Origins', ogs: 'Proving Grounds', sfd: 'Spiritforged', unl: 'Unleashed', ven: 'Vendetta', rad: 'Radiance' };

const PR_RE = /^(.*?)\s*\[([a-z0-9-]+)(?:\s+(foil))?\]\s*$/i;
/** A sor nevéből a lapnév és a választott nyomat. */
export function splitPr(name: string): { name: string; pr?: string; foil?: boolean } {
  const m = PR_RE.exec(name);
  return m ? { name: m[1], pr: m[2].toLowerCase(), foil: !!m[3] } : { name };
}
/** A sor neve a választott nyomattal (üres kód: alapérték, jelölés nélkül). */
export const withPr = (name: string, pr: string | null, foil: boolean) => splitPr(name).name + (pr ? ' [' + pr + (foil ? ' foil' : '') + ']' : '');

/** A nyomat rövid neve: szett, gyűjtői szám, ritkaság. */
export function prLabel(c: Card, code: string): string {
  const p = (c.pr || []).find((x) => x[0] === code);
  return p ? p[2] + ' ' + p[3] + (p[4] ? ', ' + p[4] : '') : code;
}

/** Egy nyomat ára a választott kivitelben (normál vagy foil): 1 és 7 napos átlag. */
export function prPrice(P: Prices | null, code: string, foil: boolean): { a1: number | null; a7: number | null } | null {
  const r: PriceRow | undefined = P?.pr?.[code];
  if (!r) return null;
  const a1 = foil ? (r.f1 ?? null) : r.a1, a7 = foil ? (r.f7 ?? null) : r.a7;
  return a1 == null && a7 == null ? null : { a1, a7 };
}
