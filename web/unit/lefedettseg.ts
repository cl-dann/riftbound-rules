/* Lapértelmezés lefedettsége mind az 1101 lapon: utasításokra bontás és műveletfelismerés. A lefedettség teszt és a riport használja. */
import { CARDS } from '../src/legacy/core';
import { instrSources, splitInstr, actOf, LINK_RE, DIRECT_RE } from '../src/legacy/chainCore';

/* A módosítás előtti felismerés (chain.ts, 2026-11-19 állapot) szó szerint, az "előtte" számokhoz. */
function oldActOf(eff: string): { k: string } {
  if (/counter (?:a|an|that|it)?\b[^.]{0,30}spell|counter a spell/i.test(eff)) return { k: 'counter' };
  if (/\battach this to\b/i.test(eff)) return { k: 'attach' };
  if (/\[Add\]/.test(eff)) return { k: 'add' };
  if (/return[^.]{0,80}hand/i.test(eff)) return { k: 'hand' };
  if (/\bbanish/i.test(eff)) return { k: 'banish' };
  if (/\bkill\b/i.test(eff)) return { k: 'kill' };
  if (/\brecall/i.test(eff)) return { k: 'recall' };
  if (/\bmove\b[^.]{0,40}\bbase\b/i.test(eff)) return { k: 'base' };
  if (/\bdeal (\d+)/i.test(eff)) return { k: 'dmg' };
  if (/\bstun\b/i.test(eff)) return { k: 'stun' };
  if (/\bbuff\b/i.test(eff)) return { k: 'buff' };
  if (/\bdraws? (\d+)/i.test(eff)) return { k: 'draw' };
  return { k: 'other' };
}
const OLD_KW = /^(?:\[(?:Reaction|Action|Hidden|Quick-Draw|Accelerate|Ganking|Deflect(?: \d+)?|Tank|Backline|Shield(?: \d+)?|Assault(?: \d+)?|Vision|Temporary|Legion)\]\s*)+/i;
const oldSplit = (eff: string) => String(eff || '').replace(OLD_KW, '').split(/(?<=\.)\s+|,\s*then\s+|\s+and\s+(?=(?:ready|stun|exhaust|buff|draw|recall|give)\b)/i).map((x) => x.trim()).filter(Boolean);
/** Előtte: a régi felbontás és felismerés ugyanazokon a forrásokon (a költségsorokat is utasításként kezelte). */
export function coverageOld() {
  let tot = 0, other = 0;
  for (const c of CARDS as any[]) for (const s of instrSources(c)) for (const t of oldSplit(s.e)) { tot++; if (oldActOf(t).k === 'other') other++; }
  return { tot, other, known: tot - other };
}

export function coverage() {
  let srcs = 0, tot = 0, other = 0, unsure = 0, costs = 0, linked = 0;
  const pat: Record<string, number> = {}; const ex: Record<string, string> = {};
  const byK: Record<string, number> = {};
  for (const c of CARDS as any[]) for (const s of instrSources(c)) {
    srcs++;
    const parts = s.k === 'cost' ? [s.e] : splitInstr(s.e);
    parts.forEach((t: string, i: number) => {
      tot++;
      if (s.k === 'cost') { costs++; byK.cost = (byK.cost || 0) + 1; return; }
      const a = actOf(t); byK[a.k] = (byK[a.k] || 0) + 1;
      if (i && (DIRECT_RE.test(t) || LINK_RE.test(t))) linked++;
      if (a.k === 'other' || a.unsure) {
        if (a.k === 'other') other++; else unsure++;
        const key = (a.k === 'other' ? '' : '[' + a.k + '] ') + t.toLowerCase().replace(/\d+/g, 'N').replace(/[.,]/g, '').split(/\s+/).slice(0, 3).join(' ');
        pat[key] = (pat[key] || 0) + 1; ex[key] = ex[key] || c.n + ': ' + t;
      }
    });
  }
  const top = Object.entries(pat).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, n]) => ({ k, n, ex: ex[k] }));
  return { srcs, tot, other, unsure, known: tot - other - unsure, costs, linked, top, byK };
}
