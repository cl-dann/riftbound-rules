/* Az ártörténet adatai (a tools/prices/history.py formátuma) séma nélkül, hogy a kártya-ablak kódja ne húzza be a zodot;
   a fájl ellenőrzése a lustán töltött history.ts-ben van. */
/** d: a frissítések napjai; s: nyomatonként a normál (n) és a foil (f) ár centben, delta kódolva (null: aznap nincs ár). */
export type PriceHistory = { v: number; d: string[]; s: Record<string, { n: (number | null)[]; f: (number | null)[] }> };

/** Delta kódolt centekből euró értékek (null: aznap nem volt ár). */
export function decodeSeries(xs: (number | null)[]): (number | null)[] {
  let acc = 0;
  return xs.map((x) => (x == null ? null : (acc += x) / 100));
}
/** Egy nyomat sorai: normál és foil, csak ha legalább 2 napon van ár. */
export function printingSeries(h: PriceHistory, code: string): { n: (number | null)[] | null; f: (number | null)[] | null } {
  const s = h.s[code]; if (!s) return { n: null, f: null };
  const two = (v: (number | null)[]) => (v.filter((x) => x != null).length >= 2 ? v : null);
  return { n: two(decodeSeries(s.n)), f: two(decodeSeries(s.f)) };
}
