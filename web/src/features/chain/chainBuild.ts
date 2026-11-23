/* A pályás Chain építő segédei (React nélkül): kiinduló pálya, a lejátszási frame kiegészítése az építő zónáival,
   és a legalitás az elemző (analyze) alapján. Az állapot mindig a builder CS-e; ez a modul csak olvassa vagy másolatot elemez. */
import { runChain } from '../../domain/chain/engine/analyze';
import { stepInfo } from '../../domain/chain/steps';
import { abilitiesOf, triggersOf } from '../../domain/chain/parser';
import { timingOf, isPermC, interp } from '../../domain/chain/actions';
import { zoneRefOf, zoneCheck, type ZoneRef } from '../../domain/chain/zones';
import { vsCard, CARDS } from '../../domain/data/store';
import { norm } from '../../domain/text/norm';
import { instName, instNos, tgOptionsOf, reorderSteps, locLabelOf } from '../../domain/chain/cs';
import type { PBoard, PSide } from '../../shared/board/Playmat';
import type { Card } from '../../domain/data/schema';
import type { Ability, TargetParam, Trigger } from '../../domain/chain/types';
import type { ChainState, ChainStep, Step } from '../../domain/chain/state';

export type Arrow = { from: number; to: string };
export type MtInstr = { t: string; st: 'executed' | 'partial' | 'ignored' | 'negated' | 'skipped'; ref: string; why: string; man?: boolean };
export type MtInfo = { item: string; kind: 'full' | 'partial' | 'none'; targets: { n: string; ok: boolean; skip?: boolean; why?: string }[]; instr: MtInstr[] };
export type ChainFrame = { label: string; board: PBoard; changes: [string, string, number?][]; arrows: Arrow[]; bfi?: number[]; mt?: MtInfo | null; sj?: number };

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export const sideOf = (p: string) => (p === 'B' ? 'opp' : 'me') as 'me' | 'opp';
export const plOf = (side: 'me' | 'opp'): 'A' | 'B' => (side === 'opp' ? 'B' : 'A');
export const cardOf = (n?: string | null): Card | null => (n ? vsCard(n) || null : null);

/** A kiinduló helyzet pontosan úgy, ahogy az elemző rajzolja: egy üres Resolve lépéssel futtatva az első frame (340.1: üres chainen nincs mit lefuttatni). */
export function setupFrame(CS: ChainState): ChainFrame {
  const c = clone(CS); c.steps = [{ k: 'res' }];
  return runChain(c).frames[0] as ChainFrame;
}

/** Melyik frame-ben került a j. lépés a chainre (a frame sj mezője). */
export function stepFrames(frames: ChainFrame[]): Record<number, number> {
  const m: Record<number, number> = {};
  frames.forEach((f, i) => { if (f.sj != null && m[f.sj] == null) m[f.sj] = i; });
  return m;
}

/** Az építő pályája: mindkét battlefield hely látszik (üresen is), a champion, a kéz és a facedown lap a CS építő mezőiből,
    a k. frame-ig kijátszott lapok nélkül. A nyilak battlefield indexe a teljes (két helyes) listára igazodik. */
export function fullFrame(f: ChainFrame, CS: ChainState, k: number, sf: Record<number, number>): ChainFrame {
  const played = (pred: (s: ChainStep) => boolean) => CS.steps.filter((s, j) => s.k === 'card' && pred(s) && sf[j] != null && sf[j] <= k);
  const bfi = f.bfi || [];
  const bfs = [0, 1].map((i) => {
    const pos = bfi.indexOf(i);
    const b: PBoard['bfs'][number] = pos >= 0 ? { ...f.board.bfs[pos] } : { name: '', ctrl: CS.bf[i].c === 'A' ? 'me' : CS.bf[i].c === 'B' ? 'opp' : null, me: [], opp: [] };
    if (!CS.bf[i].n) b.name = '';
    const fd = CS.bf[i].fd; const fdn = CS.bf[i].fdn || null;
    const gone = fdn && played((s) => s.from === 'facedown' && (s.loc || 'bf0') === 'bf' + i && s.n === fdn).length > 0;
    b.facedown = fd && !gone ? sideOf(fd) : null; b.fdn = fd && !gone ? fdn : null;
    return b;
  });
  const arrows = f.arrows.map((a) => (a.to.startsWith('bf:') ? { ...a, to: 'bf:' + (bfi[+a.to.slice(3)] ?? 0) } : a));
  const side = (p: 'A' | 'B') => {
    const s: PSide = { ...f.board[sideOf(p)] };
    const ch = (CS.ch || {})[p] || '';
    s.champion = ch && !played((x) => x.from === 'champ' && x.n === ch && x.pl === p).length ? ch : null;
    if (!s.zids) {
      const left = ((CS.hand || {})[p] || []).map((e, i) => (typeof e === 'string' ? { id: 'zh' + p + i, n: e } : e));
      played((x) => (x.from || 'hand') === 'hand' && x.pl === p).forEach((x) => { const i = left.findIndex((e) => e.n === x.n); if (i >= 0) left.splice(i, 1); });
      s.zids = { hand: [...left.map((e) => e.id!), ...(s.hand || []).map(() => '')], trash: [] };
      s.hand = [...left.map((e) => e.n), ...(s.hand || [])];
    }
    return s;
  };
  return { ...f, board: { ...f.board, me: side('A'), opp: side('B'), bfs }, arrows, bfi: [0, 1] };
}

export type Legal = { ok: boolean; why?: string; ref?: string; need?: string };
const BAD = /^Nem szabályos:/;
const reasonOf = (t: string) => t.replace(/^Nem szabályos:\s*/, '').replace(/^[^?]*\?\s*/, '').replace(/\.\s*Kimarad\.?$/, '');
/** A sorok különbsége (multihalmaz): ami a b-ben új az a-hoz képest. */
function newRows(a: [string, string, number?][], b: [string, string, number?][]) {
  const cnt = new Map<string, number>();
  a.forEach((r) => { const k = r.join('|'); cnt.set(k, (cnt.get(k) || 0) + 1); });
  return b.filter((r) => { const k = r.join('|'); const n = cnt.get(k) || 0; if (n) { cnt.set(k, n - 1); return false; } return true; });
}

/** Lépés beszúrása a k. helyre (a végére: k = lépésszám); a hivatkozások ugyanúgy átszámozódnak, mint átrendezésnél. */
export function insertAt(cs: ChainState, k: number, st: Step) {
  cs.steps.push(st); const n = cs.steps.length;
  const order = [...Array(n - 1).keys()]; order.splice(Math.max(0, Math.min(k, n - 1)), 0, n - 1);
  reorderSteps(cs, order);
}

/** Egy új lépés a chain k. helyére (alapból a végére): az elemző dönti el, szabályos-e (sebesség, Closed State, költség, forrás állapota).
    A lépés saját frame-jének sorai számítanak. A hiányzó célpont vagy költség-választás nem tiltás: azt utána a pályán választja ki a felhasználó. */
export function tryStep(CS: ChainState, step: Step, at?: number): Legal {
  const c = clone(CS); const k = at == null ? c.steps.length : at;
  insertAt(c, k, clone(step));
  const r = runChain(c);
  const f = r.frames.find((x) => x.sj === k);
  const bad = (f ? f.changes : []).find((x) => BAD.test(x[1]));
  if (!bad) return { ok: true };
  const why = reasonOf(bad[1]);
  if (/nincs megadva/.test(why)) return { ok: true, need: why };
  return { ok: false, why, ref: bad[0] };
}

export type TgOpt = { v: string; label: string; ok: boolean; why?: string; ref?: string };
/** A j. lépés ti. célpontjának választható értékei, mindegyikre lefuttatva az elemzést: legális-e, és ha nem, miért (355.8). */
export function targetOpts(CS: ChainState, j: number, ti: number): TgOpt[] {
  const s = CS.steps[j]; if (!s) return [];
  const inf = stepInfo(CS, s); const p = inf?.list?.[ti]; if (!p) return [];
  const base = clone(CS); base.steps[j].tg = [...(base.steps[j].tg || [])]; base.steps[j].tg[ti] = '';
  const r0 = runChain(clone(base)).rows;
  const all = tgOptionsOf(CS, j, p).slice(1);
  const xs = all.some((o) => o[0] === 'x') ? ['base', 'bf0', 'bf1'].flatMap((loc) => ['A', 'B'].map((pl) => ['x:' + loc + ':' + pl, 'Pályán kívüli ' + p.type + ': ' + (pl === 'A' ? 'saját, ' : 'ellenfél, ') + locLabelOf(CS, loc)])) : [];
  return [...all.filter((o) => o[0] !== 'x'), ...xs].map((o) => {
    const c = clone(base);
    if (o[0].startsWith('x:')) { const [, loc, pl] = o[0].split(':'); c.steps[j].tg![ti] = 'x'; c.steps[j].ext = { ...(c.steps[j].ext || {}), [ti]: { ...((c.steps[j].ext || {})[ti] || {}), loc, pl } }; }
    else c.steps[j].tg![ti] = o[0];
    const nr = newRows(r0, runChain(c).rows);
    const bad = nr.find((x) => (BAD.test(x[1]) && !/nincs megadva/.test(x[1])) || /^A trigger \d+\. célpontja \(/.test(x[1]) || /^A play effectnek nincs legális választása/.test(x[1]));
    let why = bad ? reasonOf(bad[1]) : undefined;
    if (bad && /^A trigger/.test(bad[1])) why = bad[1].replace(/^A trigger \d+\. célpontja \([^)]*\) nem legális:\s*/, '').replace(/;.*$/, '');
    if (bad && /^A play effectnek/.test(bad[1])) why = bad[1].replace(/^[^(]*\(/, '').replace(/\)\..*$/, '');
    return { v: o[0], label: o[1], ok: !bad, why, ref: bad ? bad[0] : undefined };
  }).filter((o: TgOpt) => o.ok || !o.v.startsWith('x:'));
}

/** A célpont-paraméter rövid leírása (a builder célpont-választójának szövegéből). */
export function slotText(p: TargetParam, ti: number) {
  return (ti + 1) + '. célpont' + (p.opt ? ' (nem kötelező)' : '') + ': ' + (p.rel !== 'any' ? p.rel + ' ' : '') + (p.equipOnly ? 'Equipment' : p.type) + (p.bf ? ', battlefielden' : '') + (p.here ? ', "here"' : '') + (p.free ? ', másik locationön' : '') + (p.max != null ? ', max ' + p.max + ' Might' : '') + (p.mighty ? ', Mighty' : '');
}

/** A lépés rövid neve az idővonalon. */
export function stepName(CS: ChainState, s: Step): { n: string; img?: string; kind: string } {
  if (s.k === 'res') return { n: 'Resolve', kind: 'a chain teteje lefut' };
  if (s.k === 'end') return { n: 'Kör vége', kind: 'Ending Phase' };
  if (s.k === 'tr') return { n: s.n || '?', img: s.n, kind: 'combat utáni trigger' };
  if (s.k === 'ab' || s.k === 'tg') {
    const inf = stepInfo(CS, s); const n = inf?.c?.n || s.n || '';
    const lbl = s.k === 'ab' ? (inf?.ab?.label || '') : (inf?.tr?.why || '');
    return { n: n ? instName(n, s.src ? instNos(CS)[s.src] : undefined) : 'nincs forrás', img: n, kind: (s.k === 'ab' ? 'ability' : 'trigger') + (lbl ? ': ' + String(lbl).slice(0, 40) : '') };
  }
  const c = cardOf(s.n);
  return { n: c ? instName(c.n, instNos(CS)['s' + CS.steps.indexOf(s)]) : s.n || 'üres lépés', img: c?.n, kind: s.from === 'facedown' ? 'facedown-ból' : s.from === 'champ' ? 'Champion Zone-ból' : 'kijátszás' };
}

/** Abilityk és triggerek egy forráshoz (a csatolt gear szövegével, 136.2.c). */
export function abilitiesFor(CS: ChainState, src: string) {
  const c = src[0] === 'L' ? cardOf(CS.lg[src.slice(1)] as string | undefined) : src[0] === 'b' ? cardOf(CS.bd[+src.slice(1)]?.n) : src[0] === 's' ? cardOf(CS.steps[+src.slice(1)]?.n) : null;
  if (!c) return { c: null, abs: [] as Ability[], trs: [] as Trigger[] };
  const extra = src[0] === 'b' ? CS.bd.filter((g) => g.on === +src.slice(1)).map((g) => cardOf(g.n)?.eff || '').join('\n') : '';
  return { c, abs: abilitiesOf(c), trs: triggersOf(c, extra) };
}

export const hasHidden = (c: Card | null | undefined) => !!c && (timingOf(c) === 'hidden' || /^\[Hidden\]/m.test(c.txt || ''));
export const isPerm = (c: Card | null | undefined) => isPermC(c);

/** Kártyakereső: típus szerint előszűrve, gépelve szűrhető. */
export type PickKind = 'legend' | 'champion' | 'battlefield' | 'board' | 'hand' | 'play' | 'hidden' | 'trash' | 'deck' | 'runeDeck' | 'runePool';
export const PICK_TITLE: Record<PickKind, string> = {
  legend: 'Legend', champion: 'Champion (Champion Zone)', battlefield: 'Battlefield', board: 'Unit vagy gear a pályára', hand: 'Lap a kézbe', play: 'Kijátszás a chainre', hidden: 'Hidden lap a facedown helyre', trash: 'Lap a trashbe', deck: 'Lap a deck tetejére', runeDeck: 'Rune a Rune Deck tetejére', runePool: 'Rune a rune poolba',
};
const okType = (k: PickKind, c: Card) => {
  const t = c.t;
  if (k === 'runeDeck' || k === 'runePool') return t === 'Rune';
  if (k === 'legend') return t === 'Legend';
  if (k === 'battlefield') return t === 'Battlefield';
  if (k === 'champion') return t === 'Unit' && (c.st || []).includes('Champion');
  if (k === 'board') return t === 'Unit' || t === 'Gear';
  if (k === 'hidden') return (t === 'Unit' || t === 'Gear' || t === 'Spell') && hasHidden(c);
  return t === 'Unit' || t === 'Gear' || t === 'Spell';
};
export function searchCards(k: PickKind, q: string, limit = 60): Card[] {
  const words = norm(q || '').split(' ').filter(Boolean);
  const out: Card[] = [];
  for (const c of CARDS) {
    if (!okType(k, c) || (c.st || []).includes('Token') && k !== 'board') continue;
    if (words.length) { const h = norm(c.n + ' ' + (c.tg || []).join(' ')); if (!words.every((w) => h.includes(w))) continue; }
    out.push(c); if (out.length >= limit) break;
  }
  if (words.length) { const w = norm(q); out.sort((a, b) => +!norm(a.n).startsWith(w) - +!norm(b.n).startsWith(w)); }
  return out;
}

/** A lépés kézből, trashből vagy deckből választó utasításai (a deck felső lapja automatikus, azt nem kell választani). */
export type ZPick = { xi: number; zr: ZoneRef; t: string };
export function zonePicks(CS: ChainState, j: number): ZPick[] {
  const s = CS.steps[j]; if (!s || s.k === 'res' || s.k === 'end') return [];
  const inf = stepInfo(CS, s); if (!inf?.eff) return [];
  return interp(s, inf).map((x, xi) => ({ xi, zr: zoneRefOf(x.t, inf.c?.n) as ZoneRef, t: x.t })).filter((z) => z.zr && !(z.zr.z === 'deck' && z.zr.top && z.zr.act !== 'banishEach'));
}
export type ZCand = { id: string; n: string; zone: string; own: string | null | undefined; ok: boolean; why?: string };
/** A választható lapok a lépés lerakásakor (az elemző pillanatképe), a lap szövegének megkötéseivel ellenőrizve. */
export function zoneCands(CS: ChainState, j: number, xi: number): ZCand[] {
  const zp = zonePicks(CS, j).find((z) => z.xi === xi); if (!zp) return [];
  const c = clone(CS); if (c.steps[j].zp) c.steps[j].zp[xi] = [];
  const r = runChain(c); const snap = r.zsnap?.[j]; if (!snap) return [];
  const s = CS.steps[j]; const pl = s.k === 'tg' ? (r.objs[s.src as string]?.ctrl || s.pl || 'A') : (s.pl || 'A');
  if (zp.zr.who === 'each') {
    /* minden játékos a saját lapjai közül (355.10.e, 412.1) */
    if (zp.zr.act === 'banishEach') return ['A', 'B'].flatMap((p) => (snap.deck?.[p] || []).slice(0, zp.zr.n).map((id: string) => ({ id, n: r.objs[id]?.name || id, zone: 'deck', own: p, ok: true })));
    if (zp.zr.act === 'divine') return [...(snap.board || []), ...(snap.hand?.A || []), ...(snap.hand?.B || [])].map((id: string) => { const ob = r.objs[id]; return { id, n: ob?.name || id, zone: ob?.type === 'zc' ? 'hand' : 'board', own: ob?.type === 'zc' ? ob.own : ob?.ctrl, ok: true }; });
    return [];
  }
  if (zp.zr.act === 'chrono') return (snap.board || []).filter((id: string) => r.objs[id]?.type === 'unit').map((id: string) => { const ob = r.objs[id]; const ok = ob?.ctrl === pl; return { id, n: ob?.name || id, zone: 'board', own: ob?.ctrl, ok, why: ok ? undefined : 'nem a saját unitod' }; });
  if (zp.zr.z === 'among') {
    /* a megnézett lapok: az előző "look at / reveal the top N" utasítás szerinti felső lapok a lépés lerakásakor */
    const inf = stepInfo(CS, s)!; const ins = interp(s, inf);
    const look = ins.slice(0, xi).reverse().map((x) => zoneRefOf(x.t, inf.c?.n)).find((z) => z && z.z === 'deck' && z.top);
    if (!look) return [];
    const lo = look.who === 'they' ? [pl === 'A' ? 'B' : 'A'] : [pl];
    return lo.flatMap((p) => (snap.deck?.[p] || []).slice(0, look.n).map((id: string) => { const ob = r.objs[id]; const why = zoneCheck(zp.zr, ob, pl, snap.ctx); return { id, n: ob?.name || id, zone: 'among', own: p, ok: !why, why: why || undefined }; }));
  }
  const owners = zp.zr.who === 'you' ? [pl] : zp.zr.who === 'they' ? [pl === 'A' ? 'B' : 'A'] : ['A', 'B'];
  return owners.flatMap((p) => ((snap as unknown as Record<string, Record<string, string[]> | undefined>)[zp.zr.z]?.[p] || []).map((id: string) => { const ob = r.objs[id]; const why = zoneCheck(zp.zr, ob, pl, snap.ctx); return { id, n: ob?.name || id, zone: zp.zr.z, own: p, ok: !why, why: why || undefined }; }));
}
