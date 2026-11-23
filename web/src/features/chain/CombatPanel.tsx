import { useEffect, useRef, useState } from 'react';
import { vsCard } from '../../domain/data/store';
import { chainActions, getCS, type TrigAdd } from './store';
import { abilitiesFor } from './chainBuild';
import { combatTrigs, isCombatOpenTrig } from '../../domain/combat/combatTrig';
import type { ChainStep } from '../../domain/chain/state';
import type { PBoard, PUnit } from '../../shared/board/Playmat';
import { ALL, DEF_OPT, cm, need, check, suggest, dealt, lethalHit, type Side, type Opt, type Sug, type CU } from '../../domain/combat/combatCore';

/* Combat damage kiosztás: a szabálylogika a combatCore.ts-ben (unit tesztelt), itt a felület.
   A lapszövegből csak javaslatot teszünk, a döntés a játékosé. */

const R = ({ r }: { r: string }) => (
  <span className="cbc-refs">{r.split(/,\s*/).map((x) => <a key={x} className="rref" href="#szabalyok" data-ref={x}>{x}</a>)}</span>
);

const txtOf = (n?: string | null): string => { const c = n ? vsCard(n) : null; return (c && c.txt) || ''; };
const clean = (l: string) => l.replace(/\([^()]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const sentences = (t: string) => t.split('\n').map(clean).filter(Boolean).flatMap((l) => l.split(/(?<=\.)\s+(?=[A-Z[])/));
const KW_LINE = /^\[(Tank|Backline|Assault|Shield)(?: (\d+))?\]/;

/** Nyomtatott, sor eleji keywordök. */
function kwOf(n: string, role: 'atk' | 'def'): Partial<Opt> {
  const lines = txtOf(n).split('\n');
  const val = (k: string) => { for (const l of lines) { const m = KW_LINE.exec(l); if (m && m[1] === k) return m[2] ? +m[2] : 1; } return 0; };
  const t = txtOf(n);
  // "I must be assigned combat damage first/last." a Tank és a Backline szövege (815, 826), keyword nélkül is (például Caitlyn, Patrolling)
  return { tank: !!val('Tank') || /^I must be assigned combat damage first\./m.test(t), back: !!val('Backline') || /^I must be assigned combat damage last\./m.test(t), bonus: role === 'atk' ? val('Assault') : val('Shield') };
}

/** Javaslatok egy mondatból: feltételes vagy kapott keyword, Prevent, replacement, nem sebezhető. */
function sugFrom(src: string, s: string, role: 'atk' | 'def', own: boolean): Sug[] {
  const out: Sug[] = [];
  if (own && KW_LINE.test(s) && s.replace(KW_LINE, '').trim().length < 2) return out; // ez a sor eleji keyword, már be van számolva
  if (/\[Tank\]/.test(s)) out.push({ k: 'tank', src, txt: s });
  if (/\[Backline\]/.test(s)) out.push({ k: 'back', src, txt: s });
  const b = new RegExp('\\[' + (role === 'atk' ? 'Assault' : 'Shield') + '(?: (\\d+))?\\]').exec(s);
  if (b && !new RegExp('\\b(my|its|their) \\[' + (role === 'atk' ? 'Assault' : 'Shield')).test(s)) out.push({ k: 'bonus', v: b[1] ? +b[1] : 1, src, txt: s });
  const p = /\bprevent (?:the (?:next|first) )?(\d+|all|it)\b/i.exec(s);
  if (p) out.push({ k: 'prev', v: /all|it/i.test(p[1]) ? ALL : +p[1], src, txt: s });
  if (/can.t be dealt damage|cannot be dealt damage|don.t take damage|doesn.t take damage/i.test(s)) out.push({ k: 'nodmg', src, txt: s });
  if (/\binstead\b|would die|would be killed/i.test(s) && !p) out.push({ k: 'repl', src, txt: s });
  return out;
}

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
              <td data-l="Lethal" title={nd === Infinity ? (u.opt.nodmg ? 'Nincs lethal: nem sebezhető, ezért kimarad a kötelező kiosztásból (467.2.c.10)' : 'Nincs elérhető lethal (minden damage-et megelőz), de nem mentes a kötelező kiosztás alól (467.2.c.10)') : ''}>{nd === Infinity ? 'nincs' : nd ?? '?'}</td>
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

/** focus: a pályás építő "Combat itt" menüpontja: erre a battlefieldre és attackerre áll, és lenyitja a panelt. */
export function CombatPanel({ board, frameLabel, bfi, isLast = true, focus }: { board: PBoard; frameLabel: string; bfi?: number[]; isLast?: boolean; focus?: { bi: number; atk: Side; n: number } | null }) {
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
  const wantAtk = useRef<Side | null>(null);
  const det = useRef<HTMLDetailsElement>(null);
  useEffect(() => { setAtk(wantAtk.current || (f?.ctrl === 'me' ? 'opp' : 'me')); wantAtk.current = null; }, [bi]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!focus) return;
    if (focus.bi === bi) setAtk(focus.atk); else { wantAtk.current = focus.atk; setBi(focus.bi); }
    if (det.current) { det.current.open = true; det.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  }, [focus?.n]); // eslint-disable-line react-hooks/exhaustive-deps

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
    [...(board.me.trash || []), ...(board.opp.trash || [])].forEach((t) => { const c = vsCard(t); if (c && c.t === 'Spell') add(t, false, false); });
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
    /* "When I die in combat" a combatban meghaló unitokon */
    for (const u of dead) for (const t of combatTrigs(txtOf(u.n), 'dieInCombat')) trig.push({ key: 'dc:' + u.id, n: u.n, src: u.uid, pl: u.side === 'me' ? 'A' : 'B', eff: t.eff, why: 'When I die in combat', loc, r: '468.3.b, 383.2.c.3' });
    /* combat győzelem (468.3.a): csak ha egyedül a győztes játékosnak maradt unitja; No Result esetén nincs győztes (468.3.d) */
    const won: Side | null = sA.length && !sD.length ? atk : sD.length && !sA.length ? def : null;
    if (won) {
      const pl = won === 'me' ? 'A' : 'B';
      for (const u of (won === atk ? sA : sD)) for (const t of combatTrigs(txtOf(u.n), 'winI')) trig.push({ key: 'wi:' + u.id + t.line, n: u.n, src: u.uid, pl, eff: t.eff, why: 'When I win a combat', loc, r: '468.3.a, 468.3.c' });
      const wl = board[won].legend; const wc: { n: string; src: string }[] = wl ? [{ n: wl, src: 'L' + pl }] : [];
      (board[won].base || []).forEach((x) => wc.push({ n: x.n, src: x.id || '' })); bfs.forEach((b) => ((b[won] || []) as PUnit[]).forEach((x) => wc.push({ n: x.n, src: x.id || '' })));
      for (const c of wc) for (const t of combatTrigs(txtOf(c.n), 'winYou')) trig.push({ key: 'wy:' + c.n + c.src + t.line, n: c.n, src: c.src, pl, eff: t.eff, why: 'When you win a combat', loc, r: '468.3.a' });
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
    chainActions().addTriggers?.(list.map(({ key: _k, ...t }) => t), cbOut()); // eslint-disable-line @typescript-eslint/no-unused-vars
    setAdded((x) => ({ ...x, ...Object.fromEntries(list.map((t) => [t.key, true])) }));
  };

  if (!bfs.length) return null;
  const contested = A.length > 0 && D.length > 0;
  /* Attack és defend triggerek (383.4.e, 383.4.f): a combat megnyitásakor a chainre, előbb az attacker, utána a defender teszi fel (466.2.d.1) */
  const adTrig: { key: string; n: string; why: string; pl: 'A' | 'B'; st: ChainStep }[] = [];
  if (contested) for (const [u, role] of [...A.map((u) => [u, 'atk'] as const), ...D.map((u) => [u, 'def'] as const)]) {
    if (!/^(?:[bs]\d+|L[AB])$/.test(u.uid)) continue;
    const { c, trs } = abilitiesFor(getCS(), u.uid); if (!c) continue;
    trs.forEach((t, ti) => { const w = String(t.why || ''); const ok = isCombatOpenTrig(w, role);
      if (ok) adTrig.push({ key: 'ad:' + u.uid + ':' + ti, n: c.n, why: w, pl: u.side === 'me' ? 'A' : 'B', st: { k: 'tg', src: u.uid, ti, pl: u.side === 'me' ? 'A' : 'B', n: c.n, tg: [], ext: {} } }); });
  }
  const addAD = () => chainActions().commit((cs) => { const at = cs.steps.findIndex((x) => x.k === 'tr'); const ins = adTrig.map((t) => JSON.parse(JSON.stringify(t.st)) as ChainStep); cs.steps.splice(at < 0 ? cs.steps.length : at, 0, ...ins); setAdded((a) => ({ ...a, ...Object.fromEntries(adTrig.map((t) => [t.key, true])) })); });
  return (
    <details className="panel pad cbc cb2-blk" ref={det} id="cb-combat">
      <summary><h2>Combat kiosztás</h2><span className="note">damage kiosztás egy battlefielden</span></summary>
      <p className="note">A lejátszás aktuális lépésének boardjából: <b>{frameLabel}</b>. Válaszd ki a battlefieldet és az attackert, majd oszd ki a damage-et, vagy kérj szabályos javaslatot.</p>
      <div className="cbc-ctl">
        <label>Battlefield <select value={bi} onChange={(e) => setBi(+e.target.value)}>{bfs.map((x, k) => <option key={k} value={k}>{x.name || (k + 1) + '. battlefield'} ({(x.me || []).length} saját, {(x.opp || []).length} ellenfél unit)</option>)}</select></label>
        <label>Attacker <select value={atk} onChange={(e) => setAtk(e.target.value as Side)}><option value="me">Te</option><option value="opp">Ellenfél</option></select></label>
        <button type="button" className="btn sec" disabled={!contested} onClick={() => setAsgS({ ...suggest(D, pA), ...suggest(A, pD) })}>Szabályos javaslat</button>
        <button type="button" className="linkbtn danger" onClick={() => setAsgS({})}>Kiosztás törlése</button>
      </div>
      {!contested ? (
        <p className="note"><R r="463, 467.1" /> Ezen a battlefielden nincs mindkét oldalon unit, így itt nincs combat.</p>
      ) : (
        <>
          {adTrig.length > 0 && <div className="cbc-trig" data-ad="1"><b>A combat megnyitásakor triggerel</b>
            <ul>{adTrig.map((t) => <li key={t.key}><R r="383.4.e, 383.4.f, 466.2.d.1" /><span><span className="cl" data-card={t.n}>{t.n}</span> ({t.pl === 'A' ? 'te' : 'ellenfél'}): {t.why}</span>{added[t.key] && <span className="cbc-on">hozzáadva</span>}</li>)}</ul>
            {adTrig.some((t) => !added[t.key]) && <button type="button" className="btn sec cbc-apply" onClick={addAD}>Attack és defend triggerek a chainre</button>}
            <p className="note">A combat showdown chainje: a triggereket az attacker teszi fel először, utána a defender (466.2.d.1), ezért a defenderé resolve-ol előbb. A lépések a combat utáni triggerek elé kerülnek; a chain lefutása után jön a combat damage.</p></div>}
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
                ) : <p className="note">Nem látok Deathknell, Conquer vagy combat győzelemre szóló triggert a meghaló, a győztes, illetve a conquerelő játékos lapjain.</p>}
              </div>
            </div>
          )}
          <p className="note cbc-foot">
            A lethal küszöb a már rajta lévő damage-et és a Prevent értéket is beszámítja (142.4.a, 438.5.a). Az azonos prioritású unitok sorrendjét a kiosztó játékos választja (467.2.c.7), a javaslat a lista sorrendjét követi. A lapszövegből jövő javaslatokat (feltételes vagy kapott keyword, Prevent, replacement) a panel nem kapcsolja be magától: hogy él-e az adott helyzetben, azt a játékos dönti el.
            {[...A, ...D].some((u) => u.opt.tank && u.opt.back) && ' Tank és Backline ugyanazon a uniton: a kiosztó játékos unitonként választja ki, melyik követelményt teljesíti (467.2.c.8, 467.2.c.9); a panel mindkét választást elfogadja, a javaslat Tankként számol.'}
            {[...A, ...D].some((u) => !u.opt.nodmg && u.opt.prev >= ALL) && <> <span className="cbuns">nyitott kérdés</span> Minden damage-et megelőző unit nem mentes a kötelező kiosztás alól (467.2.c.10 példája), de lethal sem osztható rá. Hogy ilyenkor mennyit kell rá osztani, mielőtt a következő unit kaphat, a Core Rules nem mondja ki; a panel előbb a többi unit lethalját javasolja, a maradékot erre. <span className="cbalt"><b>1. értelmezés:</b> a unit a 467.2.c.3 szerint előbb megkapja a teljes kiosztható damage-et, mert lethal nem osztható rá, ezért a többi unit nem kap damage-et. <b>2. értelmezés:</b> a unit lethal hiányában kimarad a kötelező sorrendből, a többi unit kapja a lethalt (a panel javaslata).</span></>}
          </p>
        </>
      )}
    </details>
  );
}
