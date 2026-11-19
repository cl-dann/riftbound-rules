/* Lapértelmezés lefedettsége mind az 1101 lapon. Mindhárom mérés ugyanazokon a forrásokon (instrSources) fut:
   - coverageOld: a legelső, chainCore előtti felismerés (chain.ts, 2026-11-19 reggel);
   - coveragePrev: az előző commit (5248b99) chainCore-ja, unit/elozo/chainCore_elozo.ts;
   - coverage: a jelenlegi. */
import { CARDS } from '../src/legacy/core';
import { instrSources, splitInstr, classOf, hiddenWhy } from '../src/legacy/chainCore';
import * as P from './elozo/chainCore_elozo';

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
const srcs = () => (CARDS as any[]).flatMap((c) => instrSources(c).map((s: any) => ({ c, s })));
export function coverageOld() {
  let tot = 0, other = 0;
  for (const { s } of srcs()) for (const t of oldSplit(s.e)) { tot++; if (oldActOf(t).k === 'other') other++; }
  return { tot, other };
}
export function coveragePrev() {
  let tot = 0, other = 0, unsure = 0;
  for (const { s } of srcs()) { const parts = s.k === 'cost' ? [s.e] : P.splitInstr(s.e); for (const t of parts) { tot++; if (s.k === 'cost') continue; const a: any = P.actOf(t.replace(/^[-\u2014\u2013]\s*/, '')); if (a.k === 'other') other++; else if (a.unsure) unsure++; } }
  return { tot, other, unsure };
}
export function coverage() {
  let tot = 0, other = 0, unsure = 0, hidden = 0, open = 0, costs = 0;
  const pat: Record<string, number> = {}; const ex: Record<string, string> = {};
  const bad: string[] = []; const hid: string[] = []; const opn: string[] = [];
  for (const { c, s } of srcs()) {
    const parts = s.k === 'cost' ? [s.e] : splitInstr(s.e);
    for (const t of parts) {
      tot++;
      if (s.k === 'cost') { costs++; continue; }
      const k = classOf(t, c.n);
      if (k === 'hidden') { hidden++; hid.push(c.n + ': ' + t + ' | ' + hiddenWhy(t, c.n)); }
      if (k === 'open') { open++; opn.push(c.n + ': ' + t); }
      if (k === 'other' || k === 'unsure') {
        if (k === 'other') other++; else unsure++;
        bad.push('[' + k + '] ' + c.n + ': ' + t);
        const key = (k === 'unsure' ? '[bizonytalan] ' : '') + t.toLowerCase().replace(/\d+/g, 'N').replace(/[.,]/g, '').split(/\s+/).slice(0, 3).join(' ');
        pat[key] = (pat[key] || 0) + 1; ex[key] = ex[key] || c.n + ': ' + t;
      }
    }
  }
  const top = Object.entries(pat).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, n]) => ({ k, n, ex: ex[k] }));
  return { tot, other, unsure, hidden, open, costs, known: tot - other - unsure, top, bad, hid, opn };
}
