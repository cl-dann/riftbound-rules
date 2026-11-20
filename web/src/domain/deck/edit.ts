import { CARDS, byName } from '../data/store';
import { norm } from '../text/norm';
import type { Prices } from './prices';

// A decklista szövege marad az egyetlen forrás: a builder ezt szerkeszti,
// így a megosztható link, a PDF és a legalitás-ellenőrzés változatlanul működik.


export const SECS = ['Legend', 'Champion', 'MainDeck', 'Battlefields', 'Rune Pool', 'Sideboard'];
const secKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '');

export const pn = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
export function priceOf(c: any, P: Prices | null) {
  if (!P || !c) return null;
  // A Signature lapokat a Cardmarket a champion neve nélkül listázza (Bullet Time, Miss Fortune -> Bullet Time).
  return P.cards[pn(c.n)] || P.cards[pn((c.a || []).find((a: string) => a.includes(',')) || '')]
    || (c.t !== 'Unit' && c.t !== 'Legend' && c.n.includes(',') ? P.cards[pn(c.n.split(',')[0])] : null) || null;
}

export function listName(c: any) {
  return c.t === 'Legend' ? ((c.a || []).find((a: string) => a.includes(',')) || c.n) : c.n;
}

type Sec = { name: string; rows: { qty: number; name: string }[] };
function parse(text: string): Sec[] {
  const out: Sec[] = []; let cur: Sec | null = null;
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim(); if (!line) return;
    const h = /^([A-Za-z][A-Za-z \-]*?)\s*:\s*$/.exec(line);
    if (h) { cur = { name: h[1], rows: [] }; out.push(cur); return; }
    if (!cur) { cur = { name: 'MainDeck', rows: [] }; out.push(cur); }
    const m = /^(\d+)\s*[xX]?\s+(.+)$/.exec(line);
    cur.rows.push({ qty: m ? +m[1] : 1, name: (m ? m[2] : line).trim() });
  });
  return out;
}
function dump(secs: Sec[]) {
  const ord = (s: Sec) => { const i = SECS.findIndex((x) => secKey(x) === secKey(s.name)); return i < 0 ? 99 : i; };
  return secs.filter((s) => s.rows.length).sort((a, b) => ord(a) - ord(b))
    .map((s) => s.name + ':\n' + s.rows.map((r) => r.qty + ' ' + r.name).join('\n')).join('\n\n') + '\n';
}

export function legendOf(text: string) {
  const s = parse(text).find((x) => secKey(x.name) === 'legend');
  return s?.rows[0] ? byName.get(norm(s.rows[0].name)) || null : null;
}

// Hova kerül egy hozzáadott lap. Champion unit az üres Champion zónába megy, ha a legend tagjével egyezik.
export function targetSec(c: any, text: string) {
  if (c.t === 'Legend') return 'Legend';
  if (c.t === 'Battlefield') return 'Battlefields';
  if (c.t === 'Rune') return 'Rune Pool';
  const secs = parse(text);
  const ch = secs.find((x) => secKey(x.name) === 'champion');
  const leg = legendOf(text);
  if ((c.st || []).includes('Champion') && (!ch || !ch.rows.length) && (!leg || !leg.ch || (c.tg || []).includes(leg.ch))) return 'Champion';
  return 'MainDeck';
}

export function editDeck(text: string, sec: string, c: any, delta: number) {
  const secs = parse(text);
  let s = secs.find((x) => secKey(x.name) === secKey(sec));
  if (!s) { s = { name: sec, rows: [] }; secs.push(s); }
  // Legendből és Championból egy lehet: az új lecseréli a régit.
  if (delta > 0 && (secKey(sec) === 'legend' || secKey(sec) === 'champion')) s.rows = s.rows.filter((r) => byName.get(norm(r.name)) === c);
  let r = s.rows.find((x) => byName.get(norm(x.name)) === c || norm(x.name) === norm(c.n));
  if (!r) { if (delta <= 0) return text; r = { qty: 0, name: listName(c) }; s.rows.push(r); }
  r.qty = Math.max(0, r.qty + delta);
  if (secKey(sec) === 'legend' || secKey(sec) === 'champion' || c.t === 'Battlefield') r.qty = Math.min(r.qty, 1);
  s.rows = s.rows.filter((x) => x.qty > 0);
  return dump(secs);
}

export function searchCards(q: string, legend: any, onlyLegal: boolean, type: string) {
  const nq = norm(q); const seen = new Set<string>(); const out: any[] = [];
  const id: string[] = legend?.d || [];
  for (const c of CARDS) {
    if (seen.has(c.n) || (c.st || []).includes('Token')) continue;
    if (type && c.t !== type) continue;
    if (nq && !(c.a || [c.n]).some((a: string) => norm(a).includes(nq))) continue;
    if (onlyLegal && legend && c.t !== 'Legend' && (c.d || []).some((d: string) => !id.includes(d))) continue;
    if (onlyLegal && c.ban === 1) continue;
    seen.add(c.n); out.push(c);
    if (out.length >= 40) break;
  }
  return out;
}

export const eur = (v: number | null | undefined) => v == null ? 'n/a' : v.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
