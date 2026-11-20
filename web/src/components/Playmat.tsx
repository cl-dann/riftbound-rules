import { createContext, useContext, useLayoutEffect, useRef, useState, type KeyboardEvent as RKE, type RefObject } from 'react';
import { Swords } from 'lucide-react';
import { IMGBASE, vsCard } from '../legacy/core';

export type PUnit = { n: string; m: number; base?: number; ex?: boolean; dmg?: number; tag?: string; status?: string[]; mods?: string[]; gear?: string[]; token?: boolean; id?: string; kind?: 'gear' };
export type PSide = {
  legend?: string; legendEx?: boolean; champion?: string | null; base?: PUnit[]; runes?: { ready: number; exhausted: number; domains?: string[] };
  hand?: string[]; handCount?: number; score?: number; deck?: number; runeDeck?: number; trash?: string[]; banish?: string[];
};
export type PBoard = { me: PSide; opp: PSide; bfs: { name: string; ctrl?: string | null; me?: PUnit[]; opp?: PUnit[]; facedown?: string | null; fdn?: string | null }[]; chain?: string[]; note?: string };

/** A pálya zónái a Core Rules 105-108 alapján. */
export const ZONES: Record<string, { t: string; d: string; r: string }> = {
  base: { t: 'Base', d: 'Minden játékosnak saját base-e van. Itt állnak az általad kontrollált permanentek (unitok, gearek) és a rune-jaid. A base egy location, a tartalma nyilvános.', r: '107.1' },
  bfs: { t: 'Battlefield Zone', d: 'A battlefieldek helye a pálya közepén. Minden battlefield külön location: ide mozognak a unitok, itt van showdown és combat, a kontrollálásuk ad pontot (conquer, hold).', r: '107.2' },
  facedown: { t: 'Facedown Zone', d: 'Minden battlefieldhez tartozik egy, legfeljebb 1 lapnyi hely. Ide rejtheted el a Hidden lapot, ha a battlefieldet te kontrollálod. Ha elveszíted a battlefieldet, a lap a következő cleanupkor kikerül.', r: '107.3' },
  legend: { t: 'Legend Zone', d: 'A Champion Legend helye. Innen nem mozdítható el, ez határozza meg a deck domain identitását, és a képességei innen működnek.', r: '107.4, 103.2' },
  champion: { t: 'Champion Zone', d: 'A Chosen Champion a játék elején ide kerül, és innen bármikor kijátszható a szokásos szabályok szerint. Ha egyszer elhagyta, normál módon nem tér ide vissza.', r: '108.3, 103.3.a' },
  deck: { t: 'Main Deck', d: 'A legalább 40 lapos pakli lefordítva. Innen húzol. A lapszám nyilvános, a sorrend titkos.', r: '108.4, 103.3' },
  runeDeck: { t: 'Rune Deck', d: 'A 12 rune lefordítva. A Channel Phase-ben innen kerül rune a base-be, és a recycle-ölt rune ide tér vissza alulra.', r: '108.5, 103.4' },
  runes: { t: 'Rune-ok', d: 'A channelölt rune-ok a base-edben vannak. Exhaustolva 1 Energyt adnak, recycle-ölve (visszatéve a Rune Deck aljára) 1 Powert a saját domainjükből. Az exhausted rune elfordítva látszik.', r: '107.1.c, 160-168' },
  trash: { t: 'Trash', d: 'Ide kerülnek a meghalt, eldobott és lefutott lapok. Nyilvános, a sorrend nem számít.', r: '108.2' },
  banish: { t: 'Banishment', d: 'A banisholt lapok helye. Nehezebben visszahozható, mint a trash, és ideiglenes tárolásra is szolgál egyes hatásoknál.', r: '108.6' },
  hand: { t: 'Kéz', d: 'Ide húzol. A lapok privátak, csak te látod őket, a lapszám viszont nyilvános.', r: '108.7' },
  chain: { t: 'Chain', d: 'Kijátszás közben a lapok és képességek ide kerülnek. Mindig a legfelső oldódik fel először, és válaszolni csak priority birtokában lehet.', r: '108.1, 327' },
  score: { t: 'Pontszám', d: 'Pontot conquer és hold ad. 1v1-ben 8 pontnál nyersz, az utolsó pontra külön szabály vonatkozik.', r: '194' },
};

const STATUS: Record<string, [string, string, string]> = {
  attacker: ['Attacker', 'atk', 'Attacker: ez a unit támad ebben a combatban. Az Assault bónusz ilyenkor él (467, 811).'],
  defender: ['Defender', 'def', 'Defender: ez a unit védekezik ebben a combatban. A Shield bónusz ilyenkor él (467).'],
  stunned: ['Stunned', 'stun', 'Stunned: nem oszt combat damage-et ebben a körben.'],
  buffed: ['Buff', 'buf', 'Buff: +1 Might, amíg rajta van; egy unitnak legfeljebb egy buffja lehet (427).'],
  empowered: ['Empowered', 'emp', 'Empowered: kifizette az Empower költséget, a lap empowered szövege él.'],
  temporary: ['Temporary', 'tmp', 'Temporary: a köröd elején megsemmisül (Temporary keyword).'],
  equipped: ['Equipped', 'eq', 'Equipped: Equipment van rajta csatolva, a gear bónusza a unitra hat.'],
  new: ['Új', 'new', 'Ebben a lépésben került ide.'],
  mistarget: ['Mistarget', 'mt', 'Mistarget: a resolve-oló chain elem célpontja volt, de már nem legális célpont, ezért rá a hatás elmarad (359.3.e.9).'],
  dying: ['Meghal', 'die', 'Lethal damage van rajta: a damage elérte a Mightját (142.4.b), a következő cleanupban meghal (323.4).'],
  detached: ['Levált', 'det', 'Levált: ebben a lépésben leválik a unitról (719.5, 436), a helyén marad; battlefielden a következő cleanupban recall-olódik (436.4.a).'],
  ctrlnew: ['Kontroll átvéve', 'ctl', 'Ebben a lépésben megváltozott az irányítója (191), ezért került a másik oldalra.'],
  ctrl: ['Átvett', 'ctl', 'Átvett kontroll: nem a tulajdonosa irányítja (191).'],
};
/** Dinamikus címke: "kw:Assault 2" alakú státusz a kapott keywordhöz. */
const statusOf = (s: string): [string, string, string] | undefined => STATUS[s] || (s.startsWith('kw:') ? [s.slice(3), 'buf', 'Ebben a körben kapott keyword: ' + s.slice(3) + '.'] : undefined);
export const PickCtx = createContext<(u: PUnit, side: 'me' | 'opp', where: string) => void>(() => {});

/** Kattintható célpont a pályán (szituációk "act" lépéseihez). loc: 'base', 'obase' (ellenfél base), 'bf0', 'bf1', ... */
export type PTarget =
  | { k: 'unit'; side: 'me' | 'opp'; loc: string; n: string; i: number; ex: boolean; id?: string }
  | { k: 'add'; z: 'base' | 'unit' | 'bfcard' | 'hand' | 'chain'; side?: 'me' | 'opp'; bfi?: number }
  | { k: 'pile'; z: 'trash' | 'deck' | 'banish'; side: 'me' | 'opp' }
  | { k: 'zone'; loc: string }
  | { k: 'rune'; side: 'me' | 'opp'; d: string }
  | { k: 'legend' | 'champion'; side: 'me' | 'opp' }
  | { k: 'hand'; side: 'me' | 'opp'; n: string; i: number }
  | { k: 'fd'; bfi: number }
  | { k: 'chain'; i: number; t: string };
/** act: ezzel most lehet valamit csinálni; sel: kijelölve; dest: legális célzóna. */
export type Glow = '' | 'act' | 'sel' | 'dest';
export type PlayCtl = { on: (t: PTarget) => void; glow: (t: PTarget) => Glow; label?: (t: PTarget) => string };
const CtlCtx = createContext<PlayCtl | null>(null);
/** Építő mód (Chain): üres zónákon + gomb, a ctl.on 'add' célponttal. */
const EditCtx = createContext(false);
function AddBtn({ t, label }: { t: PTarget; label: string }) {
  const ctl = useContext(CtlCtx); const ed = useContext(EditCtx);
  if (!ctl || !ed) return null;
  const g = ctl.glow(t); const l = (g && ctl.label?.(t)) || label;
  return <button type="button" className={'pm2-add' + gcls(g)} onClick={(e) => { e.stopPropagation(); ctl.on(t); }} aria-label={l} title={l} aria-pressed={g ? g === 'sel' : undefined}>+</button>;
}
const gcls = (g: Glow) => (g ? ' g-' + g : '');
/** Enter vagy szóköz a nem button elemeken is kattintásként működik. */
const keyAct = (f: () => void) => (e: RKE) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); f(); } };

const img = (n?: string | null) => { const c: any = n ? vsCard(n) : null; return c && c.img ? IMGBASE + c.img : ''; };
const key = (u: PUnit) => u.n + '|' + u.m + '|' + (u.dmg || 0) + '|' + !!u.ex + '|' + (u.status || []).join(',') + '|' + (u.gear || []).join(',');

function Card({ n, ex, small, title }: { n?: string | null; ex?: boolean; small?: boolean; title?: string }) {
  const s = img(n);
  return (
    <span className={'pm-card' + (ex ? ' ex' : '') + (small ? ' sm' : '') + (!n ? ' back' : '')} title={title || n || 'Lefordított lap'}>
      {n && s ? <img src={s} alt={n} loading="lazy" /> : <span className="pm-back">R</span>}
    </span>
  );
}

function Unit({ u, side, changed, where = '', loc = '', i = 0 }: { u: PUnit; side: 'me' | 'opp'; changed: boolean; where?: string; loc?: string; i?: number }) {
  const c: any = vsCard(u.n);
  const pick = useContext(PickCtx);
  const ctl = useContext(CtlCtx);
  const t: PTarget = { k: 'unit', side, loc, n: u.n, i, ex: !!u.ex, id: u.id };
  const g = ctl ? ctl.glow(t) : '';
  const go = () => (ctl ? ctl.on(t) : pick(u, side, where));
  const labNames = new Set((u.status || []).map((x) => (statusOf(x)?.[0] || '').toLowerCase()));
  const base = u.base ?? (c?.m != null && c.m !== 'None' ? +c.m : u.m);
  const diff = u.m - base;
  const st = u.status || [];
  return (
    <div className={'pm-unit ' + side + (u.ex ? ' ex' : '') + (changed ? ' chg' : '') + (st.includes('dying') ? ' dying' : '') + (u.kind === 'gear' ? ' gear' : '') + gcls(g)} data-uid={u.id} data-fk={side + ':' + u.n}
      onClick={(e) => { e.stopPropagation(); go(); }} onKeyDown={ctl ? keyAct(go) : undefined} role="button" tabIndex={0}
      aria-label={ctl ? (ctl.label?.(t) || u.n + (side === 'me' ? ', saját ' : ', ellenfél ') + (u.kind === 'gear' ? 'gear' : 'unit, Might ' + u.m) + (u.ex ? ', exhausted' : ', ready')) : u.kind === 'gear' ? u.n + ', gear' + (u.ex ? ', exhausted' : '') : undefined} aria-pressed={ctl ? g === 'sel' : undefined}>
      <div className="pm-labels">{st.map((s) => { const x = statusOf(s); return x ? <span key={s} className={'pm-lab ' + x[1]} data-tt={x[2]}>{x[0]}</span> : null; })}{u.token && <span className="pm-lab tmp">Token</span>}</div>
      <span className={c ? 'cl' : ''} data-card={c?.n}>
        {c?.img ? <img src={IMGBASE + c.img} alt={u.n} loading="lazy" /> : <span className="pm-tok">{u.n}</span>}
      </span>
      {u.kind !== 'gear' && <span className={'pm-might' + (diff > 0 ? ' up' : diff < 0 ? ' down' : '')} title={'Might ' + u.m + (diff ? ' (nyomtatva ' + base + ')' : '')}>{u.m}</span>}
      {u.kind !== 'gear' && diff !== 0 && <span className={'pm-delta' + (diff > 0 ? ' up' : ' down')}>{diff > 0 ? '+' : ''}{diff}</span>}
      {!!u.dmg && <span className="pm-dmg" title="Damage">{u.dmg}</span>}
      <div className="pm-name">{u.kind === 'gear' && <span className="pm-gtag">Gear</span>}{u.n}</div>
      {!!((u.mods || []).some((m) => !labNames.has(m.toLowerCase())) || u.gear?.length || u.tag) && (
        <div className="pm-mods">
          {u.tag && <span>{u.tag}</span>}
          {(u.gear || []).map((g) => <span key={g} className="g"><span className="cl" data-card={g}>{g}</span></span>)}
          {(u.mods || []).filter((m) => !labNames.has(m.toLowerCase())).map((m, i) => <span key={i}>{m}</span>)}
        </div>
      )}
    </div>
  );
}

const DOMC: Record<string, string> = { Fury: '#ff5a4e', Calm: '#4fcf8a', Mind: '#5fa1ff', Body: '#f59a45', Chaos: '#b07ef2', Order: '#e9cb4d' };

function RuneStacks({ r, onZone, sel, side }: { r?: PSide['runes']; onZone: (z: string) => void; sel: string; side: 'me' | 'opp' }) {
  const ctl = useContext(CtlCtx);
  if (!r) return null;
  const doms = r.domains || [];
  const total = r.ready + r.exhausted;
  const groups: Record<string, { ready: number; ex: number }> = {};
  for (let i = 0; i < total; i++) { const d = doms[i] || '?'; groups[d] ||= { ready: 0, ex: 0 }; if (i < r.ready) groups[d].ready++; else groups[d].ex++; }
  // Színenként egy kupac: a ready lapok elöl, az exhausted lapok elforgatva a kupac végén. A kulcs a pozíció, így exhaustkor ugyanaz az elem fordul el (animáció).
  const stack = (d: string, g: { ready: number; ex: number }) => (
    <>
      {Array.from({ length: g.ready + g.ex }, (_, i) => <span key={i} className={'pm2-rune' + (i >= g.ready ? ' ex' : '')} style={{ marginLeft: i ? -30 : 0 }}><img src={img(d + ' Rune')} alt={d + ' Rune' + (i >= g.ready ? ' exhausted' : '')} loading="lazy" /></span>)}
      <b className="pm2-cnt" style={{ background: DOMC[d] || '#555' }} title={g.ready + ' ready, ' + g.ex + ' exhausted'}>{g.ready}</b>
    </>
  );
  const inner = (
    <>
      <span className="pm2-stacks">
        {Object.entries(groups).map(([d, g]) => {
          if (!ctl) return <span key={d} className="pm2-stack">{stack(d, g)}</span>;
          const t: PTarget = { k: 'rune', side, d };
          const gl = ctl.glow(t);
          return <button key={d} type="button" className={'pm2-stack' + gcls(gl)} onClick={() => ctl.on(t)} aria-label={ctl.label?.(t) || d + ' rune-ok: ' + g.ready + ' ready, ' + g.ex + ' exhausted'}>{stack(d, g)}</button>;
        })}
      </span>
      <span className="pm2-total" title="Összes rune">{total}</span>
      <span className="pm2-lbl">Runes · {r.ready} ready, {r.exhausted} exhausted</span>
    </>
  );
  return ctl
    ? <div data-zone="runes" className="pm2-runes">{inner}</div>
    : <button type="button" data-zone="runes" className={'pm2-runes' + (sel === 'runes' ? ' on' : '')} onClick={() => onZone('runes')} title="Rune-ok">{inner}</button>;
}

function Piles({ s, onZone, sel, known, side }: { s: PSide; onZone: (z: string) => void; sel: string; known?: boolean; side: 'me' | 'opp' }) {
  const ctl = useContext(CtlCtx); const ed = useContext(EditCtx);
  const P = ({ z, l, n, top }: { z: string; l: string; n?: number; top?: string | null }) => {
    if (ctl && ed && (z === 'trash' || z === 'deck' || z === 'banish')) {
      const t: PTarget = { k: 'pile', z, side }; const g = ctl.glow(t);
      return <button type="button" data-zone={z} className={'pm2-pile' + gcls(g)} onClick={() => ctl.on(t)} aria-label={ctl.label?.(t) || l + ': ' + (n ?? 0) + ' lap, megnyitás'}><Card n={top} small /><span>{l}<b>{n ?? 0}</b></span></button>;
    }
    return (
      <button type="button" data-zone={z} className={'pm2-pile' + (sel === z ? ' on' : '')} onClick={() => onZone(z)} title={ZONES[z]?.t}>
        <Card n={top} small /><span>{l}<b>{n ?? 0}</b></span>
      </button>
    );
  };
  return (
    <div className="pm2-piles">
      {!(known && s.deck == null && !(ctl && ed)) && <P z="deck" l="Deck" n={s.deck} />}
      {!(known && s.runeDeck == null) && <P z="runeDeck" l="Rune Deck" n={s.runeDeck} />}
      <P z="trash" l="Trash" n={(s.trash || []).length} top={(s.trash || []).slice(-1)[0] || null} />
      <P z="banish" l="Banish" n={(s.banish || []).length} top={(s.banish || []).slice(-1)[0] || null} />
    </div>
  );
}

function Hand({ s, onZone, sel, known, side }: { s: PSide; onZone: (z: string) => void; sel: string; known?: boolean; side: 'me' | 'opp' }) {
  const ctl = useContext(CtlCtx);
  const ed = useContext(EditCtx);
  const n = s.hand ? s.hand.length : s.handCount ?? 0;
  if (known && !n && !ed) return null;
  if (ctl) return (
    <div data-zone="hand" className="pm2-hand">
      <span className="pm2-cards">
        {s.hand ? s.hand.map((h, i) => {
          const t: PTarget = { k: 'hand', side, n: h, i };
          const gl = ctl.glow(t);
          return <button key={i} type="button" className={'cl pm2-hc' + gcls(gl)} data-card={h} data-fk={side + ':' + h} onClick={() => ctl.on(t)} aria-label={ctl.label?.(t) || h + ', kézben'} aria-pressed={gl === 'sel'}><Card n={h} /></button>;
        }) : Array.from({ length: n }, (_, i) => <Card key={i} />)}
        {!n && !ed && <span className="pm-empty">üres</span>}
        <AddBtn t={{ k: 'add', z: 'hand', side }} label={(side === 'me' ? 'Saját' : 'Ellenfél') + ' kéz: lap hozzáadása'} />
      </span>
      <span className="pm2-lbl">Hand · {n}</span>
    </div>
  );
  return (
    <button type="button" data-zone="hand" className={'pm2-hand' + (sel === 'hand' ? ' on' : '')} onClick={() => onZone('hand')}>
      <span className="pm2-cards">
        {s.hand ? s.hand.map((h, i) => <span key={i} className="cl" data-card={h} data-fk={side + ':' + h}><Card n={h} /></span>)
          : Array.from({ length: n }, (_, i) => <Card key={i} />)}
        {!n && <span className="pm-empty">üres</span>}
      </span>
      <span className="pm2-lbl">Hand · {n}</span>
    </button>
  );
}

const EdPlus = () => (useContext(EditCtx) ? <span className="pm2-plus" aria-hidden>+</span> : null);

function LegendChamp({ s, onZone, sel, side }: { s: PSide; onZone: (z: string) => void; sel: string; side: 'me' | 'opp' }) {
  const ctl = useContext(CtlCtx);
  const tc: PTarget = { k: 'champion', side }, tl: PTarget = { k: 'legend', side };
  const gc = ctl ? ctl.glow(tc) : '', gl = ctl ? ctl.glow(tl) : '';
  return (
    <div className="pm2-lc">
      <button type="button" data-zone="champion" className={'pm2-slot' + (sel === 'champion' ? ' on' : '') + gcls(gc)} onClick={() => (ctl ? ctl.on(tc) : onZone('champion'))} aria-label={ctl ? ctl.label?.(tc) || 'Champion: ' + (s.champion || 'üres') : undefined}>
        {s.champion ? <span className="cl" data-card={s.champion}><Card n={s.champion} /></span> : <span className="pm2-ghost"><EdPlus /></span>}
        <span className="pm2-badge ch">Champion</span>
      </button>
      <button type="button" data-zone="legend" className={'pm2-slot lg' + (s.legendEx ? ' ex' : '') + (sel === 'legend' ? ' on' : '') + gcls(gl)} onClick={() => (ctl ? ctl.on(tl) : onZone('legend'))} aria-label={ctl ? ctl.label?.(tl) || 'Legend: ' + (s.legend || 'üres') + (s.legendEx ? ', exhausted' : ', ready') : undefined}>
        {s.legend ? <span className="cl" data-card={s.legend}><Card n={s.legend} /></span> : <span className="pm2-ghost"><EdPlus /></span>}
        <span className="pm2-badge lg">Legend</span>
      </button>
    </div>
  );
}

/** Unitok és a csatolatlan gearek külön sorban: a gear kisebb, Might jelző nélkül (a csatolt gear a unit alatt, a pm-mods sorban). */
function UnitRow({ us, side, loc, where, pk, add }: { us: PUnit[]; side: 'me' | 'opp'; loc: string; where: string; pk: Set<string> | null; add?: PTarget }) {
  const units = us.map((u, i) => [u, i] as const).filter(([u]) => u.kind !== 'gear');
  const gears = us.map((u, i) => [u, i] as const).filter(([u]) => u.kind === 'gear');
  return (
    <>
      <div className="pm2-units">{units.map(([u, i]) => <Unit key={i} u={u} side={side} loc={loc} i={i} where={where} changed={!!pk && !pk.has(key(u))} />)}{add && <AddBtn t={add} label={'Unit vagy gear hozzáadása: ' + where + (side === 'me' ? ', saját' : ', ellenfél')} />}</div>
      {gears.length > 0 && <div className="pm2-gears" aria-label="Csatolatlan gearek">{gears.map(([u, i]) => <Unit key={i} u={u} side={side} loc={loc} i={i} where={where} changed={!!pk && !pk.has(key(u))} />)}</div>}
    </>
  );
}

function Base({ s, who, prev, onZone, sel }: { s: PSide; who: 'me' | 'opp'; prev?: PSide; onZone: (z: string) => void; sel: string }) {
  const ctl = useContext(CtlCtx);
  const pk = new Set((prev?.base || []).map(key));
  const t: PTarget = { k: 'zone', loc: who === 'me' ? 'base' : 'obase' };
  const g = ctl ? ctl.glow(t) : '';
  return (
    <div data-zone="base" className={'pm2-base ' + who + (sel === 'base' ? ' on' : '') + gcls(g)}
      onClick={(e) => { if (ctl) { if (!(e.target as HTMLElement).closest('.pm-unit,button')) ctl.on(t); return; } if (!(e.target as HTMLElement).closest('.cl,button')) onZone('base'); }}
      {...(ctl && g === 'dest' ? { tabIndex: 0, role: 'button', 'aria-label': ctl.label?.(t) || 'Cél: ' + (who === 'me' ? 'saját base' : 'ellenfél base'), onKeyDown: keyAct(() => ctl.on(t)) } : {})}>
      <span className="pm2-wm" aria-hidden>BASE</span>
      <UnitRow us={s.base || []} side={who} loc={who === 'me' ? 'base' : 'obase'} where={(who === 'me' ? 'Saját' : 'Ellenfél') + ' base'} pk={prev ? pk : null} add={{ k: 'add', z: 'base', side: who }} />
    </div>
  );
}

function UnitInfo({ u, side, where }: { u: PUnit; side: 'me' | 'opp'; where: string }) {
  const c: any = vsCard(u.n);
  const base = u.base ?? (c?.m != null && c.m !== 'None' ? +c.m : u.m);
  return (
    <div className="pm-uinfo">
      {c?.img && <img src={IMGBASE + c.img} alt={u.n} onClick={() => window.dispatchEvent(new CustomEvent('rb:open-card', { detail: c.n }))} title="Teljes lapadat" />}
      <div>
        <b>{u.n}</b> <span className="note">{side === 'me' ? 'saját' : 'ellenfél'} {u.kind === 'gear' ? 'gear (nincs csatolva)' : 'unit'} · {where}{u.token ? ' · token' : ''}</span>
        {u.kind === 'gear' ? <p>{u.ex ? 'Exhausted.' : 'Ready.'} Csatolatlan gear: nincs Mightja a boardon, csak csatolva ad Might bonust (435.1.d).</p> : <p>Might: <strong>{u.m}</strong>{u.m !== base && <> (nyomtatva {base}, {u.m > base ? '+' : ''}{u.m - base})</>}{u.dmg ? <>, damage: <strong>{u.dmg}</strong>, ennyi kell még a halálhoz: <strong>{Math.max(0, u.m - u.dmg)}</strong></> : null}{u.ex ? ', exhausted (nem mozoghat Standard Move-val)' : ', ready'}</p>}
        {!!u.status?.length && <ul>{u.status.map((x) => statusOf(x) ? <li key={x}>{statusOf(x)![2]}</li> : null)}</ul>}
        {!!u.mods?.length && <p>Módosítók: {u.mods.join(', ')}</p>}
        {!!u.gear?.length && <p>Csatolt Equipment: {u.gear.join(', ')}</p>}
        {c?.sh && <p className="note">{c.sh}</p>}
      </div>
    </div>
  );
}

/** Lépésről lépésre: mi változott a pályán (emberi nyelven). */
export function diffBoards(a: PBoard | undefined, b: PBoard): string[] {
  if (!a) return [];
  const out: string[] = [];
  const loc = (B: PBoard) => {
    const m = new Map<string, { u: PUnit; where: string; side: string }>();
    for (const side of ['me', 'opp'] as const) {
      (B[side].base || []).forEach((u) => m.set(side + ':' + u.n, { u, where: 'base', side }));
      B.bfs.forEach((f) => (f[side] || []).forEach((u) => m.set(side + ':' + u.n, { u, where: f.name, side })));
    }
    return m;
  };
  const A = loc(a), Bm = loc(b);
  const who = (k: string) => (k.startsWith('me:') ? 'Saját ' : 'Ellenfél ');
  for (const [k, x] of Bm) {
    const y = A.get(k); const n = x.u.n;
    if (!y) { out.push(who(k) + n + ' megjelent itt: ' + (x.where === 'base' ? 'base' : x.where) + '.'); continue; }
    if (y.where !== x.where) out.push(n + ' átkerült: ' + (y.where === 'base' ? 'base' : y.where) + ' → ' + (x.where === 'base' ? 'base' : x.where) + '.');
    if (y.u.m !== x.u.m) out.push(n + ' Mightja ' + y.u.m + ' → ' + x.u.m + '.');
    if ((y.u.dmg || 0) !== (x.u.dmg || 0)) out.push(n + ' damage: ' + (y.u.dmg || 0) + ' → ' + (x.u.dmg || 0) + '.');
    if (!!y.u.ex !== !!x.u.ex) out.push(n + (x.u.ex ? ' exhausted lett.' : ' ready lett.'));
    const ns = (x.u.status || []).filter((t) => !(y.u.status || []).includes(t) && t !== 'new' && STATUS[t]);
    if (ns.length) out.push(n + ': ' + ns.map((t) => STATUS[t][0]).join(', ') + '.');
  }
  for (const [k, y] of A) if (!Bm.has(k)) out.push(who(k) + y.u.n + ' elhagyta a pályát.');
  for (const side of ['me', 'opp'] as const) {
    const L = side === 'me' ? 'Te' : 'Ellenfél';
    const ra = a[side].runes, rb = b[side].runes;
    if (ra && rb && (ra.ready !== rb.ready || ra.exhausted !== rb.exhausted)) out.push(L + ' rune-ok: ' + ra.ready + ' ready, ' + ra.exhausted + ' exhausted → ' + rb.ready + ' ready, ' + rb.exhausted + ' exhausted.');
    if ((a[side].score ?? 0) !== (b[side].score ?? 0)) out.push(L + ' pontszám: ' + (a[side].score ?? 0) + ' → ' + (b[side].score ?? 0) + '.');
    const ha = a[side].hand ? a[side].hand!.length : a[side].handCount ?? 0, hb = b[side].hand ? b[side].hand!.length : b[side].handCount ?? 0;
    if (ha !== hb) out.push(L + ' kéz: ' + ha + ' → ' + hb + ' lap.');
    if ((a[side].trash || []).length !== (b[side].trash || []).length) out.push(L + ' trash: ' + (b[side].trash || []).slice((a[side].trash || []).length).join(', ') + ' bekerült.');
  }
  b.bfs.forEach((f, i) => { const g = a.bfs[i]; if (g && g.ctrl !== f.ctrl) out.push(f.name + ' irányítása: ' + (g.ctrl === 'me' ? 'te' : g.ctrl === 'opp' ? 'ellenfél' : 'senki') + ' → ' + (f.ctrl === 'me' ? 'te' : f.ctrl === 'opp' ? 'ellenfél' : 'senki') + '.'); });
  const ca = (a.chain || []).length, cb = (b.chain || []).length;
  if (ca !== cb) out.push(cb > ca ? 'Chainre került: ' + (b.chain || [])[0] + '.' : cb === 0 ? 'A chain kiürült, minden feloldódott.' : 'A chain legfelső eleme feloldódott.');
  return out;
}

const mightSum = (us?: PUnit[]) => (us || []).filter((u) => u.kind !== 'gear').reduce((a, u) => a + (u.m || 0), 0);

/** FLIP animáció: a lapok (unitok, kézben lévő lapok) a régi helyükről csúsznak az újra, ha a pálya állapota változik. */
function useFlip(host: RefObject<HTMLDivElement | null>, dep: unknown) {
  const pos = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const h = host.current; if (!h) return;
    const o = h.getBoundingClientRect();
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, { x: number; y: number }>();
    const seen = new Map<string, number>();
    h.querySelectorAll<HTMLElement>('[data-fk]').forEach((el) => {
      const base = el.dataset.fk!; const n = seen.get(base) || 0; seen.set(base, n + 1);
      const k = base + '#' + n;
      const r = el.getBoundingClientRect(); const p = { x: r.left - o.left, y: r.top - o.top };
      const old = pos.current.get(k);
      if (old && !still && el.animate && (Math.abs(old.x - p.x) > 6 || Math.abs(old.y - p.y) > 6)) {
        el.animate([{ transform: 'translate(' + (old.x - p.x) + 'px,' + (old.y - p.y) + 'px)', zIndex: 5 }, { transform: 'none', zIndex: 5 }], { duration: 480, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
      next.set(k, p);
    });
    pos.current = next;
  }, [dep]);
}

/** onlyKnown: csak az ismert zónák látszanak (a Chain elemzőnél nincs deck, rune és teljes kéz adat). */
/** hover: egérrel rávive is megjelenik a zóna leírása (How to Play felfedező). infoTop: a leírás a pálya fölött. */
/** scn: szituáció mód: nincs zónamagyarázó szöveg és megjegyzés a pálya alatt, az üres chain rejtve. ctl: kattintható lépések (sárga kiemelés). */
export function Playmat({ b, prev, explain = true, focus, turn = 'me', onlyKnown = false, hover = false, infoTop = false, scn = false, ctl, edit = false }: { edit?: boolean; b: PBoard; prev?: PBoard; explain?: boolean; focus?: string; turn?: 'me' | 'opp' | null; onlyKnown?: boolean; hover?: boolean; infoTop?: boolean; scn?: boolean; ctl?: PlayCtl | null }) {
  const [sel, setSel] = useState(focus || '');
  const [pu, setPu] = useState<{ u: PUnit; side: 'me' | 'opp'; where: string } | null>(null);
  const onZone = (z: string) => { if (scn) return; setPu(null); setSel(sel === z ? '' : z); };
  const info = sel ? ZONES[sel] : null;
  const pick = (u: PUnit, side: 'me' | 'opp', where: string) => { setSel(''); setPu(pu && pu.u === u ? null : { u, side, where }); };
  const score = (who: 'me' | 'opp') => { const v = b[who].score; return v == null ? null : <button type="button" data-zone="score" className={'pm2-pts ' + who} onClick={() => onZone('score')}>{v}<small>pts</small></button>; };
  const host = useRef<HTMLDivElement>(null);
  useFlip(host, b);
  useLayoutEffect(() => { if (ctl) setPu(null); }, [ctl]);
  const showChain = !scn || !!b.chain?.length;
  return (
    <PickCtx.Provider value={pick}>
    <CtlCtx.Provider value={ctl || null}>
    <EditCtx.Provider value={edit && !!ctl}>
    <div ref={host} className={'pm2' + (onlyKnown ? ' known' : '') + (infoTop ? ' infotop' : '') + (scn ? ' scnm' : '') + (ctl ? ' actm' : '') + (edit ? ' edm' : '')} onMouseOver={hover ? (e) => {
      const t = e.target as HTMLElement; if (t.closest('.pm-unit')) return;
      const z = t.closest('[data-zone]')?.getAttribute('data-zone'); if (z && z !== sel) { setPu(null); setSel(z); }
    } : undefined}>
      <div className="pm2-table">
        <div className="pm2-bar opp"><span>Opponent</span>{turn === 'opp' && <span className="pm2-turn">Turn</span>}</div>
        <div className="pm2-band opp-top">
          <Piles s={b.opp} onZone={onZone} sel={sel} known={onlyKnown} side="opp" />
          <Hand s={b.opp} onZone={onZone} sel={sel} known={onlyKnown} side="opp" />
          <RuneStacks r={b.opp.runes} onZone={onZone} sel={sel} side="opp" />
        </div>
        <div className="pm2-band opp-base">
          <LegendChamp s={b.opp} onZone={onZone} sel={sel} side="opp" />
          <Base s={b.opp} who="opp" prev={prev?.opp} onZone={onZone} sel={sel} />
        </div>
        <div className={'pm2-field' + (sel === 'bfs' ? ' on' : '')}>
          {score('opp')}
          <button type="button" data-zone="bfs" className="pm2-ftitle" onClick={() => onZone('bfs')}>Battlefield{b.bfs.length > 1 ? 's' : ''}</button>
          {b.bfs.map((f, i) => {
            const pf = prev?.bfs?.[i];
            const pko = new Set((pf?.opp || []).map(key)), pkm = new Set((pf?.me || []).map(key));
            const zt: PTarget = { k: 'zone', loc: 'bf' + i }, ft: PTarget = { k: 'fd', bfi: i };
            const zg = ctl ? ctl.glow(zt) : '', fg = ctl ? ctl.glow(ft) : '';
            const mo = mightSum(f.opp), mm = mightSum(f.me);
            return (
              <div key={i} className={'pm2-bf' + gcls(zg)} data-zone="bfs" data-bfi={i}
                onClick={ctl ? (e) => { if (!(e.target as HTMLElement).closest('.pm-unit,button')) ctl.on(zt); } : undefined}
                {...(ctl && zg === 'dest' ? { tabIndex: 0, role: 'button', 'aria-label': ctl.label?.(zt) || 'Cél: ' + f.name, onKeyDown: keyAct(() => ctl.on(zt)) } : {})}>
                <div className="pm2-ubox opp"><span className="pm2-uh">Opponent units{!!f.opp?.some((u) => u.kind !== 'gear') && <b className="pm2-msum" title={'Összesített Might: ' + mo + ', ' + f.opp.filter((u) => u.kind !== 'gear').length + ' unit'}>{mo}<Swords size={12} aria-hidden /></b>}</span>
                  <UnitRow us={f.opp || []} side="opp" loc={'bf' + i} where={f.name || (i + 1) + '. battlefield'} pk={prev ? pko : null} add={{ k: 'add', z: 'unit', side: 'opp', bfi: i }} /></div>
                <div className={'pm2-bfc ' + (f.ctrl || 'none')} data-bfi={i}>
                  {!f.name && edit && ctl ? <button type="button" className="pm2-bfadd" onClick={(e) => { e.stopPropagation(); ctl.on({ k: 'add', z: 'bfcard', bfi: i }); }} aria-label={(i + 1) + '. battlefield kiválasztása'}><span>+</span>{i + 1}. battlefield</button>
                    : <span className="cl" data-card={f.name}>{img(f.name) ? <img src={img(f.name)} alt={f.name} loading="lazy" /> : <span className="pm-tok">{f.name}</span>}</span>}
                  <span className="pm2-ctrl">{f.ctrl === 'me' ? 'Te kontrollálod' : f.ctrl === 'opp' ? 'Ellenfél kontrollálja' : 'Senkié'}</span>
                  <button type="button" data-zone="facedown" className={'pm2-fd' + (f.facedown ? ' has ' + f.facedown : '') + (sel === 'facedown' ? ' on' : '') + gcls(fg)} onClick={() => (ctl ? ctl.on(ft) : onZone('facedown'))} title="Facedown Zone" aria-label={ctl ? ctl.label?.(ft) || 'Facedown: ' + f.name + (f.facedown ? ', lefordított lap' : ', üres') : undefined}>
                    {f.facedown ? <Card small n={f.fdn || undefined} /> : <span className="pm2-ghost sm">{edit && <span className="pm2-plus sm" aria-hidden>+</span>}</span>}<span>Facedown</span>
                  </button>
                </div>
                <div className="pm2-ubox me"><span className="pm2-uh">Your units{!!f.me?.some((u) => u.kind !== 'gear') && <b className="pm2-msum" title={'Összesített Might: ' + mm + ', ' + f.me.filter((u) => u.kind !== 'gear').length + ' unit'}>{mm}<Swords size={12} aria-hidden /></b>}</span>
                  <UnitRow us={f.me || []} side="me" loc={'bf' + i} where={f.name || (i + 1) + '. battlefield'} pk={prev ? pkm : null} add={{ k: 'add', z: 'unit', side: 'me', bfi: i }} /></div>
              </div>
            );
          })}
          {showChain && (ctl ? (
            <div data-zone="chain" className="pm2-chain">
              <span className="pm2-uh">Chain</span>
              {!b.chain?.length ? <span className="pm-empty">üres</span> : b.chain.map((c, i) => {
                const t: PTarget = { k: 'chain', i, t: c.replace(/\[\[([^\]]+)\]\]/g, '$1') };
                const gl = ctl.glow(t);
                return <button key={i} type="button" className={'pm2-ci' + gcls(gl)} data-ci={i} onClick={() => ctl.on(t)}>{i === 0 ? <b>Felül: </b> : null}{t.t}</button>;
              })}
              <AddBtn t={{ k: 'add', z: 'chain' }} label="Lap kijátszása a chainre" />
            </div>
          ) : (
            <button type="button" data-zone="chain" className={'pm2-chain' + (sel === 'chain' ? ' on' : '')} onClick={() => onZone('chain')}>
              <span className="pm2-uh">Chain</span>
              {!b.chain?.length ? <span className="pm-empty">üres</span> : b.chain.map((c, i) => <span key={i} className="pm2-ci" data-ci={i}>{i === 0 ? <b>Felül: </b> : null}{c.replace(/\[\[([^\]]+)\]\]/g, '$1')}</span>)}
            </button>
          ))}
          {score('me')}
        </div>
        <div className="pm2-band me-base">
          <Base s={b.me} who="me" prev={prev?.me} onZone={onZone} sel={sel} />
          <LegendChamp s={b.me} onZone={onZone} sel={sel} side="me" />
        </div>
        <div className="pm2-band me-bottom">
          <RuneStacks r={b.me.runes} onZone={onZone} sel={sel} side="me" />
          <Hand s={b.me} onZone={onZone} sel={sel} known={onlyKnown} side="me" />
          <Piles s={b.me} onZone={onZone} sel={sel} known={onlyKnown} side="me" />
        </div>
        <div className="pm2-bar me"><span>You</span>{turn === 'me' && <span className="pm2-turn">Turn</span>}</div>
      </div>
      {b.note && !scn && <p className="pm-note">{b.note}</p>}
      {explain && (!scn || pu) && (
        <div className="pm-info" aria-live="polite">
          {pu ? <UnitInfo {...pu} /> : info ? (<><b>{info.t}</b> <span>{info.d}</span> <span className="note">Core Rules: {info.r.split(/,\s*/).map((r) => <a key={r} className="rref" href="#szabalyok" data-ref={r}>{r}</a>)}</span></>)
            : <span className="note">Kattints a pálya bármelyik zónájára (Legend, Champion, Base, Runes, Deck, Trash, battlefield, Facedown, Hand, Chain, pontszám), és itt megjelenik, mire való.</span>}
        </div>
      )}
    </div>
    </EditCtx.Provider>
    </CtlCtx.Provider>
    </PickCtx.Provider>
  );
}

/** Bemutató pálya a "pálya felépítése" fejezethez. */
export const DEMO_BOARD: PBoard = {
  opp: { legend: 'Ahri, Nine-Tailed Fox', champion: 'Ahri, Alluring', base: [{ n: 'Apprentice Mage', m: 3, ex: true }], runes: { ready: 2, exhausted: 2, domains: ['Calm', 'Mind', 'Calm', 'Mind'] }, handCount: 4, score: 2, deck: 33, runeDeck: 8, trash: ['Apprentice Smith'], banish: [] },
  bfs: [
    { name: 'Bandle Tree', ctrl: 'opp', opp: [{ n: 'Adaptatron', m: 3, status: ['defender'] }], me: [{ n: 'Ancient Warmonger', m: 6, base: 4, status: ['attacker', 'buffed'], mods: ['+2 Might a kör végéig'], dmg: 1 }], facedown: 'opp' },
    { name: 'Abandoned Hall', ctrl: 'me', opp: [], me: [{ n: 'Arena Kingpin', m: 3, ex: true }], facedown: null },
  ],
  me: { legend: 'Jinx, Loose Cannon', champion: 'Jinx, Rebel', base: [{ n: 'Amateur Demolitionist', m: 1 }], runes: { ready: 3, exhausted: 1, domains: ['Fury', 'Chaos', 'Fury', 'Chaos'] }, hand: ['Angler Beast', 'Baccai Reaper'], score: 1, deck: 34, runeDeck: 8, trash: [], banish: [] },
  chain: [],
  note: 'Bemutató állás: nem egy valódi játék pillanatképe, a zónák szemléltetésére.',
};
