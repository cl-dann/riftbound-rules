/* A pályás Chain építő segédei (React nélkül): kiinduló pálya, a lejátszási frame kiegészítése az építő zónáival,
   és a legalitás az elemző (analyze) alapján. Az állapot mindig a builder CS-e; ez a modul csak olvassa vagy másolatot elemez. */
import { analyze, stepInfo, abilitiesOf, triggersOf, timingOf, isPermC } from '../legacy/chainCore';
import { vsCard, CARDS, norm } from '../legacy/core';
import { tgOptionsOf } from '../legacy/chain';
import type { PBoard } from './Playmat';

export type Arrow = { from: number; to: string };
export type MtInstr = { t: string; st: 'executed' | 'partial' | 'ignored' | 'negated' | 'skipped'; ref: string; why: string; man?: boolean };
export type MtInfo = { item: string; kind: 'full' | 'partial' | 'none'; targets: { n: string; ok: boolean; skip?: boolean; why?: string }[]; instr: MtInstr[] };
export type ChainFrame = { label: string; board: PBoard; changes: [string, string, number?][]; arrows: Arrow[]; bfi?: number[]; mt?: MtInfo | null; sj?: number };

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export const sideOf = (p: string) => (p === 'B' ? 'opp' : 'me') as 'me' | 'opp';
export const plOf = (side: 'me' | 'opp') => (side === 'opp' ? 'B' : 'A');
export const cardOf = (n?: string | null): any => (n ? vsCard(n) : null);

/** A kiinduló helyzet pontosan úgy, ahogy az elemző rajzolja: egy üres Resolve lépéssel futtatva az első frame (340.1: üres chainen nincs mit lefuttatni). */
export function setupFrame(CS: any): ChainFrame {
  const c = clone(CS); c.steps = [{ k: 'res' }];
  return analyze(c).frames[0] as ChainFrame;
}

/** Melyik frame-ben került a j. lépés a chainre (a frame sj mezője). */
export function stepFrames(frames: ChainFrame[]): Record<number, number> {
  const m: Record<number, number> = {};
  frames.forEach((f, i) => { if (f.sj != null && m[f.sj] == null) m[f.sj] = i; });
  return m;
}

/** Az építő pályája: mindkét battlefield hely látszik (üresen is), a champion, a kéz és a facedown lap a CS építő mezőiből,
    a k. frame-ig kijátszott lapok nélkül. A nyilak battlefield indexe a teljes (két helyes) listára igazodik. */
export function fullFrame(f: ChainFrame, CS: any, k: number, sf: Record<number, number>): ChainFrame {
  const played = (pred: (s: any) => boolean) => CS.steps.filter((s: any, j: number) => s.k === 'card' && pred(s) && sf[j] != null && sf[j] <= k);
  const bfi = f.bfi || [];
  const bfs = [0, 1].map((i) => {
    const pos = bfi.indexOf(i);
    const b: any = pos >= 0 ? { ...f.board.bfs[pos] } : { name: '', ctrl: CS.bf[i].c === 'A' ? 'me' : CS.bf[i].c === 'B' ? 'opp' : null, me: [], opp: [] };
    if (!CS.bf[i].n) b.name = '';
    const fd = CS.bf[i].fd; const fdn = CS.bf[i].fdn || null;
    const gone = fdn && played((s) => s.from === 'facedown' && (s.loc || 'bf0') === 'bf' + i && s.n === fdn).length > 0;
    b.facedown = fd && !gone ? sideOf(fd) : null; b.fdn = fd && !gone ? fdn : null;
    return b;
  });
  const arrows = f.arrows.map((a) => (a.to.startsWith('bf:') ? { ...a, to: 'bf:' + (bfi[+a.to.slice(3)] ?? 0) } : a));
  const side = (p: 'A' | 'B') => {
    const s: any = { ...f.board[sideOf(p)] };
    const ch = (CS.ch || {})[p] || '';
    s.champion = ch && !played((x) => x.from === 'champ' && x.n === ch && x.pl === p).length ? ch : null;
    const left = [...((CS.hand || {})[p] || [])];
    played((x) => (x.from || 'hand') === 'hand' && x.pl === p).forEach((x: any) => { const i = left.indexOf(x.n); if (i >= 0) left.splice(i, 1); });
    s.handCS = left.length;
    s.hand = [...left, ...(s.hand || [])];
    return s;
  };
  return { ...f, board: { ...f.board, me: side('A'), opp: side('B'), bfs }, arrows, bfi: [0, 1] };
}

export type Legal = { ok: boolean; why?: string; ref?: string; need?: string };
const BAD = /^Nem szabályos:/;
const reasonOf = (t: string) => t.replace(/^Nem szabályos:\s*/, '').replace(/^[^?]*\?\s*/, '').replace(/\.\s*Kimarad\.?$/, '');
/** A sorok különbsége (multihalmaz): ami a b-ben új az a-hoz képest. */
function newRows(a: [string, string][], b: [string, string][]) {
  const cnt = new Map<string, number>();
  a.forEach((r) => { const k = r.join('|'); cnt.set(k, (cnt.get(k) || 0) + 1); });
  return b.filter((r) => { const k = r.join('|'); const n = cnt.get(k) || 0; if (n) { cnt.set(k, n - 1); return false; } return true; });
}

/** Egy új lépés a chain végére: az elemző dönti el, szabályos-e (sebesség, Closed State, költség, forrás állapota).
    A hiányzó célpont vagy költség-választás nem tiltás: azt a következő lépésben a pályán választja ki a felhasználó. */
export function tryStep(CS: any, step: any): Legal {
  const a = analyze(clone(CS)); const c = clone(CS); c.steps.push(clone(step));
  const r = analyze(c);
  const bad = newRows(a.rows, r.rows).find((x) => BAD.test(x[1]));
  if (!bad) return { ok: true };
  const why = reasonOf(bad[1]);
  if (/nincs megadva/.test(why)) return { ok: true, need: why };
  return { ok: false, why, ref: bad[0] };
}

export type TgOpt = { v: string; label: string; ok: boolean; why?: string; ref?: string };
/** A j. lépés ti. célpontjának választható értékei, mindegyikre lefuttatva az elemzést: legális-e, és ha nem, miért (355.8). */
export function targetOpts(CS: any, j: number, ti: number): TgOpt[] {
  const s = CS.steps[j]; if (!s) return [];
  const inf: any = stepInfo(CS, s); const p = inf?.list?.[ti]; if (!p) return [];
  const base = clone(CS); base.steps[j].tg = [...(base.steps[j].tg || [])]; base.steps[j].tg[ti] = '';
  const r0 = analyze(clone(base)).rows;
  return tgOptionsOf(CS, j, p).slice(1).filter((o: any) => o[0] !== 'x').map((o: any) => {
    const c = clone(base); c.steps[j].tg[ti] = o[0];
    const nr = newRows(r0, analyze(c).rows);
    const bad = nr.find((x) => (BAD.test(x[1]) && !/nincs megadva/.test(x[1])) || /^A trigger \d+\. célpontja \(/.test(x[1]) || /^A play effectnek nincs legális választása/.test(x[1]));
    let why = bad ? reasonOf(bad[1]) : undefined;
    if (bad && /^A trigger/.test(bad[1])) why = bad[1].replace(/^A trigger \d+\. célpontja \([^)]*\) nem legális:\s*/, '').replace(/;.*$/, '');
    if (bad && /^A play effectnek/.test(bad[1])) why = bad[1].replace(/^[^(]*\(/, '').replace(/\)\..*$/, '');
    return { v: o[0], label: o[1], ok: !bad, why, ref: bad ? bad[0] : undefined };
  });
}

/** A célpont-paraméter rövid leírása (a builder célpont-választójának szövegéből). */
export function slotText(p: any, ti: number) {
  return (ti + 1) + '. célpont' + (p.opt ? ' (nem kötelező)' : '') + ': ' + (p.rel !== 'any' ? p.rel + ' ' : '') + (p.equipOnly ? 'Equipment' : p.type) + (p.bf ? ', battlefielden' : '') + (p.here ? ', "here"' : '') + (p.free ? ', másik locationön' : '') + (p.max != null ? ', max ' + p.max + ' Might' : '') + (p.mighty ? ', Mighty' : '');
}

/** A lépés rövid neve az idővonalon. */
export function stepName(CS: any, s: any): { n: string; img?: string; kind: string } {
  if (s.k === 'res') return { n: 'Resolve', kind: 'a chain teteje lefut' };
  if (s.k === 'end') return { n: 'Kör vége', kind: 'Ending Phase' };
  if (s.k === 'tr') return { n: s.n || '?', img: s.n, kind: 'combat utáni trigger' };
  if (s.k === 'ab' || s.k === 'tg') {
    const inf: any = stepInfo(CS, s); const n = inf?.c?.n || s.n || '';
    const lbl = s.k === 'ab' ? (inf?.ab?.label || '') : (inf?.tr?.why || '');
    return { n: n ? n : 'nincs forrás', img: n, kind: (s.k === 'ab' ? 'ability' : 'trigger') + (lbl ? ': ' + String(lbl).slice(0, 40) : '') };
  }
  const c = cardOf(s.n);
  return { n: c ? c.n : s.n || 'üres lépés', img: c?.n, kind: s.from === 'facedown' ? 'facedown-ból' : s.from === 'champ' ? 'Champion Zone-ból' : 'kijátszás' };
}

/** Abilityk és triggerek egy forráshoz (a csatolt gear szövegével, 136.2.c). */
export function abilitiesFor(CS: any, src: string) {
  const c = src[0] === 'L' ? cardOf(CS.lg[src.slice(1)]) : src[0] === 'b' ? cardOf(CS.bd[+src.slice(1)]?.n) : src[0] === 's' ? cardOf(CS.steps[+src.slice(1)]?.n) : null;
  if (!c) return { c: null, abs: [] as any[], trs: [] as any[] };
  const extra = src[0] === 'b' ? CS.bd.filter((g: any) => g.on === +src.slice(1)).map((g: any) => cardOf(g.n)?.eff || '').join('\n') : '';
  return { c, abs: abilitiesOf(c), trs: triggersOf(c, extra) };
}

export const hasHidden = (c: any) => !!c && (timingOf(c) === 'hidden' || /^\[Hidden\]/m.test(c.txt || ''));
export const isPerm = (c: any) => isPermC(c);

/** Kártyakereső: típus szerint előszűrve, gépelve szűrhető. */
export type PickKind = 'legend' | 'champion' | 'battlefield' | 'board' | 'hand' | 'play' | 'hidden';
export const PICK_TITLE: Record<PickKind, string> = {
  legend: 'Legend', champion: 'Champion (Champion Zone)', battlefield: 'Battlefield', board: 'Unit vagy gear a pályára', hand: 'Lap a kézbe', play: 'Kijátszás a chainre', hidden: 'Hidden lap a facedown helyre',
};
const okType = (k: PickKind, c: any) => {
  const t = c.t;
  if (k === 'legend') return t === 'Legend';
  if (k === 'battlefield') return t === 'Battlefield';
  if (k === 'champion') return t === 'Unit' && (c.st || []).includes('Champion');
  if (k === 'board') return t === 'Unit' || t === 'Gear';
  if (k === 'hidden') return (t === 'Unit' || t === 'Gear' || t === 'Spell') && hasHidden(c);
  return t === 'Unit' || t === 'Gear' || t === 'Spell';
};
export function searchCards(k: PickKind, q: string, limit = 60): any[] {
  const words = norm(q || '').split(' ').filter(Boolean);
  const out: any[] = [];
  for (const c of CARDS as any[]) {
    if (!okType(k, c) || (c.st || []).includes('Token') && k !== 'board') continue;
    if (words.length) { const h = norm(c.n + ' ' + (c.tg || []).join(' ')); if (!words.every((w) => h.includes(w))) continue; }
    out.push(c); if (out.length >= limit) break;
  }
  if (words.length) { const w = norm(q); out.sort((a, b) => +!norm(a.n).startsWith(w) - +!norm(b.n).startsWith(w)); }
  return out;
}
