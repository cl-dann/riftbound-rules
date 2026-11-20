/**
 * Practice szituáció-motor (React nélkül, unit tesztelhető).
 *
 * Egy szituáció lépések sora (a learn.json "scenarios" eleme). Minden lépés megmondja, mit fogad el:
 *   panel:  fázispanel szöveggel és gombokkal (vagy kijátszható lapok listájával)
 *   free:   szabad pálya: a lapokra kattintva akció-menü nyílik; a menüpontokat és a legalitásukat a motor számolja
 *           a Core Rules szerint (Standard Move, a lap sebessége és a turn állapota, költség), a lépés "acts" táblája
 *           mondja meg, melyik szabályos akció a jó, melyik vezet rossz kimenetre (OUTCOME)
 *   target: célpont-választó modal (min, max, legális és nem legális célpontok indoklással)
 *   assign: combat damage kiosztás (lethal sorrend, Tank)
 *   auto:   az ellenfél lép, a motor továbblép
 * A lépések sorrendjét a motor őrzi: egy későbbi lépés akciója a korábbi lépésben "rossz sorrend" kimenetet ad.
 */
import { vsCard } from '../legacy/core';

export type Side = 'me' | 'opp';
export type PUnit = { n: string; m: number; ex?: boolean; dmg?: number; tags?: string[]; gear?: boolean };
export type PRune = { d: string; ex?: boolean };
export type PSide = {
  legend?: string | null; champion?: string | null; legendEx?: boolean; base: PUnit[]; runes: PRune[];
  hand?: string[]; handCount?: number; score: number; pool?: { e: number; p: Record<string, number> };
};
export type PBf = { name: string; ctrl: Side | null; me: PUnit[]; opp: PUnit[]; fd?: Side | null; fdCard?: string | null };
export type PChain = { card: string; owner: Side; note?: string };
export type PBoard = { turn: Side; me: PSide; opp: PSide; bfs: PBf[]; chain: PChain[] };

export type Op = { op: string; [k: string]: any };
/** 'next': következő lépés; 'stay': marad a lépésben; bármi más: kimenet (outcome) azonosító. */
export type Go = string;
export type TargetSpec = {
  title?: string; text: string; min?: number; max: number; opts: string[]; illegal?: Record<string, string>;
  correct: string[]; wrong?: Record<string, Go>; wrongSet?: Go; do?: Op[]; go?: Go; cancel?: boolean;
};
export type Res = { go?: Go; do?: Op[]; target?: TargetSpec; msg?: string; to?: string };
export type Btn = Res & { l: string; dis?: string; kind?: 'gold' | 'primary' | 'ghost' };
export type TState = 'open' | 'closed' | 'showdown' | 'sclosed';
export type PanelStep = {
  t: 'panel'; tag: string; title?: string; letter?: string; text: string; card?: string; clash?: number; chain?: boolean;
  btns?: Btn[]; cards?: (Res & { card: string; dis?: string })[]; pre?: Op[]; st?: TState;
};
export type FreeStep = {
  t: 'free'; st?: TState; mode?: 'awaken' | 'pay'; hint?: string; acts?: Record<string, Res>; need?: string[];
  confirm?: Res; partial?: Go; pass?: Res; sol?: string[]; bbtn?: Res & { l: string; at: string }; end?: Res; pre?: Op[];
  budget?: string[]; deadEnd?: Go; orderWhy?: string; fdReady?: boolean; toast?: string; lockMsg?: string;
};
export type TargetStep = TargetSpec & { t: 'target'; tag?: string; pre?: Op[] };
export type AssignStep = { t: 'assign'; tag?: string; text: string; bf: number; side: Side; amount: number; first?: Record<string, Go>; do?: Op[]; pre?: Op[]; go?: Go };
export type AutoStep = { t: 'auto'; toast: string; pre?: Op[]; do?: Op[] };
export type Step = PanelStep | FreeStep | TargetStep | AssignStep | AutoStep;
export type Outcome = { kind: 'good' | 'bad'; title: string; text: string; opt?: string };
export type Scn = {
  id: string; title: string; topic: string; level?: string; intro: string; brief: string; rules?: string; hint?: string;
  board: PBoard; pool?: boolean; steps: Step[]; outcomes: Record<string, Outcome>; optimal: string; fallback: Go; order?: Go; lockMsg?: string;
};

export type MenuItem = { label: string; act: string; dis?: string; tone?: 'energy' | 'power'; pay?: boolean };
export type Menu = { ref: string; title: string; speed?: string; cost?: string; items: MenuItem[] };
export type ES = {
  scn: Scn; b: PBoard; i: number; started: boolean; done: string[]; pend: string[];
  tgt?: { spec: TargetSpec; sel: string[]; act?: string; res?: Res; undo?: PBoard }; asg?: string[];
  out?: Outcome & { id: string }; msg?: string; nonce: number; last?: string[];
};

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const card = (n: string): any => vsCard(n) || {};
export const speedOf = (n: string): '' | 'Action' | 'Reaction' => {
  const t: string = card(n).txt || '';
  return /\[Reaction\]/.test(t) ? 'Reaction' : /\[Action\]/.test(t) ? 'Action' : '';
};
export const costOf = (n: string) => { const c = card(n); return { e: +c.e || 0, p: +c.p || 0, d: (c.d || []) as string[] }; };
const entersReady = (n: string) => /\bI enter ready\b/.test(card(n).txt || '');
const isHidden = (n: string) => /\[Hidden\]/.test(card(n).txt || '');

/* ---------------- pálya lekérdezések ---------------- */
export type Loc = { side: Side; zone: 'base' | 'bf' | 'hand' | 'rune' | 'legend' | 'champion' | 'chain' | 'fd'; bf?: number; idx?: number; u?: PUnit };
/** Hivatkozás feloldása: unit név, "h:<lap>" kéz, "r:<i>" saját rune, "c:<i>" chain elem, "fd:<bf>" facedown, "legend", "champion". */
export function locate(b: PBoard, ref: string): Loc | null {
  if (ref.startsWith('h:')) { const i = (b.me.hand || []).indexOf(ref.slice(2)); return i < 0 ? null : { side: 'me', zone: 'hand', idx: i }; }
  if (ref.startsWith('r:')) { const i = +ref.slice(2); return b.me.runes[i] ? { side: 'me', zone: 'rune', idx: i } : null; }
  if (ref.startsWith('c:')) { const i = +ref.slice(2); return b.chain[i] ? { side: b.chain[i].owner, zone: 'chain', idx: i } : null; }
  if (ref.startsWith('fd:')) { const i = +ref.slice(3); return b.bfs[i]?.fd ? { side: b.bfs[i].fd as Side, zone: 'fd', bf: i } : null; }
  if (ref === 'legend' || ref === 'champion') return { side: 'me', zone: ref };
  for (const side of ['me', 'opp'] as Side[]) {
    const bu = b[side].base.find((u) => u.n === ref); if (bu) return { side, zone: 'base', u: bu };
    for (let i = 0; i < b.bfs.length; i++) { const u = b.bfs[i][side].find((x) => x.n === ref); if (u) return { side, zone: 'bf', bf: i, u }; }
  }
  const ci = b.chain.findIndex((c) => c.card === ref); if (ci >= 0) return { side: b.chain[ci].owner, zone: 'chain', idx: ci };
  const hi = (b.me.hand || []).indexOf(ref); if (hi >= 0) return { side: 'me', zone: 'hand', idx: hi };
  return null;
}
export const unitOf = (b: PBoard, n: string) => locate(b, n)?.u;
/** A célpont-választó csoportfelirata. */
export function groupOf(b: PBoard, ref: string): string {
  const l = locate(b, ref); if (!l) return '';
  if (l.zone === 'base') return l.side === 'me' ? 'Saját base' : 'Ellenfél base';
  if (l.zone === 'bf') return b.bfs[l.bf!].name + (l.side === 'me' ? ', saját unitok' : ', ellenfél unitok');
  if (l.zone === 'hand') return 'Kezed';
  if (l.zone === 'chain') return 'Chain';
  return '';
}
const mightAt = (b: PBoard, bf: number, side: Side) => b.bfs[bf][side].reduce((a, u) => a + (u.gear ? 0 : u.m), 0);
export { mightAt };

/* ---------------- műveletek (ops) ---------------- */
function removeUnit(b: PBoard, n: string): PUnit | null {
  for (const side of ['me', 'opp'] as Side[]) {
    const i = b[side].base.findIndex((u) => u.n === n); if (i >= 0) return b[side].base.splice(i, 1)[0];
    for (const bf of b.bfs) { const j = bf[side].findIndex((u) => u.n === n); if (j >= 0) return bf[side].splice(j, 1)[0]; }
  }
  return null;
}
function place(b: PBoard, side: Side, u: PUnit, to: string) { if (to === 'base') b[side].base.push(u); else b.bfs[+to.slice(2)][side].push(u); }
const sideOfUnit = (b: PBoard, n: string): Side => (locate(b, n)?.side || 'me');

export function applyOps(b0: PBoard, ops: Op[] | undefined): PBoard {
  if (!ops || !ops.length) return b0;
  const b = clone(b0);
  for (const o of ops) {
    const side: Side = o.side || 'me';
    const u = o.ref ? unitOf(b, o.ref) : undefined;
    switch (o.op) {
      case 'move': { const s = sideOfUnit(b, o.ref); const x = removeUnit(b, o.ref); if (x) { if (o.ex !== false) x.ex = true; place(b, s, x, o.to); } break; }
      case 'ready': if (u) u.ex = false; break;
      case 'exhaust': if (u) u.ex = true; break;
      case 'might': if (u) u.m = o.set ?? u.m + (o.add || 0); break;
      case 'dmg': if (u) u.dmg = (u.dmg || 0) + o.n; break;
      case 'kill': removeUnit(b, o.ref); break;
      case 'heal': for (const s of ['me', 'opp'] as Side[]) { b[s].base.forEach((x) => delete x.dmg); b.bfs.forEach((f) => f[s].forEach((x) => delete x.dmg)); } break;
      case 'tag': if (u) { const t = new Set(u.tags || []); (o.add || []).forEach((x: string) => t.add(x)); (o.rm || []).forEach((x: string) => t.delete(x)); u.tags = [...t]; } break;
      case 'untagAll': for (const s of ['me', 'opp'] as Side[]) { b[s].base.forEach((x) => (x.tags = (x.tags || []).filter((t) => !(o.tags || []).includes(t)))); b.bfs.forEach((f) => f[s].forEach((x) => (x.tags = (x.tags || []).filter((t) => !(o.tags || []).includes(t))))); } break;
      case 'untagNew': for (const s of ['me', 'opp'] as Side[]) { b[s].base.forEach((x) => (x.tags = (x.tags || []).filter((t) => t !== 'new'))); b.bfs.forEach((f) => f[s].forEach((x) => (x.tags = (x.tags || []).filter((t) => t !== 'new')))); } break;
      case 'score': b[side].score += o.n ?? 1; break;
      case 'ctrl': b.bfs[o.bf].ctrl = o.to ?? null; break;
      case 'draw': if (side === 'me') (b.me.hand ||= []).push(o.card); else b.opp.handCount = (b.opp.handCount || 0) + (o.n ?? 1); break;
      case 'discard': if (side === 'me') { const i = (b.me.hand || []).indexOf(o.card); if (i >= 0) b.me.hand!.splice(i, 1); } else b.opp.handCount = Math.max(0, (b.opp.handCount || 0) - (o.n ?? 1)); break;
      case 'unit': place(b, side, { n: o.card, m: o.m ?? (+card(o.card).m || 0), ex: o.ex, tags: o.tags, gear: o.gear }, o.to || 'base'); if (side === 'opp' && o.fromHand) b.opp.handCount = Math.max(0, (b.opp.handCount || 0) - 1); break;
      case 'chain+': b.chain.push({ card: o.card, owner: side, note: o.note }); if (side === 'opp' && o.fromHand) b.opp.handCount = Math.max(0, (b.opp.handCount || 0) - 1); break;
      case 'chain-': b.chain.pop(); break;
      case 'chain0': b.chain = []; break;
      case 'channel': for (const d of o.d) b[side].runes.push({ d }); break;
      case 'runesEx': { let n = o.n ?? 99; for (const r of b[side].runes) { if (n <= 0) break; if (!r.ex && (!o.d || r.d === o.d)) { r.ex = true; n--; } } break; }
      case 'runesReady': b[side].runes.forEach((r) => (r.ex = false)); break;
      case 'recycle': { let n = o.n ?? 1; while (n-- > 0) { const i = b[side].runes.findIndex((r) => r.d === o.d && r.ex); const j = i >= 0 ? i : b[side].runes.findIndex((r) => r.d === o.d); if (j >= 0) b[side].runes.splice(j, 1); } break; }
      case 'legendEx': b[side].legendEx = o.ex !== false; break;
      case 'turn': b.turn = o.to; break;
      case 'pool': b.me.pool = { e: o.e ?? 0, p: o.p ?? {} }; break;
      case 'fd': b.bfs[o.bf].fd = o.to ?? null; b.bfs[o.bf].fdCard = o.card ?? null; break;
      default: break;
    }
  }
  return b;
}

/* ---------------- legalitás ---------------- */
const RULE_STATE: Record<TState, string> = {
  open: 'Neutral Open', closed: 'Neutral Closed', showdown: 'Showdown Open', sclosed: 'Showdown Closed',
};
export const stateLabel = (s: TState) => RULE_STATE[s];
/** Miért nem játszható ki a lap most a sebessége és a turn állapota miatt (null: kijátszható). */
export function timingBlock(n: string, st: TState, turn: Side): string | null {
  const sp = speedOf(n);
  if (st === 'closed' || st === 'sclosed') return sp === 'Reaction' ? null : 'Amíg a chainen van valami, Closed State van: ilyenkor csak [Reaction] lap játszható ki {{309.1.a}}.';
  if (st === 'showdown') return sp ? null : 'Showdownban csak [Action] vagy [Reaction] lap játszható ki {{308.1.a}} {{343.1.a}}.';
  if (turn !== 'me') return 'Az ellenfél Main Phase-ében, Neutral Open Stateben nincs priorityd: lapot csak Closed Stateben vagy showdownban játszhatsz ki {{310.1.a}} {{312.2.a}}.';
  return null;
}
/** Kifizethető-e a lap: pool módban a Rune Poolból, egyébként a ready rune-ok exhaustolásával és rune recycle-lel. */
export function payBlock(b: PBoard, n: string, poolMode: boolean): string | null {
  const c = costOf(n);
  const pool = b.me.pool || { e: 0, p: {} };
  if (poolMode) {
    const haveP = c.d.reduce((a, d) => a + (pool.p[d] || 0), 0);
    if (pool.e < c.e && c.p && haveP < c.p) return 'Nincs elég Energy (' + pool.e + ' / ' + c.e + ') és ' + c.d.join('/') + ' Power (' + haveP + ' / ' + c.p + ') a Rune Poolban. Kattints a rune-okra: exhaust = 1 Energy {{164.2.a}}, recycle = 1 Power a rune domainjéből {{164.2.b}} {{164.2.b.1}}.';
    if (pool.e < c.e) return 'Nincs elég Energy a Rune Poolban (' + pool.e + ' / ' + c.e + '). Egy ready rune exhaustolása 1 Energyt ad {{164.2.a}}.';
    if (c.p && haveP < c.p) return 'Nincs elég ' + c.d.join('/') + ' Power a Rune Poolban (' + haveP + ' / ' + c.p + '). A recycle a rune saját domainjének Powerét adja {{164.2.b.1}}.';
    return null;
  }
  const ready = b.me.runes.filter((r) => !r.ex).length + (pool.e || 0);
  if (ready < c.e) return c.e + ' Energy kell, de csak ' + ready + ' ready rune-od van. Egy ready rune exhaustolva 1 Energyt ad {{164.2.a}}.';
  if (c.p) { const dn = b.me.runes.filter((r) => c.d.includes(r.d)).length + c.d.reduce((a, d) => a + (pool.p[d] || 0), 0); if (dn < c.p) return c.p + ' ' + c.d.join('/') + ' Power kell, de nincs ennyi ilyen domainű rune-od {{163.2.a}} {{164.2.b.1}}.'; }
  return null;
}
/** Automatikus fizetés: Energyért ready rune-ok exhaustolása (előbb a Powerhez nem kellő domainek), Powerért előbb exhausted rune recycle. */
export function autoPay(b0: PBoard, n: string, opt: { e?: number; p?: number; any?: boolean } = {}): PBoard {
  const b = clone(b0); const c = costOf(n); let e = opt.e ?? c.e; let p = opt.p ?? c.p;
  const doms = opt.any ? ['*'] : c.d;
  const pool = b.me.pool || { e: 0, p: {} };
  const fromPool = Math.min(pool.e, e); pool.e -= fromPool; e -= fromPool;
  const runes = b.me.runes;
  const order = runes.map((_, i) => i).filter((i) => !runes[i].ex).sort((x, y) => +doms.includes(runes[x].d) - +doms.includes(runes[y].d));
  for (const i of order) { if (e <= 0) break; runes[i].ex = true; e--; }
  for (const d of doms) { const fp = Math.min(pool.p[d] || 0, p); if (fp) { pool.p[d] -= fp; p -= fp; } }
  while (p > 0) {
    let j = runes.findIndex((r) => r.ex && (doms.includes('*') || doms.includes(r.d)));
    if (j < 0) j = runes.findIndex((r) => doms.includes('*') || doms.includes(r.d));
    if (j < 0) break; runes.splice(j, 1); p--;
  }
  if (b.me.pool) b.me.pool = pool;
  return b;
}
function payFromPool(b0: PBoard, n: string): PBoard {
  const b = clone(b0); const c = costOf(n); const pool = b.me.pool!;
  pool.e -= c.e; let p = c.p;
  for (const d of c.d) { const x = Math.min(pool.p[d] || 0, p); pool.p[d] = (pool.p[d] || 0) - x; p -= x; }
  return b;
}

/* ---------------- állapot ---------------- */
export const step = (es: ES): Step | undefined => es.scn.steps[es.i];
const free = (es: ES) => { const s = step(es); return s && s.t === 'free' ? s : null; };
export const tstate = (es: ES): TState => { const s: any = step(es); return s?.st || (es.b.chain.length ? 'closed' : 'open'); };

export function init(scn: Scn): ES {
  const b = clone(scn.board);
  if (scn.pool && !b.me.pool) b.me.pool = { e: 0, p: {} };
  return { scn, b, i: 0, started: false, done: [], pend: [], nonce: 0 };
}
export function start(es: ES): ES { return enter({ ...es, started: true }, 0); }
function enter(es: ES, i: number): ES {
  const s = es.scn.steps[i];
  if (!s) return es;
  const b = applyOps(es.b, (s as any).pre);
  const n: ES = { ...es, b, i, done: [], pend: [], tgt: undefined, asg: undefined, msg: undefined };
  if (s.t === 'target') n.tgt = { spec: s, sel: [] };
  if (s.t === 'assign') n.asg = [];
  return n;
}
function go(es: ES, g: Go | undefined, ops?: Op[]): ES {
  let n: ES = { ...es, b: applyOps(es.b, ops), tgt: undefined, msg: undefined };
  const to = g || 'next';
  if (to === 'stay') return n;
  if (to === 'next') return enter(n, es.i + 1);
  const o = es.scn.outcomes[to];
  if (!o) return { ...n, out: { id: to, kind: 'bad', title: 'Hiányzó kimenet', text: to } };
  n = { ...n, out: { ...o, id: to, opt: o.opt ?? (o.kind === 'bad' ? es.scn.optimal : undefined) } };
  return n;
}
const msg = (es: ES, m: string): ES => ({ ...es, msg: m, nonce: es.nonce + 1 });

/* ---------------- menük ---------------- */
function moveDests(b: PBoard, n: string): string[] {
  const l = locate(b, n); if (!l || l.side !== 'me') return [];
  if (l.zone === 'base') return b.bfs.map((_, i) => 'bf' + i);
  if (l.zone === 'bf') return ['base'];
  return [];
}
/** A lapra kattintáskor megjelenő akció-menü. null: a lapnak nincs menüje (pl. ellenfél lapja). */
export function menuFor(es: ES, ref: string): Menu | null {
  const m = menuRaw(es, ref); if (!m) return null;
  const s = free(es)!;
  return { ...m, items: m.items.map((it) => {
    if (it.dis || it.act === 'noop') return it;
    const key = actKey(es, it.act);
    const rel = s.acts?.[key] || (s.need || []).includes(key) || laterHas(es, key) || /^(energy|power|rpower):/.test(key);
    return rel ? it : { ...it, dis: s.lockMsg || es.scn.lockMsg || 'Szabályos lenne, de ebben a szituációban most nem ez a teendő.' };
  }) };
}
function menuRaw(es: ES, ref: string): Menu | null {
  const s = free(es); if (!s || es.out || es.tgt) return null;
  const b = es.b; const st = tstate(es); const l = locate(b, ref); if (!l || l.side !== 'me') return null;
  if (s.mode === 'awaken') return null;
  if (l.zone === 'base' || l.zone === 'bf') {
    const u = l.u!; if (u.gear) return null;
    if (es.pend.some((p) => p.startsWith('move:' + u.n + ':'))) return { ref, title: u.n, items: [{ label: 'Mozgás kijelölve', act: 'noop', dis: 'A mozgás a Mozgás megerősítése gombbal zárul.' }] };
    const dests = moveDests(b, u.n);
    const why = st === 'closed' || st === 'sclosed' ? 'Closed Stateben Standard Move nem végezhető {{144.1.b}}.'
      : st === 'showdown' ? 'Showdown vagy combat alatt Standard Move nem végezhető {{144.1.c}}.'
      : b.turn !== 'me' ? 'Standard Move csak a saját Main Phase-edben végezhető {{144.1.a}}.'
      : u.ex ? 'A unit exhausted. A Standard Move költsége a unit exhaustolása, ezért exhausted unit nem mozoghat így {{144.2}}.' : '';
    const items: MenuItem[] = dests.map((d) => ({ label: d === 'base' ? 'Vissza a base-be' : 'Mozgatás: ' + b.bfs[+d.slice(2)].name, act: 'move:' + u.n + ':' + d, dis: why || undefined }));
    if (!items.length) items.push({ label: 'Mozgatás', act: 'noop', dis: why || 'Battlefieldről battlefieldre Standard Move-val csak Ganking képességgel lehet lépni {{144.4.c.1}}.' });
    return { ref, title: u.n, speed: 'Standard Move', items };
  }
  if (l.zone === 'hand') {
    const n = b.me.hand![l.idx!]; const c = costOf(n); const sp = speedOf(n);
    const tb = timingBlock(n, st, b.turn); const pb = tb ? null : payBlock(b, n, !!es.scn.pool);
    const items: MenuItem[] = [{ label: 'Kijátszás', act: 'play:' + n, dis: tb || pb || undefined, pay: !!pb }];
    if (isHidden(n)) {
      const hb = st === 'closed' || st === 'sclosed' || b.turn !== 'me' ? 'Elrejteni a saját körödben, Open Stateben (chain nélkül) lehet {{811.1.b}} {{309.2}}.' : b.me.runes.length ? null : 'A Hidden költsége 1 Power {{811.1.b}}.';
      b.bfs.forEach((f, i) => {
        const fb = f.ctrl !== 'me' ? 'Csak általad kontrollált battlefieldre rejthetsz {{811.1.b}} {{107.3.c}}.' : f.fd ? 'Ott már van facedown lap {{811.1.b}}.' : hb;
        items.push({ label: 'Elrejtés: ' + f.name, act: 'hide:' + n + ':bf' + i, dis: fb || undefined });
      });
    }
    return { ref, title: n, speed: sp || (card(n).t === 'Unit' ? 'Unit' : card(n).t || ''), cost: c.e + ' Energy' + (c.p ? ' + ' + c.p + ' ' + c.d.join('/') + ' Power' : ''), items };
  }
  if (l.zone === 'fd') {
    const ok = s.fdReady && (b.bfs[l.bf!].fd === 'me');
    return { ref, title: b.bfs[l.bf!].fdCard || 'Facedown lap', speed: 'Hidden', items: [{ label: 'Kijátszás facedownból', act: 'playfd:' + l.bf, dis: ok ? undefined : 'A Hidden lap az elrejtést követő körtől kap Reactiont {{811.6}}.' }] };
  }
  if (l.zone === 'rune') {
    if (!es.scn.pool) return null;
    const r = b.me.runes[l.idx!];
    const items: MenuItem[] = [];
    items.push({ label: 'Energy: exhaust (+1 Energy)', act: 'energy:' + l.idx, tone: 'energy', dis: r.ex ? 'Ez a rune már exhausted, újra nem ad Energyt {{164.2.a}}.' : undefined });
    items.push({ label: 'Power: recycle (+1 ' + r.d + ' Power)', act: 'power:' + l.idx, tone: 'power' });
    return { ref, title: r.d + ' Rune' + (r.ex ? ' (exhausted)' : ''), items };
  }
  return null;
}
/** Az akció-azonosító normalizált alakja (rune indexek helyett domain és állapot), ezt használja az adat. */
export function actKey(es: ES, act: string): string {
  const m = act.match(/^(energy|power):(\d+)$/);
  if (m) { const r = es.b.me.runes[+m[2]]; if (!r) return act; return m[1] === 'energy' ? 'energy:' + r.d : (r.ex ? 'power:' : 'rpower:') + r.d; }
  return act;
}
const enabledIn = (es: ES, act: string): boolean => {
  if (/^(move|play|hide):/.test(act)) {
    const n = act.split(':')[1]; const ref = act.startsWith('move:') ? n : 'h:' + n;
    return !!menuFor(es, ref)?.items.find((x) => x.act === act && !x.dis);
  }
  if (act.startsWith('playfd:')) return !!menuFor(es, 'fd:' + act.slice(7))?.items.find((x) => !x.dis);
  if (/^(energy|power):/.test(act)) return !!menuFor(es, 'r:' + act.split(':')[1])?.items.find((x) => x.act === act && !x.dis);
  return true;
};
/** Ezzel a laphoz most lehet valamit csinálni (zöld keret). */
export function glowOf(es: ES, ref: string): '' | 'act' | 'awaken' {
  const s = free(es); if (!s || es.out || es.tgt || !es.started) return '';
  const l = locate(es.b, ref); if (!l || l.side !== 'me') return '';
  if (s.mode === 'awaken') {
    if (l.zone === 'rune') return es.b.me.runes[l.idx!].ex ? 'awaken' : '';
    if (ref === 'legend') return es.b.me.legendEx ? 'awaken' : '';
    if (l.u) return l.u.ex ? 'awaken' : '';
    return '';
  }
  const m = menuFor(es, ref); return m && m.items.some((x) => !x.dis || (x.pay && es.scn.pool && (free(es)?.acts?.[actKey(es, x.act)] || (free(es)?.need || []).includes(x.act)))) ? 'act' : '';
}

/* ---------------- akciók ---------------- */
function laterHas(es: ES, key: string): boolean {
  for (let k = es.i + 1; k < es.scn.steps.length; k++) {
    const s: any = es.scn.steps[k];
    if (s.t === 'free' && ((s.need || []).includes(key) || (s.acts && s.acts[key] && (s.acts[key].go || 'stay') === 'next') || (s.acts && s.acts[key] && (s.need || []).length === 0))) return true;
  }
  return false;
}
function orderOut(es: ES): ES {
  const s = free(es)!; const id = es.scn.order || '__order';
  if (es.scn.outcomes[id]) return go(es, id);
  return { ...es, tgt: undefined, out: { id, kind: 'bad', title: 'Rossz sorrend', text: s.orderWhy || 'Ez a lépés szabályos lehet, de a sorrend számít: előbb a mostani helyzetet kell lezárni.', opt: es.scn.optimal } };
}
/** A generikus hatás: a játékszabály szerinti következmény (fizetés, a lap helye). */
function effect(es: ES, act: string, to?: string): PBoard {
  let b = es.b;
  const [k, a1, a2] = act.split(':');
  if (k === 'play') {
    const n = a1; b = es.scn.pool ? payFromPool(b, n) : autoPay(b, n);
    b = clone(b); b.me.hand!.splice(b.me.hand!.indexOf(n), 1);
    const t = card(n).t;
    if (t === 'Unit' || t === 'Gear') place(b, 'me', { n, m: +card(n).m || 0, ex: !entersReady(n), tags: ['new'], gear: t === 'Gear' }, to || 'base');
    else b.chain.push({ card: n, owner: 'me' });
  } else if (k === 'hide') {
    b = autoPay(b, a1, { e: 0, p: 1, any: true }); b = clone(b);
    b.me.hand!.splice(b.me.hand!.indexOf(a1), 1); const f = b.bfs[+a2.slice(2)]; f.fd = 'me'; f.fdCard = a1;
  } else if (k === 'playfd') {
    b = clone(b); const f = b.bfs[+a1]; const n = f.fdCard || ''; f.fd = null; f.fdCard = null;
    place(b, 'me', { n, m: +card(n).m || 0, ex: true, tags: ['new'] }, 'bf' + a1);
  } else if (k === 'energy') {
    b = clone(b); const r = b.me.runes[+a1]; r.ex = true; b.me.pool ||= { e: 0, p: {} }; b.me.pool.e++;
  } else if (k === 'power') {
    b = clone(b); const r = b.me.runes.splice(+a1, 1)[0]; b.me.pool ||= { e: 0, p: {} }; b.me.pool.p[r.d] = (b.me.pool.p[r.d] || 0) + 1;
  } else if (k === 'move') {
    b = clone(b); const x = removeUnit(b, a1); if (x) { x.ex = true; x.tags = [...new Set([...(x.tags || []), 'new'])]; place(b, 'me', x, a2); }
  }
  return b;
}
function feasible(es: ES): boolean {
  const s = free(es); if (!s?.budget || !es.scn.pool) return true;
  const b = es.b; const pool = b.me.pool || { e: 0, p: {} };
  const left = s.budget.filter((n) => (b.me.hand || []).includes(n));
  const E = left.reduce((a, n) => a + costOf(n).e, 0);
  const P: Record<string, number> = {}; left.forEach((n) => { const c = costOf(n); if (c.p) P[c.d[0]] = (P[c.d[0]] || 0) + c.p; });
  if (pool.e + b.me.runes.filter((r) => !r.ex).length < E) return false;
  return Object.entries(P).every(([d, p]) => (pool.p[d] || 0) + b.me.runes.filter((r) => r.d === d).length >= p);
}
function finishAct(es: ES, key: string, res: Res | undefined, b: PBoard): ES {
  const s = free(es)!;
  let n: ES = { ...es, b, done: [...es.done, key], msg: res?.msg, nonce: es.nonce + (res?.msg ? 1 : 0), last: [...(es.last || []), key] };
  const g = res?.go || ((s.need || []).includes(key) || key.startsWith('energy:') || key.startsWith('power:') ? 'stay' : 'next');
  const keep = (r: ES): ES => (res?.msg && !r.out ? { ...r, msg: res.msg, nonce: r.nonce + 1 } : r);
  if (g !== 'stay') return keep(go(n, g, res?.do));
  n = { ...n, b: applyOps(n.b, res?.do) };
  if (!feasible(n)) return go(n, s.deadEnd || es.scn.fallback);
  const need = s.need || [];
  if (need.length && need.every((x) => n.done.includes(x)) && !s.confirm && !s.bbtn) return keep(go(n, 'next'));
  return n;
}

/** Akció végrehajtása a szabad lépésben (menüpont, End Turn, Mozgás megerősítése, pályagomb, Awaken kattintás). */
export function act(es: ES, a: string): ES {
  const s = free(es); if (!s || es.out || es.tgt || !es.started) return es;
  if (a === 'noop') return es;
  // Awaken: a saját exhausted lapok readyzése egyenként
  if (a.startsWith('ready:')) {
    if (s.mode !== 'awaken') return es;
    const ref = a.slice(6); const b = clone(es.b); const l = locate(b, ref);
    if (ref === 'legend') b.me.legendEx = false; else if (l?.zone === 'rune') b.me.runes[l.idx!].ex = false; else if (l?.u && l.side === 'me') l.u.ex = false; else return es;
    const left = b.me.runes.some((r) => r.ex) || b.me.legendEx || b.me.base.some((u) => u.ex) || b.bfs.some((f) => f.me.some((u) => u.ex));
    const n: ES = { ...es, b, done: [...es.done, a] };
    return left ? n : go(n, 'next', (s as any).do);
  }
  if (a === 'end') return go(es, s.end?.go || es.scn.fallback, s.end?.do);
  if (a === 'pass') { if (!s.pass) return es; return go(es, s.pass.go, s.pass.do); }
  if (a === 'bbtn') { if (!s.bbtn) return es; return s.bbtn.target ? { ...es, tgt: { spec: s.bbtn.target, sel: [], act: a, res: s.bbtn } } : go(es, s.bbtn.go, s.bbtn.do); }
  if (a === 'confirm') return confirmMove(es);
  if (!enabledIn(es, a)) return msg(es, 'Ez most nem szabályos.');
  const key = actKey(es, a);
  if (a.startsWith('move:')) {
    const b = effect(es, a);
    return { ...es, b, pend: [...es.pend, key], last: [...(es.last || []), key] };
  }
  const res = s.acts?.[key];
  if (!res && !(s.need || []).includes(key)) {
    if (/^(energy|power|rpower):/.test(key)) return finishAct(es, key, { go: 'stay' }, effect(es, a));
    if (laterHas(es, key)) return orderOut(es);
    return go(es, es.scn.fallback);
  }
  if (res?.target) return { ...es, tgt: { spec: res.target, sel: [], act: a, res } };
  if (res?.go && res.go !== 'next' && res.go !== 'stay') return go(es, res.go, res.do);
  const to = a.startsWith('play:') ? (res as any)?.to : undefined;
  return finishAct(es, key, res, effect(es, a, to));
}
function confirmMove(es: ES): ES {
  const s = free(es)!;
  const need = (s.need || []).filter((x) => x.startsWith('move:'));
  for (const p of es.pend) {
    if (need.includes(p)) continue;
    const r = s.acts?.[p];
    if (r?.go && r.go !== 'next' && r.go !== 'stay') return go(es, r.go, r.do);
    if (laterHas(es, p)) return orderOut(es);
    return go(es, es.scn.fallback);
  }
  if (need.some((x) => !es.pend.includes(x))) return go(es, s.partial || es.scn.fallback);
  const n: ES = { ...es, pend: [], b: applyOps(es.b, [{ op: 'untagNew' }]) };
  return go(n, s.confirm?.go || 'next', s.confirm?.do);
}

/* ---------------- panel, célpont, kiosztás ---------------- */
export function panelBtn(es: ES, i: number, kind: 'btn' | 'card' = 'btn'): ES {
  const s = step(es); if (!s || s.t !== 'panel' || es.out || es.tgt) return es;
  const r: any = kind === 'btn' ? s.btns?.[i] : s.cards?.[i];
  if (!r || r.dis) return es;
  let e2 = es;
  if (kind === 'card') {
    const tb = timingBlock(r.card, s.st || tstate(es), es.b.turn); if (tb) return msg(es, tb);
    if ((r.go || 'next') === 'next' || es.scn.outcomes[r.go]?.kind === 'good') { if ((es.b.me.hand || []).includes(r.card)) e2 = { ...es, b: effect(es, 'play:' + r.card) }; }
  }
  if (r.target) return { ...e2, tgt: { spec: r.target, sel: [], act: 'panel', res: r, undo: es.b } };
  return go(e2, r.go, r.do);
}
export function autoNext(es: ES): ES { const s = step(es); if (!s || s.t !== 'auto' || es.out) return es; return go(es, 'next', s.do); }
export function tgtToggle(es: ES, ref: string): ES {
  if (!es.tgt) return es; const t = es.tgt;
  if (t.spec.illegal?.[ref]) return msg(es, t.spec.illegal[ref]);
  const sel = t.sel.includes(ref) ? t.sel.filter((x) => x !== ref) : t.sel.length >= t.spec.max ? (t.spec.max === 1 ? [ref] : t.sel) : [...t.sel, ref];
  return { ...es, tgt: { ...t, sel }, msg: undefined };
}
export function tgtCancel(es: ES): ES { if (!es.tgt || es.tgt.spec.cancel === false || step(es)?.t === 'target') return es; return { ...es, b: es.tgt.undo || es.b, tgt: undefined }; }
export function tgtConfirm(es: ES): ES {
  if (!es.tgt) return es; const { spec, sel, act: a, res } = es.tgt;
  if (sel.length < (spec.min ?? 1)) return es;
  const ok = sel.length === spec.correct.length && spec.correct.every((x) => sel.includes(x));
  if (!ok) {
    const w = sel.map((x) => spec.wrong?.[x]).find(Boolean) || spec.wrongSet || es.scn.fallback;
    return go({ ...es, tgt: undefined }, w);
  }
  const ops = [...(spec.do || []), ...((res && res !== spec ? res.do : []) || [])];
  if (a && a !== 'panel' && a !== 'bbtn' && step(es)?.t === 'free') {
    const b = effect({ ...es, tgt: undefined }, a, (res as any)?.to);
    return finishAct({ ...es, tgt: undefined }, actKey(es, a), { go: spec.go || (res as any)?.go, do: ops }, b);
  }
  return go({ ...es, tgt: undefined }, spec.go || (res as any)?.go || 'next', ops);
}
/** Damage kiosztás: a kiválasztás sorrendjében mindenki lethal damage-et kap (467.2.c.3), a maradék a végén az utolsóra (467.2.c.4). */
export function asgView(es: ES) {
  const s = step(es) as AssignStep; const order = es.asg || [];
  const foe: Side = s.side === 'me' ? 'opp' : 'me';
  const units = es.b.bfs[s.bf][foe].filter((u) => !u.gear);
  const lethal = (u: PUnit) => Math.max(1, u.m - (u.dmg || 0));
  let left = s.amount; const got: Record<string, number> = {};
  for (const n of order) { const u = units.find((x) => x.n === n)!; const v = Math.min(lethal(u), left); got[n] = v; left -= v; }
  if (left > 0 && order.length === units.length && order.length) { got[order[order.length - 1]] += left; left = 0; }
  const tankLeft = units.some((u) => /\[Tank\]/.test(card(u.n).txt || '') && !order.includes(u.n));
  const rows = units.map((u) => ({
    n: u.n, m: u.m, lethal: lethal(u), got: got[u.n] || 0, picked: order.includes(u.n),
    dis: order.includes(u.n) ? 'Már kapott damage-et.' : left <= 0 ? 'Nincs több kiosztható damage.' : tankLeft && !/\[Tank\]/.test(card(u.n).txt || '') ? 'Előbb a Tank unit kapjon lethal damage-et {{815.1.b}}.' : '',
  }));
  return { amount: s.amount, left, rows, done: left <= 0 || order.length === units.length };
}
export function asgPick(es: ES, n: string): ES {
  const v = asgView(es); const r = v.rows.find((x) => x.n === n); if (!r || r.dis) return r ? msg(es, r.dis) : es;
  let e2: ES = { ...es, asg: [...(es.asg || []), n], msg: undefined };
  // ha egyetlen unit maradt, a maradék damage automatikusan rá kerül (467.2.c.3)
  const v2 = asgView(e2); const rest = v2.rows.filter((x) => !x.picked);
  if (v2.left > 0 && rest.length === 1 && !rest[0].dis) e2 = { ...e2, asg: [...e2.asg!, rest[0].n] };
  return e2;
}
export function asgReset(es: ES): ES { return { ...es, asg: [] }; }
export function asgConfirm(es: ES): ES {
  const s = step(es) as AssignStep; const v = asgView(es); if (!v.done) return es;
  const first = (es.asg || [])[0];
  const g = (first && s.first?.[first]) || s.go || 'next';
  const dmg: Op[] = v.rows.filter((r) => r.got).map((r) => ({ op: 'dmg', ref: r.n, n: r.got }));
  return go({ ...es, asg: undefined }, g, [...dmg, ...(g === 'next' || es.scn.outcomes[g]?.kind === 'good' ? s.do || [] : [])]);
}

/* ---------------- megoldó (tesztekhez): az elvárt sor végigjátszása ---------------- */
export function solve(scn: Scn, max = 200): ES {
  let es = start(init(scn));
  for (let k = 0; k < max && !es.out; k++) {
    if (es.tgt) { for (const r of es.tgt.spec.correct) es = tgtToggle(es, r); es = tgtConfirm(es); continue; }
    const s = step(es); if (!s) break;
    if (s.t === 'panel') {
      const bi = (s.btns || []).findIndex((x) => !x.dis && (x.go || 'next') === 'next');
      if (bi >= 0) { es = panelBtn(es, bi); continue; }
      const ci = (s.cards || []).findIndex((x) => (x.go || 'next') === 'next');
      if (ci >= 0) { es = panelBtn(es, ci, 'card'); continue; }
      const gi = (s.btns || []).findIndex((x) => x.go && es.scn.outcomes[x.go]?.kind === 'good');
      es = panelBtn(es, gi); continue;
    }
    if (s.t === 'auto') { es = autoNext(es); continue; }
    if (s.t === 'assign') {
      const f = Object.entries(s.first || {}).find(([, g]) => g === 'next' || es.scn.outcomes[g]?.kind === 'good');
      if (f) es = asgPick(es, f[0]);
      while (!asgView(es).done) { const r = asgView(es).rows.find((x) => !x.dis); if (!r) break; es = asgPick(es, r.n); }
      es = asgConfirm(es); continue;
    }
    if (s.t === 'free') {
      const i0 = es.i;
      if (s.mode === 'awaken') {
        const refs = [...es.b.me.base.filter((u) => u.ex).map((u) => u.n), ...es.b.bfs.flatMap((f) => f.me.filter((u) => u.ex).map((u) => u.n)), ...es.b.me.runes.map((r, i) => (r.ex ? 'r:' + i : '')).filter(Boolean), ...(es.b.me.legendEx ? ['legend'] : [])];
        for (const r of refs.reverse()) es = act(es, 'ready:' + r);
        continue;
      }
      for (const key of s.sol || s.need || []) {
        if (es.out || es.i !== i0) break;
        es = act(es, rawAct(es, key));
        if (es.tgt) { for (const r of es.tgt.spec.correct) es = tgtToggle(es, r); es = tgtConfirm(es); }
      }
      if (es.out || es.i !== i0) continue;
      if (es.pend.length || (s.need || []).some((x) => x.startsWith('move:'))) { es = act(es, 'confirm'); continue; }
      if (s.bbtn) { es = act(es, 'bbtn'); continue; }
      if (s.pass && (s.pass.go || 'next') === 'next') { es = act(es, 'pass'); continue; }
      es = act(es, 'end');
    }
  }
  return es;
}
/** Adatbeli kulcsból (energy:Fury, power:Fury) konkrét rune index. */
export function rawAct(es: ES, key: string): string {
  const m = key.match(/^(energy|power|rpower):(\w+)$/);
  if (!m) return key;
  const rs = es.b.me.runes;
  const i = m[1] === 'energy' ? rs.findIndex((r) => r.d === m[2] && !r.ex) : m[1] === 'power' ? rs.findIndex((r) => r.d === m[2] && r.ex) : rs.findIndex((r) => r.d === m[2] && !r.ex);
  return (m[1] === 'energy' ? 'energy:' : 'power:') + i;
}
