import { useEffect, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { vsCard } from '../legacy/core';
import type { Glow, PBoard, PlayCtl, PTarget, PUnit } from '../components/Playmat';

/**
 * Kattintással végrehajtott szituáció lépés ("act").
 * expect.kind:
 *   move:    unit (vagy units) kijelölése, majd célzóna (to: 'base' | 'bf0' | 'bf1' ...)
 *   exhaust: rune (domain, count) vagy legend exhaustolása
 *   play:    lap kijátszása kézből vagy facedownból (from: 'fd0'), target vagy célzóna választása, majd fizetés rune-okkal
 *   hide:    Hidden lap elrejtése egy facedown helyre (to: 'fd0'), majd fizetés
 *   pass, end: gomb a sávban
 * wrong: célzott hibaüzenetek kulcs szerint: 'unit:<név>', 'to:<loc>', 'card:<név>', 'target:<név>', 'energy', 'power:<domain>', 'pass', 'end', 'rune', 'legend', 'opp'.
 */
export type Expect =
  | { kind: 'move'; unit?: string; units?: string[]; to: string }
  | { kind: 'exhaust'; what: 'rune' | 'legend'; domain?: string; count?: number }
  | { kind: 'play' | 'hide'; card: string; from?: string; to?: string; target?: string; pay?: { e?: number; p?: Record<string, number> }; pool?: number; payNote?: string }
  | { kind: 'pass' } | { kind: 'end' };
export type ActStep = { type?: 'act'; say?: string; board?: PBoard; prompt?: string; expect?: Expect; ok?: string; wrong?: Record<string, string>; after?: PBoard; state?: 'showdown' | 'closed' };

export type Runes = { ready: number; exhausted: number; domains?: string[] };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const doms = (r: Runes) => { const d = [...(r.domains || [])]; while (d.length < r.ready + r.exhausted) d.push('?'); return d; };

/** Egy ready rune exhaustolása az adott domainből (a ready rész végéről az exhausted rész elejére kerül). */
export function exhaustRune(r: Runes, d: string): Runes | null {
  const ds = doms(r); const idx = ds.slice(0, r.ready).lastIndexOf(d);
  if (idx < 0) return null;
  ds.splice(idx, 1); ds.splice(r.ready - 1, 0, d);
  return { ready: r.ready - 1, exhausted: r.exhausted + 1, domains: ds };
}
/** Recycle: előbb egy exhausted, ha nincs, egy ready rune kerül le a boardról a Rune Deck aljára. */
export function recycleRune(r: Runes, d: string): Runes | null {
  const ds = doms(r);
  let idx = ds.indexOf(d, r.ready);
  if (idx >= 0) { ds.splice(idx, 1); return { ready: r.ready, exhausted: r.exhausted - 1, domains: ds }; }
  idx = ds.slice(0, r.ready).lastIndexOf(d);
  if (idx < 0) return null;
  ds.splice(idx, 1); return { ready: r.ready - 1, exhausted: r.exhausted, domains: ds };
}
const readyOf = (r: Runes | undefined, d: string) => (r ? doms(r).slice(0, r.ready).filter((x) => x === d).length : 0);

/** Saját unitok helye a pályán. */
function findUnit(b: PBoard, n: string): { loc: string; u: PUnit } | null {
  const u = (b.me.base || []).find((x) => x.n === n); if (u) return { loc: 'base', u };
  for (let i = 0; i < b.bfs.length; i++) { const v = (b.bfs[i].me || []).find((x) => x.n === n); if (v) return { loc: 'bf' + i, u: v }; }
  return null;
}
export function moveUnits(b0: PBoard, names: string[], to: string): PBoard {
  const b = clone(b0);
  for (const n of names) {
    const f = findUnit(b, n); if (!f) continue;
    if (f.loc === 'base') b.me.base = (b.me.base || []).filter((x) => x !== f.u); else { const bf = b.bfs[+f.loc.slice(2)]; bf.me = (bf.me || []).filter((x) => x !== f.u); }
    const u = { ...f.u, ex: true, status: ['new'] };
    if (to === 'base') (b.me.base ||= []).push(u); else (b.bfs[+to.slice(2)].me ||= []).push(u);
  }
  return b;
}
/** A lépés várt eredménye, ha az adat nem ad külön "after" állást. */
export function autoAfter(pre: PBoard, st: ActStep): PBoard {
  if (st.after) return st.after;
  const e = st.expect; if (!e) return pre;
  if (e.kind === 'move') return moveUnits(pre, e.units || (e.unit ? [e.unit] : []), e.to);
  if (e.kind === 'exhaust') {
    const b = clone(pre);
    if (e.what === 'legend') { b.me.legendEx = true; return b; }
    let r: Runes | null = b.me.runes || null;
    for (let k = 0; k < (e.count || 1) && r; k++) { const d = e.domain || doms(r).slice(0, r.ready).slice(-1)[0]; r = exhaustRune(r, d) || r; }
    if (r) b.me.runes = r; return b;
  }
  return pre;
}

const locName = (b: PBoard, loc: string) => loc === 'base' ? 'a saját base-ed' : loc === 'obase' ? 'az ellenfél base-e' : /^bf\d/.test(loc) ? b.bfs[+loc.slice(2)]?.name || loc : /^fd\d/.test(loc) ? b.bfs[+loc.slice(2)]?.name + ' facedown helye' : loc;
const kw = (n: string) => { const t: string = (vsCard(n) as any)?.txt || ''; return { reaction: /\[Reaction\]/.test(t), action: /\[Action\]/.test(t) || /\[Reaction\]/.test(t) }; };
const costOf = (n: string, e: Expect): { e: number; p: Record<string, number> } => {
  if ((e.kind === 'play' || e.kind === 'hide') && e.pay) return { e: e.pay.e || 0, p: e.pay.p || {} };
  if (e.kind === 'hide') return { e: 0, p: { '*': 1 } };
  if (e.kind === 'play' && e.from?.startsWith('fd')) return { e: 0, p: {} };
  const c: any = vsCard(n); return { e: +c?.e || 0, p: +c?.p ? { [(c.d || ['*'])[0]]: +c.p } : {} };
};

type Phase = 'none' | 'target' | 'dest' | 'pay';
type St = { key: string; live: PBoard; sel: string[]; phase: Phase; card?: string; paidE: number; paidP: Record<string, number>; exN: number; msg?: string; nonce: number };

export function useAct({ st, pre, k, done, onDone, onNext, nextLabel, render }: { st: ActStep; pre: PBoard; k: string; done: boolean; onDone: (r?: Runes) => void; onNext: () => void; nextLabel: ReactNode; render: (t: string) => ReactNode }) {
  const init = (): St => ({ key: k, live: clone(pre), sel: [], phase: 'none', paidE: 0, paidP: {}, exN: 0, nonce: 0 });
  const [S0, setS0] = useState<St>(init);
  const S = S0.key === k ? S0 : init();
  const set = (p: Partial<St>) => setS0({ ...S, ...p });
  const e = st.expect;
  const active = st.type === 'act' && !!e && !done;
  const W = (key: string, fb: string) => st.wrong?.[key] ?? fb;
  const bad = (m: string, p: Partial<St> = {}) => set({ ...p, msg: m, nonce: S.nonce + 1 });
  const showdown = st.state === 'showdown', closed = st.state === 'closed';
  const L = S.live;
  const cost = e && (e.kind === 'play' || e.kind === 'hide') ? costOf(e.card, e) : { e: 0, p: {} as Record<string, number> };
  const pool = e && (e.kind === 'play' || e.kind === 'hide') ? e.pool || 0 : 0;
  const needP = Object.values(cost.p).reduce((a, x) => a + x, 0);
  const haveP = Object.values(S.paidP).reduce((a, x) => a + x, 0);

  useEffect(() => {
    if (!active) return;
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && (S.sel.length || S.phase !== 'none')) cancel(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  });
  useEffect(() => { if (active && (S.sel.length || S.phase !== 'none')) window.dispatchEvent(new Event('rb:hide-tip')); });

  const cancel = () => set({ live: clone(pre), sel: [], phase: 'none', card: undefined, paidE: 0, paidP: {}, msg: undefined });
  const success = (r?: Runes) => { setS0({ ...init(), msg: undefined }); onDone(r); };
  const prompt = st.prompt || '';

  /** Standard Move célpontjai a kijelölt unitokhoz (144.4.a, 144.4.b, 144.3.a: közös cél). */
  const moveDest = (names: string[]) => {
    const all = ['base', ...L.bfs.map((_, i) => 'bf' + i)];
    return all.filter((z) => names.every((n) => { const f = findUnit(L, n); if (!f) return false; return f.loc === 'base' ? z !== 'base' : z === 'base'; }));
  };
  const playDest = () => {
    if (!e || (e.kind !== 'play' && e.kind !== 'hide')) return [];
    if (e.kind === 'hide') return L.bfs.map((f, i) => (f.ctrl === 'me' && !f.facedown ? 'fd' + i : '')).filter(Boolean);
    if (e.from?.startsWith('fd')) return ['bf' + e.from.slice(2)];
    return ['base', ...L.bfs.map((f, i) => (f.ctrl === 'me' ? 'bf' + i : '')).filter(Boolean)];
  };
  const afterChoice = (p: Partial<St>) => {
    // célpont vagy hely kiválasztva: jön a fizetés, ha van költség
    if (cost.e - pool <= 0 && needP === 0) { success(L.me.runes); return; }
    set({ ...p, phase: 'pay', msg: undefined });
  };
  const startCard = (n: string) => {
    if (!e || (e.kind !== 'play' && e.kind !== 'hide')) return;
    const p: Partial<St> = { card: n, msg: undefined };
    if (e.target) set({ ...p, phase: 'target' });
    else if (e.kind === 'hide' || (e.to && (vsCard(n) as any)?.t === 'Unit')) set({ ...p, phase: 'dest' });
    else afterChoice(p);
  };
  /** Szabály szerinti akadály egy lap kijátszásánál (állapot és költség). */
  const playBlock = (n: string, fromFd = false): string | null => {
    const c: any = vsCard(n); const k2 = kw(n);
    const r = fromFd || k2.reaction;
    if (closed && !r) return n + ': amíg a chainen van valami, Closed State van, ilyenkor csak [Reaction] lap játszható ki {{309.1.a}}.';
    if (showdown && !(k2.action || fromFd)) return n + ': kulcsszó nélküli lap showdownban nem játszható ki, csak [Action] vagy [Reaction] {{343.1.a}} {{308.1.a}}.';
    if (c && !fromFd) {
      const ready = L.me.runes?.ready || 0; const need = +c.e || 0;
      if (need > ready + pool) return n + ': ' + need + ' Energy kell, de csak ' + (ready + pool) + ' áll rendelkezésre. Egy ready rune exhaustolva 1 Energyt ad {{164.2.a}}.';
    }
    return null;
  };

  const on = (t0: PTarget) => {
    if (!active || !e) return;
    // mozgatás vagy unit kijátszás közben a facedown hely is a battlefieldet jelenti
    const t: PTarget = t0.k === 'fd' && (S.sel.length > 0 || (S.phase === 'dest' && e.kind !== 'hide')) ? { k: 'zone', loc: 'bf' + t0.bfi } : t0;
    // ---- fizetés közben csak rune kattintás számít
    if (S.phase === 'pay') {
      if (t.k === 'rune' && t.side === 'me') {
        if (S.paidE + pool >= cost.e) return bad(W('energy', 'Az Energy költség már ki van fizetve.' + (needP > haveP ? ' A Powerhez recycle-ölj egy rune-t a sáv gombjával {{164.2.b}}.' : '')));
        const r = L.me.runes ? exhaustRune(L.me.runes, t.d) : null;
        if (!r) return bad('Nincs ready ' + t.d + ' rune-od: exhausted rune nem ad újra Energyt {{164.2.a}}.');
        const live = clone(L); live.me.runes = r;
        const pe = S.paidE + 1;
        if (pe + pool >= cost.e && haveP >= needP) return success(r);
        return set({ live, paidE: pe, msg: undefined });
      }
      return bad('Előbb fizesd ki a(z) ' + S.card + ' költségét: kattints egy ready rune kupacra (Energy), a Powerhez használd a Recycle gombot. Mégse: Esc.');
    }
    // ---- célpont választás
    if (S.phase === 'target' && e.kind === 'play') {
      if (t.k === 'unit' || t.k === 'chain') {
        const nm = t.k === 'unit' ? t.n : t.t;
        if (e.target && (nm === e.target || nm.startsWith(e.target))) return afterChoice({ msg: undefined });
        return bad(W('target:' + (t.k === 'unit' ? t.n : t.t.replace(/\s*\(.*\)$/, '')), nm + ' most nem jó target.'));
      }
      return bad('Válassz targetet a(z) ' + S.card + ' számára: kattints a célpontra. Mégse: Esc.');
    }
    // ---- célzóna választás (unit kijátszása, elrejtés)
    if (S.phase === 'dest' && (e.kind === 'play' || e.kind === 'hide')) {
      const loc = t.k === 'zone' ? t.loc : t.k === 'fd' ? 'fd' + t.bfi : '';
      if (!loc) return bad('Válaszd ki, hova kerüljön a(z) ' + S.card + ': kattints egy kiemelt helyre. Mégse: Esc.');
      if (loc === e.to) return afterChoice({ msg: undefined });
      if (e.kind === 'hide') {
        const f = L.bfs[+loc.slice(2)];
        if (/^fd/.test(loc) && f && f.ctrl !== 'me') return bad(W('to:' + loc, 'Csak olyan battlefieldre rejthetsz, amit te kontrollálsz {{811.1.b}} {{107.3.c}}.'));
        if (/^fd/.test(loc) && f?.facedown) return bad(W('to:' + loc, 'Ott már van facedown lap: egy battlefieldnél legfeljebb egy lehet {{811.1.b}}.'));
      }
      if (e.kind === 'play' && e.from?.startsWith('fd')) return bad(W('to:' + loc, 'Elrejtett permanentet arra a battlefieldre kell kijátszani, ahol rejtve volt {{811.1.d.1}}.'));
      if (/^bf/.test(loc) && L.bfs[+loc.slice(2)]?.ctrl !== 'me') return bad(W('to:' + loc, 'Unitot a saját base-edbe vagy általad kontrollált battlefieldre játszhatsz ki {{355.2.a}}.'));
      return bad(W('to:' + loc, 'Szabályos hely, de ebben a feladatban ' + locName(L, e.to || '') + ' a cél.'));
    }
    // ---- unit kijelölés és mozgatás
    if (S.sel.length && t.k === 'zone') {
      if (e.kind !== 'move') return;
      const dests = moveDest(S.sel);
      if (t.loc === 'obase') return bad(W('to:obase', 'Standard Move-val csak a saját base-edbe léphetsz vissza {{144.4.b}}.'));
      if (!dests.includes(t.loc)) {
        const from = findUnit(L, S.sel[0])?.loc;
        if (from === t.loc) return bad('A unit már itt áll.');
        if (from?.startsWith('bf') && t.loc.startsWith('bf')) return bad(W('to:' + t.loc, 'Battlefieldről battlefieldre Standard Move-val csak Ganking képességgel lehet lépni {{144.4.c.1}}.'));
        return bad(W('to:' + t.loc, 'Ide most nem léphet {{144.4}}.'));
      }
      const need = e.units || (e.unit ? [e.unit] : []);
      if (t.loc !== e.to) return bad(W('to:' + t.loc, 'Szabályos lépés lenne {{144.4}}, de ebben a feladatban ' + locName(L, e.to) + ' a cél.'));
      if (need.some((n) => !S.sel.includes(n))) return bad(W('need', 'Mindkét unitot jelöld ki, egyetlen Standard Move-val együtt léphetnek {{144.3}}: ' + need.join(', ') + '.'));
      return success();
    }
    if (t.k === 'zone') {
      if (e.kind === 'move') return bad('Előbb jelölj ki egy saját, ready unitot, utána kattints a célzónára.');
      return bad(W('zone', 'Ebben a lépésben nem mozgatsz. ' + prompt));
    }
    if (t.k === 'unit') {
      if (t.side === 'opp') return bad(W('opp', t.n + ' az ellenfél unitja: csak a saját unitjaidat mozgathatod.'));
      if (showdown || closed) return bad(W('unit:' + t.n, 'Standard Move nem végezhető ' + (closed ? 'Closed Stateben {{144.1.b}}' : 'showdown vagy combat alatt {{144.1.c}}') + '.'));
      if (t.ex) return bad(W('unit:' + t.n, t.n + ' exhausted. A Standard Move költsége a unit exhaustolása, ezért exhausted unit így nem mozoghat {{144.2}}.'));
      if (e.kind !== 'move') return bad(W('unit:' + t.n, 'Ebben a lépésben nem mozgatsz unitot. ' + prompt));
      const need = e.units || (e.unit ? [e.unit] : []);
      if (S.sel.includes(t.n)) return set({ sel: S.sel.filter((x) => x !== t.n), msg: undefined });
      if (!need.includes(t.n)) return bad(W('unit:' + t.n, t.n + ' mozgatása szabályos lenne, de most nem ez a feladat. ' + prompt));
      return set({ sel: [...S.sel, t.n], msg: undefined });
    }
    if (t.k === 'hand' && t.side === 'me') {
      if ((e.kind === 'play' || e.kind === 'hide') && !e.from && t.n === e.card) {
        const blk = e.kind === 'play' ? playBlock(t.n) : null;
        if (blk) return bad(blk);
        return startCard(t.n);
      }
      if (st.wrong?.['card:' + t.n]) return bad(st.wrong['card:' + t.n]);
      const blk = playBlock(t.n); if (blk) return bad(blk);
      return bad(e.kind === 'play' || e.kind === 'hide' ? 'Most nem a(z) ' + t.n + ' a feladat. ' + prompt : 'Ebben a lépésben nem játszol ki lapot. ' + prompt);
    }
    if (t.k === 'fd') {
      if ((e.kind === 'play') && e.from === 'fd' + t.bfi) return startCard(e.card);
      if (L.bfs[t.bfi]?.facedown === 'me') return bad(W('fd', 'A facedown lapot most nem kell kijátszani. ' + prompt));
      return bad(W('fd', 'Itt nincs saját facedown lapod.'));
    }
    if (t.k === 'rune' && t.side === 'me') {
      if (e.kind === 'exhaust' && e.what === 'rune') {
        if (e.domain && t.d !== e.domain) return bad(W('rune:' + t.d, 'Most ' + e.domain + ' rune-t kell exhaustolnod.'));
        const r = L.me.runes ? exhaustRune(L.me.runes, t.d) : null;
        if (!r) return bad('Nincs ready ' + t.d + ' rune-od.');
        const n = S.exN + 1; const live = clone(L); live.me.runes = r;
        if (n >= (e.count || 1)) return success(r);
        return set({ live, exN: n, msg: undefined });
      }
      return bad(W('rune', 'Most nem kell rune-t exhaustolni: a rune-ok a lap kijátszásakor, a fizetésnél kellenek. ' + prompt));
    }
    if (t.k === 'legend' && t.side === 'me') {
      if (e.kind === 'exhaust' && e.what === 'legend') {
        if (L.me.legendEx) return bad('A legend már exhausted.');
        return success();
      }
      return bad(W('legend', 'A legendet most nem kell használnod. ' + prompt));
    }
    if (t.k === 'champion' && t.side === 'me') return bad(W('champion', 'A Chosen Championt most nem kell kijátszanod. ' + prompt));
    if (t.k === 'chain') return bad(W('chain', 'Ebben a lépésben nem kell a chainre célozni. ' + prompt));
    return bad(W('opp', 'Ez az ellenfél lapja. ' + prompt));
  };

  const recycle = (d: string) => {
    if (S.phase !== 'pay' || !e) return;
    const keys = Object.keys(cost.p);
    if (haveP >= needP) return bad(W('power', needP ? 'A Power költség már ki van fizetve, a recycle-ölt rune feleslegesen hagyná el a boardot {{161.2.b}}.' : 'Ez a lap nem kér Powert, a recycle-ölt rune feleslegesen hagyná el a boardot {{161.2.b}}.'));
    const want = keys.find((x) => x === d || x === '*');
    if (!want) return bad(W('power:' + d, d + ' rune ' + d + ' Powert ad {{164.2.b.1}}, a lap ' + keys.join(' vagy ') + ' Powert kér {{163.2.a}}.'));
    const r = L.me.runes ? recycleRune(L.me.runes, d) : null;
    if (!r) return bad('Nincs ' + d + ' rune-od.');
    const live = clone(L); live.me.runes = r;
    const pp = { ...S.paidP, [want]: (S.paidP[want] || 0) + 1 };
    const hp = haveP + 1;
    if (S.paidE + pool >= cost.e && hp >= needP) return success(r);
    set({ live, paidP: pp, msg: undefined });
  };
  /** Automatikus fizetés: Energyért a Powerhez nem kellő domainű ready rune-ok, Powerért előbb exhausted rune recycle. */
  const autoPay = () => {
    if (S.phase !== 'pay' || !L.me.runes) return;
    let r: Runes = L.me.runes; let pe = S.paidE; const pp = { ...S.paidP };
    const keys = Object.keys(cost.p);
    while (pe + pool < cost.e) {
      const ds = doms(r).slice(0, r.ready);
      const d = ds.slice().reverse().find((x) => !keys.includes(x)) || ds[ds.length - 1];
      const nr = d ? exhaustRune(r, d) : null; if (!nr) break; r = nr; pe++;
    }
    for (const kd of keys) {
      while ((pp[kd] || 0) < cost.p[kd]) {
        const ds = doms(r);
        const d = kd === '*' ? (ds[r.ready] || ds[0]) : kd;
        const nr = d ? recycleRune(r, d) : null; if (!nr) break; r = nr; pp[kd] = (pp[kd] || 0) + 1;
      }
    }
    const hp = Object.values(pp).reduce((a, x) => a + x, 0);
    if (pe + pool >= cost.e && hp >= needP) return success(r);
    const live = clone(L); live.me.runes = r;
    bad('Nincs elég rune a teljes költségre.', { live, paidE: pe, paidP: pp });
  };
  const pressBtn = (kind: 'pass' | 'end') => {
    if (!active || !e) return;
    if (e.kind === kind) return success();
    bad(W(kind, (kind === 'pass' ? 'Most nem passzolni kell. ' : 'Most még nem kell befejezni a kört. ') + prompt));
  };

  const glow = (t: PTarget): Glow => {
    if (!active || !e) return '';
    const P = S.phase;
    if (t.k === 'unit') {
      if (t.side === 'me' && S.sel.includes(t.n)) return 'sel';
      if (P === 'target') return 'act';
      if (P !== 'none') return '';
      return t.side === 'me' && !t.ex && !showdown && !closed ? 'act' : '';
    }
    if (t.k === 'zone') {
      if (S.sel.length) return moveDest(S.sel).includes(t.loc) ? 'dest' : '';
      if (P === 'dest') return playDest().includes(t.loc) ? 'dest' : '';
      return '';
    }
    if (t.k === 'fd') {
      if (P === 'dest') return playDest().includes('fd' + t.bfi) ? 'dest' : '';
      if (S.card && e.kind === 'play' && e.from === 'fd' + t.bfi) return 'sel';
      return P === 'none' && L.bfs[t.bfi]?.facedown === 'me' ? 'act' : '';
    }
    if (t.k === 'rune') return t.side === 'me' && (P === 'none' || P === 'pay') && !S.sel.length && readyOf(L.me.runes, t.d) > 0 && !(P === 'pay' && S.paidE + pool >= cost.e) ? 'act' : '';
    if (t.k === 'hand') { if (t.side !== 'me') return ''; if (S.card === t.n && !(e.kind === 'play' && e.from)) return 'sel'; return P === 'none' && !S.sel.length && !playBlock(t.n) ? 'act' : ''; }
    if (t.k === 'legend') return t.side === 'me' && P === 'none' && !S.sel.length && !L.me.legendEx ? 'act' : '';
    if (t.k === 'champion') return '';
    if (t.k === 'chain') return P === 'target' ? 'act' : '';
    return '';
  };
  const label = (t: PTarget) => {
    const g = glow(t);
    const st2 = g === 'sel' ? ', kijelölve' : g === 'dest' ? ', legális cél' : '';
    if (t.k === 'zone') return 'Cél: ' + locName(L, t.loc) + st2;
    if (t.k === 'unit') return t.n + (t.side === 'me' ? ', saját unit' : ', ellenfél unit') + ', ' + locName(L, t.loc) + (t.ex ? ', exhausted' : ', ready') + st2;
    if (t.k === 'rune') return t.d + ' rune-ok, ' + readyOf(L.me.runes, t.d) + ' ready' + st2;
    if (t.k === 'hand') return t.n + ', kézben' + st2;
    if (t.k === 'fd') return locName(L, 'fd' + t.bfi) + st2;
    if (t.k === 'chain') return 'Chain elem: ' + t.t + st2;
    return t.k === 'legend' ? 'Legend' + (L.me.legendEx ? ', exhausted' : ', ready') : 'Champion';
  };

  const ctl: PlayCtl | null = active ? { on, glow, label } : null;
  const domsHave = Array.from(new Set(doms(L.me.runes || { ready: 0, exhausted: 0 })));
  const DOMC: Record<string, string> = { Fury: '#ff5a4e', Calm: '#4fcf8a', Mind: '#5fa1ff', Body: '#f59a45', Chaos: '#b07ef2', Order: '#e9cb4d' };

  let status: ReactNode = null;
  if (active && e) {
    if (S.sel.length) status = <span>Kijelölve: <b>{S.sel.join(', ')}</b>. Kattints egy kiemelt célzónára{e.kind === 'move' && (e.units?.length || 0) > S.sel.length ? ', vagy jelölj ki még egy unitot' : ''}.</span>;
    else if (S.phase === 'target') status = <span><b>{S.card}</b>: válassz targetet.</span>;
    else if (S.phase === 'dest') status = <span><b>{S.card}</b>: hova kerüljön? Kattints egy kiemelt helyre.</span>;
    else if (S.phase === 'pay') status = (
      <div className="scn-pay" aria-live="polite">
        <span><b>{S.card}</b> fizetése:</span>
        {cost.e > 0 && <span className={'m' + (S.paidE + pool >= cost.e ? ' full' : '')}>Energy {Math.min(S.paidE + pool, cost.e)} / {cost.e}{pool ? ' (poolból ' + pool + ')' : ''}</span>}
        {S.paidE + pool < cost.e && <span className="scn-note">Energyért kattints egy ready rune kupacra.</span>}
        {Object.entries(cost.p).map(([d, n]) => <span key={d} className={'m' + ((S.paidP[d] || 0) >= n ? ' full' : '')}>{d === '*' ? 'Power' : d + ' Power'} {S.paidP[d] || 0} / {n}</span>)}
        {needP > 0 && domsHave.map((d) => <button key={d} type="button" className="rc" style={{ ['--dc' as any]: DOMC[d] || '#888' }} onClick={() => recycle(d)}>Recycle {d}</button>)}
        {(e.kind === 'play' || e.kind === 'hide') && e.payNote && <span className="scn-note">{e.payNote}</span>}
      </div>
    );
    else if (e.kind === 'exhaust' && S.exN) status = <span>Exhaustolva: {S.exN} / {e.count || 1}</span>;
  }
  const busy = S.sel.length > 0 || S.phase !== 'none';
  const bar = st.type === 'act' ? (
    <div className={'scn-actbar' + (done ? ' ok' : '')}>
      <div className="scn-ab-row">
        <div className="scn-ab-txt">
          {done ? <><b className="k">Helyes</b><span className="scn-d">A magyarázat a jobb oldali panelen olvasható.</span></>
            : <><b className="k">Feladat</b><span className="scn-d">Kattints egy sárgán kiemelt lapra. A teendő a jobb oldali panelen.</span><span className="scn-m">{render(prompt)}</span></>}
        </div>
        <div className="scn-ab-btns">
          {active && S.phase === 'pay' && <button type="button" className="btn sec" onClick={autoPay}>Automatikus fizetés</button>}
          {active && busy && <button type="button" className="btn sec" onClick={cancel}>Mégse</button>}
          {active && !busy && <button type="button" className="btn sec" onClick={() => pressBtn('pass')}>Passz</button>}
          {active && !busy && (e?.kind === 'end' || st.wrong?.end) && <button type="button" className="btn sec" onClick={() => pressBtn('end')}>Kör vége</button>}
          {done && <button type="button" className="btn hex scn-next" onClick={onNext}>{nextLabel}</button>}
        </div>
      </div>
      {status && <div className="scn-ab-row">{status}</div>}
      {active && S.msg && <div key={S.nonce} className="scn-msg bad" role="alert"><X size={16} aria-hidden />{render(S.msg)}</div>}
      {done && <div className="scn-msg ok scn-okx"><Check size={16} aria-hidden />{render(st.ok || '')}</div>}
    </div>
  ) : null;
  return { board: active ? L : null, ctl, bar };
}
