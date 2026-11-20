/* Combat damage kiosztás ellenőrzése, React nélkül (a CombatPanel és a unit tesztek használja).
   Core Rules 467.2 (Combat Damage Step), 815 (Tank), 826 (Backline), 438 (Prevent), 467.2.c.5 (a replacement a kiosztásra hat),
   467.2.c.8 és 467.2.c.9 (Tank és Backline ugyanazon a uniton: a kiosztó választ), 467.2.c.10 (nem sebezhető unit). */

export type Side = 'me' | 'opp';
export type Opt = { tank: boolean; back: boolean; bonus: number; prev: number; nodmg: boolean; repl: boolean; stay: boolean; note: string };
export type Sug = { k: 'tank' | 'back' | 'bonus' | 'prev' | 'repl' | 'nodmg'; v?: number; src: string; txt: string; spell?: boolean };
/** ctrl: a unit controllere (2v2 és FFA esetén egy oldalon több controller is lehet); ha hiányzik, az oldal számít. */
export type CU = { id: string; uid: string; n: string; side: Side; ctrl?: string; m: number | null; dmg: number; stun: boolean; opt: Opt; sugs: Sug[] };
const ctrlOf = (u: CU) => u.ctrl ?? u.side;
export type Err = { msg: string; r: string };
export const ALL = 99;
export const DEF_OPT: Opt = { tank: false, back: false, bonus: 0, prev: 0, nodmg: false, repl: false, stay: true, note: '' };

export const cm = (u: CU) => (u.m == null ? null : u.m + u.opt.bonus);
/** Lethal küszöb: marked damage-dzsel együtt legalább a Might, nem nulla (142.4.a, 142.4.b), plusz a Prevent érték (467.2.c.5, 438.5.a).
    Nem sebezhető unitnál és "minden damage megelőzése" esetén nincs elérhető lethal (Infinity). */
export const need = (u: CU): number | null => {
  if (u.opt.nodmg || u.opt.prev >= ALL) return Infinity;
  const m = cm(u); return m == null ? null : Math.max(1, Math.max(1, m) - u.dmg) + u.opt.prev;
};
/** Csak a ténylegesen nem sebezhető unit mentes a kötelező kiosztás alól (467.2.c.10). A megelőzés (például Counter Strike) nem ad mentességet. */
export const exempt = (u: CU) => u.opt.nodmg;
/** Kiosztási prioritás a javaslathoz: Tank előbb (815.1.b), Backline utoljára (826.3), a nem sebezhető unit kívül esik a kötelező sorrenden.
    Több controller esetén a javaslat ezt egyben alkalmazza; az ellenőrzés (check) controllerenként nézi. */
export const tier = (u: CU) => (exempt(u) ? 3 : u.opt.tank ? 0 : u.opt.back ? 2 : 1);

function check1(recv: CU[], asg: Record<string, number>, pool: number): Err[] {
  const out: Err[] = [];
  const a = (u: CU) => asg[u.id] || 0;
  const unk = recv.filter((u) => need(u) == null);
  if (unk.length) { out.push({ msg: 'Ismeretlen Might: ' + unk.map((u) => u.n).join(', ') + '. Add meg a builderben, enélkül a lethal damage nem számolható.', r: '142.4.b' }); return out; }
  const sum = recv.reduce((s, u) => s + a(u), 0);
  if (sum !== pool) out.push({ msg: 'A kiosztott damage összesen ' + sum + ', de az összesített Might ' + pool + '. Pontosan ennyit kell kiosztani.', r: '467.2.c' });
  const norm = recv.filter((u) => !exempt(u));
  const short = norm.filter((u) => a(u) < need(u)!);
  const partial = norm.filter((u) => a(u) > 0 && a(u) < need(u)!);
  if (partial.length > 1) out.push({ msg: 'Több unit is kapott damage-et lethal alatt: ' + partial.map((u) => u.n + ' (' + a(u) + '/' + (need(u) === Infinity ? 'nincs lethal' : need(u)) + ')').join(', ') + '. Egy unit lethal damage-ét teljesen ki kell osztani, mielőtt a következő kap.', r: '467.2.c.3' });
  if (short.length) {
    const over = norm.filter((u) => a(u) > need(u)!);
    if (over.length) out.push({ msg: over.map((u) => u.n + ' ' + a(u) + ' damage-et kapott, a lethalhoz ' + need(u) + ' elég').join('; ') + ', miközben ' + short.map((u) => u.n).join(', ') + ' még nem kapott lethal damage-et.', r: '467.2.c.4' });
    const ex = recv.filter((u) => exempt(u) && a(u) > 0);
    if (ex.length) out.push({ msg: ex.map((u) => u.n).join(', ') + ' nem sebezhető: rá egyetlen damage sem lethal, és nem tartozik a kötelező kiosztásba, így nem kaphat damage-et, amíg ' + short.map((u) => u.n).join(', ') + ' nem kapott lethal damage-et.', r: '467.2.c.10, 467.2.c.4' });
  }
  for (const u of norm) {
    if (!a(u)) continue;
    // Tank és Backline csak az azonos controllerű unitok között ír elő sorrendet (815.1.b, 826.3)
    const tanks = norm.filter((x) => x !== u && ctrlOf(x) === ctrlOf(u) && x.opt.tank && a(x) < need(x)!);
    if (!u.opt.tank && tanks.length) out.push({ msg: u.n + ' Tank nélkül kapott damage-et, de ' + tanks.map((x) => x.n).join(', ') + ' (Tank) még nem kapott lethal damage-et.', r: '815.1.b, 815.1.c.2' });
    const fronts = norm.filter((x) => x !== u && ctrlOf(x) === ctrlOf(u) && !x.opt.back && a(x) < need(x)!);
    if (u.opt.back && !u.opt.tank && fronts.length) out.push({ msg: u.n + ' Backline unit, de ' + fronts.map((x) => x.n).join(', ') + ' (Backline nélkül) még nem kapott lethal damage-et.', r: '826.3, 826.4.b' });
  }
  return out;
}

/** Ellenőrzés. Tank és Backline ugyanazon a uniton: a kiosztó unitonként választja ki, melyik követelményt teljesíti (467.2.c.8, 467.2.c.9),
    ezért minden választást kipróbálunk; ha bármelyik szabályos, a kiosztás szabályos. */
export function check(recv: CU[], asg: Record<string, number>, pool: number): Err[] {
  const dual = recv.filter((u) => u.opt.tank && u.opt.back);
  if (!dual.length) return check1(recv, asg, pool);
  let first: Err[] | null = null;
  for (let mask = 0; mask < 1 << Math.min(dual.length, 6); mask++) {
    const v = recv.map((u) => { const k = dual.indexOf(u); if (k < 0) return u; const tank = !(mask >> k & 1); return { ...u, opt: { ...u.opt, tank, back: !tank } }; });
    const e = check1(v, asg, pool);
    if (!e.length) return [];
    if (!first) first = e;
  }
  return first!.concat([{ msg: 'Tank és Backline ugyanazon a uniton: egyik választással sem szabályos a kiosztás.', r: '467.2.c.8' }]);
}

export function suggest(recv: CU[], pool: number): Record<string, number> {
  const o: Record<string, number> = {};
  const ord = recv.map((u, i) => [u, i] as const).sort((x, y) => tier(x[0]) - tier(y[0]) || (need(x[0]) === Infinity ? 1 : 0) - (need(y[0]) === Infinity ? 1 : 0) || x[1] - y[1]).map((x) => x[0]);
  let left = pool;
  for (const u of ord) { if (exempt(u)) { o[u.id] = 0; continue; } const n = need(u) ?? 0; const g = Math.min(n, left); o[u.id] = g; left -= g; }
  if (left > 0 && ord.length) { const last = [...ord].reverse().find((u) => !exempt(u)) || ord[ord.length - 1]; o[last.id] += left; }
  return o;
}

/** Ténylegesen bekövetkező damage a Prevent után (438.2, 438.2.a). */
export const dealt = (u: CU, asg: Record<string, number>) => (u.opt.nodmg ? 0 : Math.max(0, (asg[u.id] || 0) - Math.min(u.opt.prev, ALL)));
export const lethalHit = (u: CU, asg: Record<string, number>) => { const m = cm(u); const t = u.dmg + dealt(u, asg); return !u.opt.nodmg && m != null && t > 0 && t >= m; };
