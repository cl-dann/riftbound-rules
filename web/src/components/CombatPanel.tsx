import { useEffect, useState } from 'react';
import { vsCard } from '../legacy/core';
import { chainApi, type TrigAdd } from '../legacy/chain';
import type { PBoard, PUnit } from './Playmat';

/* Combat damage kiosztás ellenőrzése a Core Rules 467.2 (Combat Damage Step), 815 (Tank), 826 (Backline),
   438 (Prevent) és 467.2.c.10 (nem sebezhető unit) alapján. A lapszövegből csak javaslatot teszünk, a döntés a játékosé. */

type Side = 'me' | 'opp';
type Opt = { tank: boolean; back: boolean; bonus: number; prev: number; nodmg: boolean; repl: boolean; stay: boolean; note: string };
type Sug = { k: 'tank' | 'back' | 'bonus' | 'prev' | 'repl' | 'nodmg'; v?: number; src: string; txt: string; spell?: boolean };
type CU = { id: string; uid: string; n: string; side: Side; m: number | null; dmg: number; stun: boolean; opt: Opt; sugs: Sug[] };
const ALL = 99;

const R = ({ r }: { r: string }) => (
  <span className="cbc-refs">{r.split(/,\s*/).map((x) => <a key={x} className="rref" href="#szabalyok" data-ref={x}>{x}</a>)}</span>
);

const txtOf = (n?: string | null): string => { const c: any = n ? vsCard(n) : null; return (c && c.txt) || ''; };
const clean = (l: string) => l.replace(/\([^()]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const sentences = (t: string) => t.split('\n').map(clean).filter(Boolean).flatMap((l) => l.split(/(?<=\.)\s+(?=[A-Z[])/));
const KW_LINE = /^\[(Tank|Backline|Assault|Shield)(?: (\d+))?\]/;

/** Nyomtatott, sor eleji keywordök. */
function kwOf(n: string, role: 'atk' | 'def'): Partial<Opt> {
  const lines = txtOf(n).split('\n');
  const val = (k: string) => { for (const l of lines) { const m = KW_LINE.exec(l); if (m && m[1] === k) return m[2] ? +m[2] : 1; } return 0; };
  return { tank: !!val('Tank'), back: !!val('Backline'), bonus: role === 'atk' ? val('Assault') : val('Shield') };
}

/** Javaslatok egy mondatból: feltételes vagy kapott keyword, Prevent, replacement, nem sebezhető. */
function sugFrom(src: string, s: string, role: 'atk' | 'def', own: boolean): Sug[] {
  const out: Sug[] = [];
  if (own && KW_LINE.test(s) && s.replace(KW_LINE, '').trim().length < 2) return out; // ez a sor eleji keyword, már be van számolva
  if (/\[Tank\]/.test(s)) out.push({ k: 'tank', src, txt: s });
  if (/\[Backline\]/.test(s)) out.push({ k: 'back', src, txt: s });
  const b = new RegExp('\\[' + (role === 'atk' ? 'Assault' : 'Shield') + '(?: (\\d+))?\\]').exec(s);
  if (b && !new RegExp('\\b(my|its|their) \\[' + (role === 'atk' ? 'Assault' : 'Shield')).test(s)) out.push({ k: 'bonus', v: b[1] ? +b[1] : 1, src, txt: s });
  const p = /\bprevent (?:the next )?(\d+|all)\b/i.exec(s);
  if (p) out.push({ k: 'prev', v: /all/i.test(p[1]) ? ALL : +p[1], src, txt: s });
  if (/can.t be dealt damage|cannot be dealt damage/i.test(s)) out.push({ k: 'nodmg', src, txt: s });
  if (/\binstead\b|would die|would be killed/i.test(s) && !p) out.push({ k: 'repl', src, txt: s });
  return out;
}

const cm = (u: CU) => (u.m == null ? null : u.m + u.opt.bonus);
/** Lethal küszöb: marked damage-dzsel együtt legalább a Might, nem nulla (142.4.a, 142.4.b), plusz a Prevent érték (438.5.a).
    Nem sebezhető unitnál és Prevent All esetén nincs lethal (467.2.c.10, 438.5.b). */
const need = (u: CU): number | null => {
  if (u.opt.nodmg || u.opt.prev >= ALL) return Infinity;
  const m = cm(u); return m == null ? null : Math.max(1, Math.max(1, m) - u.dmg) + u.opt.prev;
};
const exempt = (u: CU) => need(u) === Infinity;
/** Kiosztási prioritás: Tank előbb (815.1.b), Backline utoljára (826.3), a nem sebezhető unit kívül esik a kötelező sorrenden. */
const tier = (u: CU) => (exempt(u) ? 3 : u.opt.tank ? 0 : u.opt.back ? 2 : 1);

function check(recv: CU[], asg: Record<string, number>, pool: number): { msg: string; r: string }[] {
  const out: { msg: string; r: string }[] = [];
  const a = (u: CU) => asg[u.id] || 0;
  const unk = recv.filter((u) => need(u) == null);
  if (unk.length) { out.push({ msg: 'Ismeretlen Might: ' + unk.map((u) => u.n).join(', ') + '. Add meg a builderben, enélkül a lethal damage nem számolható.', r: '142.4.b' }); return out; }
  const sum = recv.reduce((s, u) => s + a(u), 0);
  if (sum !== pool) out.push({ msg: 'A kiosztott damage összesen ' + sum + ', de az összesített Might ' + pool + '. Pontosan ennyit kell kiosztani.', r: '467.2.c' });
  const norm = recv.filter((u) => !exempt(u));
  const short = norm.filter((u) => a(u) < need(u)!);
  const partial = norm.filter((u) => a(u) > 0 && a(u) < need(u)!);
  if (partial.length > 1) out.push({ msg: 'Több unit is kapott damage-et lethal alatt: ' + partial.map((u) => u.n + ' (' + a(u) + '/' + need(u) + ')').join(', ') + '. Egy unit lethal damage-ét teljesen ki kell osztani, mielőtt a következő kap.', r: '467.2.c.3' });
  if (short.length) {
    const over = norm.filter((u) => a(u) > need(u)!);
    if (over.length) out.push({ msg: over.map((u) => u.n + ' ' + a(u) + ' damage-et kapott, a lethalhoz ' + need(u) + ' elég').join('; ') + ', miközben ' + short.map((u) => u.n).join(', ') + ' még nem kapott lethal damage-et.', r: '467.2.c.4' });
    const ex = recv.filter((u) => exempt(u) && a(u) > 0);
    if (ex.length) out.push({ msg: ex.map((u) => u.n).join(', ') + ' nem sebezhető (vagy minden damage-et megelőz): rá egyetlen damage sem lethal, és nem tartozik a kötelező kiosztásba, így nem kaphat damage-et, amíg ' + short.map((u) => u.n).join(', ') + ' nem kapott lethal damage-et.', r: exempt(ex[0]) && ex[0].opt.nodmg ? '467.2.c.10, 467.2.c.4' : '438.5.b, 467.2.c.4' });
  }
  for (const u of norm) {
    if (!a(u)) continue;
    const tanks = norm.filter((x) => x !== u && x.opt.tank && a(x) < need(x)!);
    if (!u.opt.tank && tanks.length) out.push({ msg: u.n + ' Tank nélkül kapott damage-et, de ' + tanks.map((x) => x.n).join(', ') + ' (Tank) még nem kapott lethal damage-et.', r: '815.1.b, 815.1.c.2' });
    const fronts = norm.filter((x) => x !== u && !x.opt.back && a(x) < need(x)!);
    if (u.opt.back && !u.opt.tank && fronts.length) out.push({ msg: u.n + ' Backline unit, de ' + fronts.map((x) => x.n).join(', ') + ' (Backline nélkül) még nem kapott lethal damage-et.', r: '826.3, 826.4.b' });
  }
  return out;
}

function suggest(recv: CU[], pool: number): Record<string, number> {
  const o: Record<string, number> = {};
  const ord = recv.map((u, i) => [u, i] as const).sort((x, y) => tier(x[0]) - tier(y[0]) || x[1] - y[1]).map((x) => x[0]);
  let left = pool;
  for (const u of ord) { if (exempt(u)) { o[u.id] = 0; continue; } const n = need(u) ?? 0; const g = Math.min(n, left); o[u.id] = g; left -= g; }
  if (left > 0 && ord.length) { const last = [...ord].reverse().find((u) => !exempt(u)) || ord[ord.length - 1]; o[last.id] += left; }
  return o;
}

/** Ténylegesen bekövetkező damage a Prevent után (438.2, 438.2.a). */
const dealt = (u: CU, asg: Record<string, number>) => (u.opt.nodmg ? 0 : Math.max(0, (asg[u.id] || 0) - Math.min(u.opt.prev, ALL)));
const lethalHit = (u: CU, asg: Record<string, number>) => { const m = cm(u); const t = u.dmg + dealt(u, asg); return !u.opt.nodmg && m != null && t > 0 && t >= m; };

const SUG_L: Record<Sug['k'], string> = { tank: 'Lehet Tank', back: 'Lehet Backline', bonus: 'Lehet', prev: 'Sebzés-megelőzés', repl: 'Replacement effect', nodmg: 'Lehet nem sebezhető' };

function UnitExtra({ u, role, setOpt }: { u: CU; role: 'atk' | 'def'; setOpt: (id: string, o: Partial<Opt>) => void }) {
  const on = (s: Sug) => s.k === 'tank' ? u.opt.tank : s.k === 'back' ? u.opt.back : s.k === 'bonus' ? u.opt.bonus >= (s.v || 1) : s.k === 'prev' ? u.opt.prev >= (s.v || 1) : s.k === 'nodmg' ? u.opt.nodmg : u.opt.repl;
  const apply = (s: Sug) => setOpt(u.id, s.k === 'tank' ? { tank: true } : s.k === 'back' ? { back: true } : s.k === 'bonus' ? { bonus: Math.max(u.opt.bonus, s.v || 1) } : s.k === 'prev' ? { prev: s.v || 1 } : s.k === 'nodmg' ? { nodmg: true } : { repl: true });
  const lbl = (s: Sug) => s.k === 'bonus' ? 'Lehet ' + (role === 'atk' ? 'Assault ' : 'Shield ') + s.v : s.k === 'prev' ? 'Sebzés-megelőzés ' + (s.v! >= ALL ? 'minden' : s.v) : SUG_L[s.k];
  const extra = u.opt.prev > 0 || u.opt.nodmg || u.opt.repl;
  return (
    <div className="cbc-x">
      {u.sugs.length > 0 && (
        <ul className="cbc-sugs">{u.sugs.map((s, k) => (
          <li key={k}>
            <span className="cbuns">javaslat</span> <b>{lbl(s)}:</b> <span className="cl" data-card={s.src}>{s.src}</span>{s.spell ? ' (lefutott spell, ha erre a unitra célozta)' : ''}, "{s.txt}"
            {on(s) ? <span className="cbc-on">bekapcsolva</span> : <button type="button" className="btn sec cbc-apply" onClick={() => apply(s)}>Bekapcsol</button>}
          </li>
        ))}</ul>
      )}
      <details className="cbc-more" open={extra || undefined}>
        <summary>Megelőzés, replacement, nem sebezhető</summary>
        <div className="cbc-mrow">
          <label>Sebzés-megelőzés <input type="number" min={0} max={ALL} value={u.opt.prev} aria-label={u.n + ' sebzés-megelőzés'} onChange={(e) => setOpt(u.id, { prev: Math.max(0, +e.target.value || 0) })} /></label>
          <label className="chk"><input type="checkbox" checked={u.opt.nodmg} onChange={(e) => setOpt(u.id, { nodmg: e.target.checked })} /> nem sebezhető (467.2.c.10)</label>
          <label className="chk"><input type="checkbox" checked={u.opt.repl} onChange={(e) => setOpt(u.id, { repl: e.target.checked })} /> Nem hal meg, helyette...</label>
          {u.opt.repl && (
            <>
              <select value={u.opt.stay ? '1' : '0'} aria-label={u.n + ' helyettesítő hatás'} onChange={(e) => setOpt(u.id, { stay: e.target.value === '1' })}>
                <option value="1">a battlefielden marad</option>
                <option value="0">elhagyja a battlefieldet</option>
              </select>
              <input type="text" value={u.opt.note} placeholder="mi történik helyette" aria-label={u.n + ' megjegyzés'} onChange={(e) => setOpt(u.id, { note: e.target.value })} />
            </>
          )}
        </div>
      </details>
    </div>
  );
}

function SideTable({ title, units, role, asg, setAsg, setOpt, bonusLbl, assigner, pool, errs }: {
  title: string; units: CU[]; role: 'atk' | 'def'; asg: Record<string, number>; setAsg: (id: string, v: number) => void; setOpt: (id: string, o: Partial<Opt>) => void;
  bonusLbl: string; assigner: string; pool: number; errs: { msg: string; r: string }[];
}) {
  const sum = units.reduce((s, u) => s + (asg[u.id] || 0), 0);
  return (
    <div className="cbc-side">
      <h4>{title}</h4>
      <p className="note">{assigner} osztja ki rájuk: <b>{pool}</b> damage, kiosztva <b className={sum === pool ? 'stok' : 'stbad'}>{sum}</b>.</p>
      <div className="cbc-scroll">
      <table className="cbc-t">
        <thead><tr><th>Unit</th><th title="Combat Might: Might plusz a beírt bónusz">Might</th><th>{bonusLbl}</th><th>Tank</th><th>Backline</th><th title="Már rajta lévő damage">Dmg</th><th title="Ennyi kell a lethalhoz">Lethal</th><th>Kiosztva</th></tr></thead>
        {units.map((u) => { const nd = need(u); return (
          <tbody key={u.id} className="cbc-u">
            <tr className={u.stun ? 'stun' : ''}>
              <td><span className="cl" data-card={u.n}>{u.n}</span>{u.stun && <span className="cbc-tag" title="424.1.b">stunned</span>}</td>
              <td data-l="Might">{cm(u) ?? '?'}</td>
              <td data-l={bonusLbl}><input type="number" min={0} max={20} value={u.opt.bonus} aria-label={u.n + ' ' + bonusLbl} onChange={(e) => setOpt(u.id, { bonus: Math.max(0, +e.target.value || 0) })} /></td>
              <td data-l="Tank"><input type="checkbox" checked={u.opt.tank} aria-label={u.n + ' Tank'} onChange={(e) => setOpt(u.id, { tank: e.target.checked })} /></td>
              <td data-l="Backline"><input type="checkbox" checked={u.opt.back} aria-label={u.n + ' Backline'} onChange={(e) => setOpt(u.id, { back: e.target.checked })} /></td>
              <td data-l="Dmg">{u.dmg || 0}</td>
              <td data-l="Lethal" title={nd === Infinity ? 'Nincs lethal: nem sebezhető vagy minden damage-et megelőz' : ''}>{nd === Infinity ? 'nincs' : nd ?? '?'}</td>
              <td data-l="Kiosztva" className="cbc-as"><input type="number" min={0} max={60} value={asg[u.id] || 0} aria-label={u.n + ' kiosztott damage'} onChange={(e) => setAsg(u.id, Math.max(0, +e.target.value || 0))} /></td>
            </tr>
            <tr className="cbc-xr"><td colSpan={8}><UnitExtra u={u} role={role} setOpt={setOpt} /></td></tr>
          </tbody>
        ); })}
      </table>
      </div>
      {errs.length ? (
        <ul className="cbc-err">{errs.map((e, k) => <li key={k}><R r={e.r} /><span><span className="stbad">Szabálytalan:</span> {e.msg}</span></li>)}</ul>
      ) : <p className="cbc-ok"><R r="467.2.c" /><span className="stok">A kiosztás szabályos.</span></p>}
    </div>
  );
}

const DEF_OPT: Opt = { tank: false, back: false, bonus: 0, prev: 0, nodmg: false, repl: false, stay: true, note: '' };

export function CombatPanel({ board, frameLabel, bfi, isLast = true }: { board: PBoard; frameLabel: string; bfi?: number[]; isLast?: boolean }) {
  const bfs = board.bfs;
  const firstContested = Math.max(0, bfs.findIndex((f) => (f.me || []).length && (f.opp || []).length));
  const [bi, setBi] = useState(firstContested);
  const f = bfs[Math.min(bi, bfs.length - 1)];
  const [atk, setAtk] = useState<Side>(f?.ctrl === 'me' ? 'opp' : 'me');
  const [opts, setOpts] = useState<Record<string, Partial<Opt>>>({});
  const [asg, setAsgS] = useState<Record<string, number>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const sig = JSON.stringify(f || null);
  useEffect(() => { setAsgS({}); setAdded({}); }, [sig, atk]);
  useEffect(() => { setAtk(f?.ctrl === 'me' ? 'opp' : 'me'); }, [bi]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Javaslatforrások: a unit saját szövege, a rá csatolt gear, a saját oldal többi lapja ezen a battlefielden és a legend
      (csak "here", "friendly", "your", "other" hatókörű mondat), a battlefield lap, valamint a trashben lévő, lefutott spellek. */
  const sugsFor = (u: PUnit, side: Side, role: 'atk' | 'def'): Sug[] => {
    const out: Sug[] = [];
    const add = (src: string | undefined | null, own: boolean, scoped: boolean) => {
      if (!src) return;
      for (const s of sentences(txtOf(src))) {
        if (scoped && !/\b(here|friendly|your|other|units at)\b/i.test(s)) continue;
        if (!own && !scoped && !/\b(give|gets?|has|have|prevent)\b/i.test(s)) continue;
        out.push(...sugFrom(src, s, role, own));
      }
    };
    add(u.n, true, false);
    (u.gear || []).forEach((g) => add(g, false, false));
    ((f?.[side] || []) as PUnit[]).filter((x) => x.id !== u.id).forEach((x) => add(x.n, false, true));
    add(board[side].legend, false, true);
    add(f?.name, false, true);
    const n0 = out.length;
    [...(board.me.trash || []), ...(board.opp.trash || [])].forEach((t) => { const c: any = vsCard(t); if (c && c.t === 'Spell') add(t, false, false); });
    out.slice(n0).forEach((s) => { s.spell = true; });
    const seen = new Set<string>();
    return out.filter((s) => { const k = s.k + '|' + s.src + '|' + s.txt; if (seen.has(k)) return false; seen.add(k); return true; });
  };

  const mk = (u: PUnit, side: Side): CU | null => {
    if (u.kind === 'gear' || (u.status || []).includes('dying')) return null;
    const role = side === atk ? 'atk' : 'def';
    const uid = u.id || u.n;
    const id = uid + ':' + side;
    const o: Opt = { ...DEF_OPT, ...kwOf(u.n, role), ...(opts[id + ':' + role] || {}) };
    return { id, uid, n: u.n, side, m: (u.mods || []).includes('Might ismeretlen') ? null : u.m, dmg: u.dmg || 0, stun: (u.status || []).includes('stunned'), opt: o, sugs: sugsFor(u, side, role) };
  };
  const units = (side: Side) => ((f?.[side] || []) as PUnit[]).map((u) => mk(u, side)).filter(Boolean) as CU[];
  const A = units(atk), D = units(atk === 'me' ? 'opp' : 'me');
  const poolOf = (us: CU[]) => us.reduce((s, u) => s + (u.stun ? 0 : Math.max(0, cm(u) ?? 0)), 0);
  const pA = poolOf(A), pD = poolOf(D);
  const setAsg = (id: string, v: number) => setAsgS((x) => ({ ...x, [id]: v }));
  const setOpt = (id: string, o: Partial<Opt>) => { const role = A.some((u) => u.id === id) ? 'atk' : 'def'; setOpts((x) => ({ ...x, [id + ':' + role]: { ...(x[id + ':' + role] || {}), ...o } })); };
  const eD = check(D, asg, pA);
  const eA = check(A, asg, pD);
  const who = (s: Side) => (s === 'me' ? 'Te' : 'Ellenfél');
  const def: Side = atk === 'me' ? 'opp' : 'me';
  const any = Object.keys(asg).length > 0;
  const ok = any && !eD.length && !eA.length;
  const hit = (u: CU) => lethalHit(u, asg);
  const dies = (u: CU) => hit(u) && !u.opt.repl;
  const leaves = (u: CU) => hit(u) && u.opt.repl && !u.opt.stay;
  const stays = (u: CU) => !dies(u) && !leaves(u);
  const sA = A.filter(stays), sD = D.filter(stays);

  const result: { t: string; r: string }[] = [];
  const trig: (TrigAdd & { key: string; r: string })[] = [];
  let winner: Side | null = null; let conquer = false;
  if (ok) {
    const dead = [...A, ...D].filter(dies);
    result.push({ t: dead.length ? 'Meghal a Combat Cleanupban: ' + dead.map((u) => u.n + ' (' + who(u.side) + ', ' + (u.dmg + dealt(u, asg)) + ' damage, Might ' + cm(u) + ')').join(', ') + '.' : 'Senki nem hal meg.', r: '467.2.d, 323.4, 142.4.b' });
    const prevd = [...A, ...D].filter((u) => !u.opt.nodmg && u.opt.prev > 0 && (asg[u.id] || 0) > 0);
    if (prevd.length) result.push({ t: 'Megelőzött damage: ' + prevd.map((u) => u.n + ' ' + Math.min(asg[u.id] || 0, u.opt.prev) + ' damage-et megelőz, ' + dealt(u, asg) + ' marad').join('; ') + '.', r: '438.2, 438.5' });
    const nd = [...A, ...D].filter((u) => u.opt.nodmg && (asg[u.id] || 0) > 0);
    if (nd.length) result.push({ t: nd.map((u) => u.n).join(', ') + ' nem sebezhető: a ráosztott damage nem okoz halált.', r: '467.2.c.10' });
    const rp = [...A, ...D].filter((u) => hit(u) && u.opt.repl);
    if (rp.length) result.push({ t: 'Halál helyett replacement effect: ' + rp.map((u) => u.n + (u.opt.note ? ' (' + u.opt.note + ')' : '') + (u.opt.stay ? ', a battlefielden marad' : ', elhagyja a battlefieldet')).join('; ') + '. Mivel nem kerül a trashbe, a Deathknell nem triggerel.', r: '369.1, 808.1.d.1' });
    if (sA.length || sD.length) result.push({ t: 'A túlélők damage-e a Combat Cleanupban gyógyul.', r: '468.1.a.1' });
    const ctrl = f?.ctrl || null;
    const takes = (s: Side) => { winner = s; conquer = ctrl !== s; return ctrl === s
      ? who(s) + ' már irányítja a battlefieldet, ezért nincs Conquer.'
      : who(s) + ' Establishes Control. Ez Conquer, ha ' + (s === 'me' ? 'ebben a körben még nem scoroltad' : 'az ellenfél ebben a körben még nem scorolta') + ' ezt a battlefieldet. Ezt a panel nem tudja, a játékos dönti el.'; };
    if (sA.length && sD.length) result.push({ t: 'Mindkét oldalon marad unit: az attackerek recall-olódnak (' + sA.map((u) => u.n).join(', ') + '), az eredmény No Result. Utána csak a defender unitjai maradnak: ' + takes(def), r: '468.1.a.2, 468.3.d, 468.5, 468.5.d' });
    else if (sA.length) result.push({ t: who(atk) + ' (attacker) nyeri a combatot. ' + takes(atk), r: '468.3.a, 468.5, 468.5.d, 471.1' });
    else if (sD.length) result.push({ t: who(def) + ' (defender) nyeri a combatot. ' + takes(def), r: '468.3.a, 468.5, 468.5.d' });
    else result.push({ t: 'Egyik oldalon sem marad unit: No Result, a battlefield Uncontrolled lesz.', r: '468.3.d, 468.5.b' });
    result.push({ t: 'Combat nem ad Holdot: Hold csak a Beginning Phase-ben történik.', r: '471.2' });

    // Ezután triggerel: Deathknell a meghaló unitokon, Conquer a conquerelő játékos lapjain
    const realBf = bfi?.[Math.min(bi, bfs.length - 1)] ?? 0;
    const loc = 'bf' + realBf;
    for (const u of dead) for (const l of txtOf(u.n).split('\n')) {
      const m = /^\[Deathknell\]\s*(?:\[>\])?\s*[^A-Za-z[]*\s*(.*)$/.exec(clean(l));
      if (m) trig.push({ key: 'dk:' + u.id, n: u.n, src: u.uid, pl: u.side === 'me' ? 'A' : 'B', eff: m[1], why: 'Deathknell', loc, r: '808.1.c' });
    }
    const w = winner as Side | null;
    if (w && conquer) {
      const pl = w === 'me' ? 'A' : 'B';
      const present = (w === atk ? (sD.length ? [] : sA) : sD);
      for (const u of present) for (const l of txtOf(u.n).split('\n').map(clean)) {
        const m = /^When I conquer[^,]*,\s*(.*)$/i.exec(l); if (m) trig.push({ key: 'ci:' + u.id + l, n: u.n, src: u.uid, pl, eff: m[1], why: 'Conquer', loc, r: '383.4.c.2.a' });
        const h = /^\[Hunt(?: (\d+))?\]/.exec(l); if (h) trig.push({ key: 'hu:' + u.id, n: u.n, src: u.uid, pl, eff: 'my controller gains ' + (h[1] || 1) + ' XP.', why: 'Hunt (Conquer)', loc, r: '823.1.b, 823.1.c.1' });
      }
      const mine: { n: string; src: string }[] = [];
      const pushU = (x: PUnit) => { mine.push({ n: x.n, src: x.id || '' }); (x.gear || []).forEach((g) => mine.push({ n: g, src: '' })); };
      (board[w].base || []).forEach(pushU);
      bfs.forEach((b) => ((b[w] || []) as PUnit[]).forEach(pushU));
      if (board[w].legend) mine.push({ n: board[w].legend!, src: 'L' + pl });
      for (const c of mine) for (const l of txtOf(c.n).split('\n').map(clean)) {
        const m = /^When you conquer(?! here)[^,]*,\s*(.*)$/i.exec(l); if (m) trig.push({ key: 'cy:' + c.n + c.src + l, n: c.n, src: c.src, pl, eff: m[1], why: 'Conquer', loc, r: '383.4.c.2.b' });
      }
      for (const l of txtOf(f?.name).split('\n').map(clean)) {
        const m = /^When you conquer here[^,]*,\s*(.*)$/i.exec(l); if (m && f) trig.push({ key: 'bf:' + l, n: f.name, src: '', pl, eff: m[1], why: 'Conquer', loc, r: '383.4.c.2.b' });
      }
    }
  }
  const cbOut = () => {
    const realBf = bfi?.[Math.min(bi, bfs.length - 1)] ?? 0;
    const both = sA.length > 0 && sD.length > 0;
    const w = winner as Side | null;
    return {
      bf: 'bf' + realBf,
      dead: [...A, ...D].filter(dies).map((u) => u.uid),
      recall: both ? sA.map((u) => u.uid) : [],
      ctrl: (w && conquer ? (w === 'me' ? 'A' : 'B') : '') as '' | 'A' | 'B',
      label: (f?.name || '') + ', ' + who(atk) + ' támad',
    };
  };
  const addTrig = (list: (TrigAdd & { key: string })[]) => {
    chainApi.addTriggers?.(list.map(({ key: _k, ...t }) => t), cbOut()); // eslint-disable-line @typescript-eslint/no-unused-vars
    setAdded((x) => ({ ...x, ...Object.fromEntries(list.map((t) => [t.key, true])) }));
  };

  if (!bfs.length) return null;
  const contested = A.length > 0 && D.length > 0;
  return (
    <details className="panel pad cbc" open>
      <summary><h2>Combat kiosztás</h2></summary>
      <p className="note">A lejátszás aktuális lépésének boardjából: <b>{frameLabel}</b>. Válaszd ki a battlefieldet és az attackert, majd oszd ki a damage-et, vagy kérj szabályos javaslatot.</p>
      <div className="cbc-ctl">
        <label>Battlefield <select value={bi} onChange={(e) => setBi(+e.target.value)}>{bfs.map((x, k) => <option key={k} value={k}>{x.name} ({(x.me || []).length} saját, {(x.opp || []).length} ellenfél unit)</option>)}</select></label>
        <label>Attacker <select value={atk} onChange={(e) => setAtk(e.target.value as Side)}><option value="me">Te</option><option value="opp">Ellenfél</option></select></label>
        <button type="button" className="btn sec" disabled={!contested} onClick={() => setAsgS({ ...suggest(D, pA), ...suggest(A, pD) })}>Szabályos javaslat</button>
        <button type="button" className="linkbtn" onClick={() => setAsgS({})}>Kiosztás törlése</button>
      </div>
      {!contested ? (
        <p className="note"><R r="463, 467.1" /> Ezen a battlefielden nincs mindkét oldalon unit, így itt nincs combat.</p>
      ) : (
        <>
          <p className="cbc-sum"><R r="467.2.a, 467.2.b, 424.1.b, 143.2.c, 807.1.c, 814.1.c" /> Attacker összesített Might: <b>{pA}</b> ({who(atk)}), defender összesített Might: <b>{pD}</b> ({who(def)}). Stunned unit nem ad damage-et, a negatív Might 0-nak számít. Az Assault csak attackernél, a Shield csak defendernél ad Mightot.</p>
          <div className="cbc-grid">
            <SideTable title={'Defender unitok (' + who(def) + ')'} units={D} role="def" asg={asg} setAsg={setAsg} setOpt={setOpt} bonusLbl="Shield" assigner={who(atk) + ' (attacker)'} pool={pA} errs={any ? eD : []} />
            <SideTable title={'Attacker unitok (' + who(atk) + ')'} units={A} role="atk" asg={asg} setAsg={setAsg} setOpt={setOpt} bonusLbl="Assault" assigner={who(def) + ' (defender)'} pool={pD} errs={any ? eA : []} />
          </div>
          {ok && (
            <div className="cbc-res"><b>Eredmény</b>
              <ul>{result.map((x, k) => <li key={k}><R r={x.r} /><span>{x.t}</span></li>)}</ul>
              <div className="cbc-trig">
                <b>Ezután triggerel</b>
                {trig.length ? (
                  <>
                    <ul>{trig.map((t) => (
                      <li key={t.key}><R r={t.r} /><span><span className="cl" data-card={t.n}>{t.n}</span> ({t.why}, {t.pl === 'A' ? 'te' : 'ellenfél'}): {t.eff}</span>
                        {added[t.key] ? <span className="cbc-on">hozzáadva</span> : <button type="button" className="btn sec cbc-apply" onClick={() => addTrig([t])}>Hozzáadás a Chainhez</button>}</li>
                    ))}</ul>
                    {trig.some((t) => !added[t.key]) && trig.length > 1 && <button type="button" className="linkbtn" onClick={() => addTrig(trig.filter((t) => !added[t.key]))}>Mind hozzáadása</button>}
                    {!isLast && <p className="note"><span className="cbuns">figyelem</span> A kiosztás nem a Végállapot lépés boardjából készült, a triggerek viszont a chain lefutása után jönnek. Pontosabb, ha a lejátszás utolsó lépésén osztod ki a damage-et.</p>}
                    <p className="note">A Conquer triggerek csak akkor jönnek, ha a kontrollszerzés valóban Conquer (ebben a körben még nem scorolta a battlefieldet). A felvett trigger a builder végére kerül: a chain lefutása után a lejátszás a fenti combat eredményt alkalmazza, majd a triggereket egy új chainen futtatja.</p>
                  </>
                ) : <p className="note">Nem látok Deathknell vagy Conquer triggert a meghaló, illetve a conquerelő játékos lapjain.</p>}
              </div>
            </div>
          )}
          <p className="note cbc-foot">
            A lethal küszöb a már rajta lévő damage-et és a Prevent értéket is beszámítja (142.4.a, 438.5.a). Az azonos prioritású unitok sorrendjét a kiosztó játékos választja (467.2.c.7), a javaslat a lista sorrendjét követi. A lapszövegből jövő javaslatokat (feltételes vagy kapott keyword, Prevent, replacement) a panel nem kapcsolja be magától: hogy él-e az adott helyzetben, azt a játékos dönti el.
            {[...A, ...D].some((u) => u.opt.tank && u.opt.back) && ' Tank és Backline ugyanazon a uniton: a kiosztó játékos választja ki, melyik érvényes (467.2.c.8); a panel Tankként számol.'}
          </p>
        </>
      )}
    </details>
  );
}
