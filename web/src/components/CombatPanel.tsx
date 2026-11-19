import { useEffect, useState } from 'react';
import { vsCard } from '../legacy/core';
import type { PBoard, PUnit } from './Playmat';

/* Combat damage kiosztás ellenőrzése a Core Rules 467.2 (Combat Damage Step), 815 (Tank) és 826 (Backline) alapján.
   Ami a szabályzatból nem dönthető el (feltételes keywordök, replacement effectek, triggerek), azt a panel kiírja, de nem számolja. */

type Side = 'me' | 'opp';
type Opt = { tank: boolean; back: boolean; bonus: number };
type CU = { id: string; n: string; side: Side; m: number | null; dmg: number; stun: boolean; opt: Opt; cond: boolean };

const R = ({ r }: { r: string }) => (
  <span className="cbc-refs">{r.split(/,\s*/).map((x) => <a key={x} className="rref" href="#szabalyok" data-ref={x}>{x}</a>)}</span>
);

/** Nyomtatott, sor eleji keywordök a lap szövegéből; a feltételes vagy másnak adott keywordöt csak jelezzük. */
function kwOf(n: string, role: 'atk' | 'def'): { opt: Opt; cond: boolean } {
  const c: any = vsCard(n);
  const t: string = (c && c.txt) || '';
  const lines = t.split('\n');
  const head = (k: string) => lines.find((l) => new RegExp('^\\[' + k + '(?: (\\d+))?\\]').test(l));
  const val = (k: string) => { const l = head(k); if (!l) return 0; const m = new RegExp('^\\[' + k + '(?: (\\d+))?\\]').exec(l); return m && m[1] ? +m[1] : 1; };
  const cond = lines.some((l) => /\[(Tank|Backline|Assault|Shield)/.test(l) && !/^\[(Tank|Backline|Assault|Shield)/.test(l));
  return { opt: { tank: !!head('Tank'), back: !!head('Backline'), bonus: role === 'atk' ? val('Assault') : val('Shield') }, cond };
}

const cm = (u: CU) => (u.m == null ? null : u.m + u.opt.bonus);
/** Lethal küszöb: a már rajta lévő damage-dzsel együtt legalább a Might, és nem nulla (142.4.a, 142.4.b). */
const need = (u: CU) => { const m = cm(u); return m == null ? null : Math.max(1, Math.max(1, m) - u.dmg); };
/** Kiosztási prioritás: Tank előbb (815.1.b), Backline utoljára (826.3). Mindkettő esetén a Tank szerint számolunk. */
const tier = (u: CU) => (u.opt.tank ? 0 : u.opt.back ? 2 : 1);

function check(recv: CU[], asg: Record<string, number>, pool: number): { msg: string; r: string }[] {
  const out: { msg: string; r: string }[] = [];
  const a = (u: CU) => asg[u.id] || 0;
  const unk = recv.filter((u) => need(u) == null);
  if (unk.length) { out.push({ msg: 'Ismeretlen Might: ' + unk.map((u) => u.n).join(', ') + '. Add meg a builderben, enélkül a lethal damage nem számolható.', r: '142.4.b' }); return out; }
  const sum = recv.reduce((s, u) => s + a(u), 0);
  if (sum !== pool) out.push({ msg: 'A kiosztott damage összesen ' + sum + ', de az összesített Might ' + pool + '. Pontosan ennyit kell kiosztani.', r: '467.2.c' });
  const short = recv.filter((u) => a(u) < need(u)!);
  const partial = recv.filter((u) => a(u) > 0 && a(u) < need(u)!);
  if (partial.length > 1) out.push({ msg: 'Több unit is kapott damage-et lethal alatt: ' + partial.map((u) => u.n + ' (' + a(u) + '/' + need(u) + ')').join(', ') + '. Egy unit lethal damage-ét teljesen ki kell osztani, mielőtt a következő kap.', r: '467.2.c.3' });
  if (short.length) {
    const over = recv.filter((u) => a(u) > need(u)!);
    if (over.length) out.push({ msg: over.map((u) => u.n + ' ' + a(u) + ' damage-et kapott, a lethalhoz ' + need(u) + ' elég').join('; ') + ', miközben ' + short.map((u) => u.n).join(', ') + ' még nem kapott lethal damage-et.', r: '467.2.c.4' });
  }
  for (const u of recv) {
    if (!a(u)) continue;
    const tanks = recv.filter((x) => x !== u && x.opt.tank && a(x) < need(x)!);
    if (!u.opt.tank && tanks.length) out.push({ msg: u.n + ' Tank nélkül kapott damage-et, de ' + tanks.map((x) => x.n).join(', ') + ' (Tank) még nem kapott lethal damage-et.', r: '815.1.b, 815.1.c.2' });
    const fronts = recv.filter((x) => x !== u && !x.opt.back && a(x) < need(x)!);
    if (u.opt.back && !u.opt.tank && fronts.length) out.push({ msg: u.n + ' Backline unit, de ' + fronts.map((x) => x.n).join(', ') + ' (Backline nélkül) még nem kapott lethal damage-et.', r: '826.3, 826.4.b' });
  }
  return out;
}

function suggest(recv: CU[], pool: number): Record<string, number> {
  const o: Record<string, number> = {};
  const ord = recv.map((u, i) => [u, i] as const).sort((x, y) => tier(x[0]) - tier(y[0]) || x[1] - y[1]).map((x) => x[0]);
  let left = pool;
  for (const u of ord) { const n = need(u) ?? 0; const g = Math.min(n, left); o[u.id] = g; left -= g; }
  if (left > 0 && ord.length) o[ord[ord.length - 1].id] += left;
  return o;
}

function SideTable({ title, units, asg, setAsg, setOpt, bonusLbl, assigner, pool, errs }: {
  title: string; units: CU[]; asg: Record<string, number>; setAsg: (id: string, v: number) => void; setOpt: (id: string, o: Partial<Opt>) => void;
  bonusLbl: string; assigner: string; pool: number; errs: { msg: string; r: string }[];
}) {
  const sum = units.reduce((s, u) => s + (asg[u.id] || 0), 0);
  return (
    <div className="cbc-side">
      <h4>{title}</h4>
      <p className="note">{assigner} osztja ki rájuk: <b>{pool}</b> damage, kiosztva <b className={sum === pool ? 'stok' : 'stbad'}>{sum}</b>.</p>
      <table className="cbc-t">
        <thead><tr><th>Unit</th><th title="Combat Might: Might plusz a beírt bónusz">Might</th><th>{bonusLbl}</th><th>Tank</th><th>Backline</th><th title="Már rajta lévő damage">Dmg</th><th title="Ennyi kell a lethalhoz">Lethal</th><th>Kiosztva</th></tr></thead>
        <tbody>{units.map((u) => (
          <tr key={u.id} className={u.stun ? 'stun' : ''}>
            <td><span className="cl" data-card={u.n}>{u.n}</span>{u.stun && <span className="cbc-tag" title="424.1.b">stunned</span>}{u.cond && <span className="cbc-tag" title="A lap szövege feltételesen vagy más unitnak ad keywordöt. Ha él, jelöld be kézzel.">feltételes kw</span>}</td>
            <td>{cm(u) ?? '?'}</td>
            <td><input type="number" min={0} max={20} value={u.opt.bonus} aria-label={u.n + ' ' + bonusLbl} onChange={(e) => setOpt(u.id, { bonus: Math.max(0, +e.target.value || 0) })} /></td>
            <td><input type="checkbox" checked={u.opt.tank} aria-label={u.n + ' Tank'} onChange={(e) => setOpt(u.id, { tank: e.target.checked })} /></td>
            <td><input type="checkbox" checked={u.opt.back} aria-label={u.n + ' Backline'} onChange={(e) => setOpt(u.id, { back: e.target.checked })} /></td>
            <td>{u.dmg || 0}</td>
            <td>{need(u) ?? '?'}</td>
            <td><input type="number" min={0} max={60} value={asg[u.id] || 0} aria-label={u.n + ' kiosztott damage'} onChange={(e) => setAsg(u.id, Math.max(0, +e.target.value || 0))} /></td>
          </tr>
        ))}</tbody>
      </table>
      {errs.length ? (
        <ul className="cbc-err">{errs.map((e, k) => <li key={k}><R r={e.r} /><span><span className="stbad">Szabálytalan:</span> {e.msg}</span></li>)}</ul>
      ) : <p className="cbc-ok"><R r="467.2.c" /><span className="stok">A kiosztás szabályos.</span></p>}
    </div>
  );
}

export function CombatPanel({ board, frameLabel }: { board: PBoard; frameLabel: string }) {
  const bfs = board.bfs;
  const firstContested = Math.max(0, bfs.findIndex((f) => (f.me || []).length && (f.opp || []).length));
  const [bi, setBi] = useState(firstContested);
  const f = bfs[Math.min(bi, bfs.length - 1)];
  const [atk, setAtk] = useState<Side>(f?.ctrl === 'me' ? 'opp' : 'me');
  const [opts, setOpts] = useState<Record<string, Partial<Opt>>>({});
  const [asg, setAsgS] = useState<Record<string, number>>({});
  const sig = JSON.stringify(f || null);
  useEffect(() => { setAsgS({}); }, [sig, atk]);
  useEffect(() => { setAtk(f?.ctrl === 'me' ? 'opp' : 'me'); }, [bi]); // eslint-disable-line react-hooks/exhaustive-deps

  const mk = (u: PUnit, side: Side): CU | null => {
    if (u.kind === 'gear' || (u.status || []).includes('dying')) return null;
    const role = side === atk ? 'atk' : 'def';
    const k = kwOf(u.n, role);
    const id = (u.id || u.n) + ':' + side;
    const o = { ...k.opt, ...(opts[id + ':' + role] || {}) };
    return { id, n: u.n, side, m: (u.mods || []).includes('Might ismeretlen') ? null : u.m, dmg: u.dmg || 0, stun: (u.status || []).includes('stunned'), opt: o, cond: k.cond };
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
  const dies = (u: CU) => { const m = cm(u); const t = u.dmg + (asg[u.id] || 0); return m != null && t > 0 && t >= m; };
  const surv = (us: CU[]) => us.filter((u) => !dies(u));
  const sA = surv(A), sD = surv(D);
  const unknownMods = [...A, ...D].some((u) => u.cond);

  const result: { t: string; r: string }[] = [];
  if (ok) {
    const dead = [...A, ...D].filter(dies);
    result.push({ t: dead.length ? 'Meghal a Combat Cleanupban: ' + dead.map((u) => u.n + ' (' + who(u.side) + ', ' + (u.dmg + (asg[u.id] || 0)) + ' damage, Might ' + cm(u) + ')').join(', ') + '.' : 'Senki nem kap lethal damage-et.', r: '467.2.d, 323.4, 142.4.b' });
    if (sA.length || sD.length) result.push({ t: 'A túlélők damage-e a Combat Cleanupban gyógyul.', r: '468.1.a.1' });
    const ctrl = f?.ctrl || null;
    const takes = (s: Side) => ctrl === s
      ? who(s) + ' már irányítja a battlefieldet, ezért nincs Conquer.'
      : who(s) + ' Establishes Control. Ez Conquer, ha ' + (s === 'me' ? 'ebben a körben még nem scoroltad' : 'az ellenfél ebben a körben még nem scorolta') + ' ezt a battlefieldet. Ezt a panel nem tudja, a játékos dönti el.';
    if (sA.length && sD.length) result.push({ t: 'Mindkét oldalon marad unit: az attackerek recall-olódnak (' + sA.map((u) => u.n).join(', ') + '), az eredmény No Result. Utána csak a defender unitjai maradnak: ' + takes(def), r: '468.1.a.2, 468.3.d, 468.5, 468.5.d' });
    else if (sA.length) result.push({ t: who(atk) + ' (attacker) nyeri a combatot. ' + takes(atk), r: '468.3.a, 468.5, 468.5.d, 471.1' });
    else if (sD.length) result.push({ t: who(def) + ' (defender) nyeri a combatot. ' + takes(def), r: '468.3.a, 468.5, 468.5.d' });
    else result.push({ t: 'Egyik oldalon sem marad unit: No Result, a battlefield Uncontrolled lesz.', r: '468.3.d, 468.5.b' });
    result.push({ t: 'Combat nem ad Holdot: Hold csak a Beginning Phase-ben történik.', r: '471.2' });
  }

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
            <SideTable title={'Defender unitok (' + who(def) + ')'} units={D} asg={asg} setAsg={setAsg} setOpt={setOpt} bonusLbl="Shield" assigner={who(atk) + ' (attacker)'} pool={pA} errs={any ? eD : []} />
            <SideTable title={'Attacker unitok (' + who(atk) + ')'} units={A} asg={asg} setAsg={setAsg} setOpt={setOpt} bonusLbl="Assault" assigner={who(def) + ' (defender)'} pool={pD} errs={any ? eA : []} />
          </div>
          {ok && (
            <div className="cbc-res"><b>Eredmény</b>
              <ul>{result.map((x, k) => <li key={k}><R r={x.r} /><span>{x.t}</span></li>)}</ul>
            </div>
          )}
          <p className="note cbc-foot">
            A lethal küszöb a már rajta lévő damage-et is beszámítja (142.4.a). Az azonos prioritású unitok sorrendjét a kiosztó játékos választja (467.2.c.7), a javaslat a lista sorrendjét követi. A damage-re ható replacement effecteket és passive abilityket (467.2.c.5), a Deathknell, Conquer és combat triggereket a panel nem számolja: ezeket a játékos veszi figyelembe.
            {unknownMods && ' Feltételes keywordöt adó lapot is látok: ha él, jelöld be kézzel.'}
            {[...A, ...D].some((u) => u.opt.tank && u.opt.back) && ' Tank és Backline ugyanazon a uniton: a kiosztó játékos választja ki, melyik érvényes (467.2.c.8); a panel Tankként számol.'}
          </p>
        </>
      )}
    </details>
  );
}
