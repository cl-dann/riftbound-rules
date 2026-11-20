import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from 'lucide-react';
import { initChain, getChainFrames, chainApi, stateKeysOf, tgOptionsOf, locLabelOf } from '../legacy/chain';
import { stepInfo } from '../legacy/chainCore';
import { IMGBASE } from '../legacy/core';
import { Playmat, type PTarget, type PlayCtl, type Glow } from '../components/Playmat';
import { CombatPanel } from '../components/CombatPanel';
import {
  setupFrame, stepFrames, fullFrame, tryStep, targetOpts, slotText, stepName, abilitiesFor, hasHidden, isPerm, searchCards, cardOf, sideOf, plOf,
  PICK_TITLE, type ChainFrame, type MtInfo, type MtInstr, type Arrow, type PickKind, type TgOpt, type Legal,
} from '../components/chainBuild';
import '../components/practice.css';

export type { ChainFrame };

const ST_TXT: Record<MtInstr['st'], [string, string]> = {
  executed: ['Végrehajtódik', 'ok'], partial: ['Részben', 'part'], ignored: ['Ignored', 'ign'], negated: ['Negated', 'neg'], skipped: ['Nem hajtódik végre', 'ign'],
};
const Refs = ({ r }: { r: string }) => <span className="cbv-refs">{r.split(/,\s*/).filter(Boolean).map((x) => <a key={x} className="rref" href="#szabalyok" data-ref={x}>{x}</a>)}</span>;
const imgOf = (n?: string | null) => { const c = cardOf(n); return c && c.img ? IMGBASE + c.img : ''; };
const openCard = (n: string) => window.dispatchEvent(new CustomEvent('rb:open-card', { detail: n }));

function MistargetBox({ mt }: { mt: MtInfo }) {
  const rest = mt.instr.some((x) => x.st === 'executed');
  const head = mt.kind === 'full' ? (rest ? 'Teljes mistarget: a célpontokra nem hat, a célponthoz nem kötött utasítás végrehajtódik' : 'Teljes mistarget: az elem nem csinál semmit') : mt.kind === 'partial' ? 'Részleges mistarget: csak a legális célpontokra hat' : 'Nincs mistarget, de egy utasítás elmarad';
  return (
    <div className={'cbv-mt ' + mt.kind}>
      <div className="cbv-mt-h"><Refs r={mt.kind === 'full' ? '359.3.e.9, 359.3.e.7' : mt.kind === 'partial' ? '359.3.e.9, 359.3.e.8' : '359.3.e.6'} /><b>{head}</b><span className="note">{mt.item}</span></div>
      <ul className="cbv-mt-tg">{mt.targets.map((t, k) => (
        <li key={k} className={t.ok ? 'ok' : t.skip ? 'skip' : 'bad'}><span className="cbv-pill">{t.ok ? 'legális' : t.skip ? 'kimarad' : 'illegális'}</span>{t.n}{t.why ? ': ' + t.why : ''}</li>
      ))}</ul>
      {mt.instr.length > 0 && (
        <table className="cbv-mt-in"><tbody>{mt.instr.map((x, k) => (
          <tr key={k}><td className="q">"{x.t}"</td><td><span className={'cbv-st ' + ST_TXT[x.st][1]}>{ST_TXT[x.st][0]}</span></td><td>{x.ref && <Refs r={x.ref} />}{x.why}{x.man && <span className="cbman">kézzel beállítva</span>}</td></tr>
        ))}</tbody></table>
      )}
    </div>
  );
}

const STEP_MS = 1200;
/** Nyílszín a chain elem helye szerint (0 = legfelső). */
const COLORS = ['#b07ef2', '#5fa1ff', '#f59a45', '#4fcf8a', '#e9cb4d'];

/** SVG overlay: nyíl a chain elem jelölőjétől a célpontig (unit, másik chain elem vagy battlefield). */
function Arrows({ host, arrows, tick }: { host: HTMLDivElement | null; arrows: Arrow[]; tick: number }) {
  const [paths, setPaths] = useState<{ d: string; k: string; x: number; y: number; c: string }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const measure = useCallback(() => {
    if (!host) return;
    const hr = host.getBoundingClientRect();
    setSize({ w: hr.width, h: hr.height });
    const out: { d: string; k: string; x: number; y: number; c: string }[] = [];
    arrows.forEach((a, i) => {
      const src = host.querySelector<HTMLElement>('.pm2-ci[data-ci="' + a.from + '"]');
      const [kind, id] = [a.to.slice(0, a.to.indexOf(':')), a.to.slice(a.to.indexOf(':') + 1)];
      const sel = kind === 'u' ? '.pm-unit[data-uid="' + id + '"] > .cl' : kind === 'c' ? '.pm2-ci[data-ci="' + id + '"]' : '.pm2-bfc[data-bfi="' + id + '"] > *';
      const dst = host.querySelector<HTMLElement>(sel);
      if (!src || !dst) return;
      const s = src.getBoundingClientRect(), t = dst.getBoundingClientRect();
      const tx = t.left + t.width / 2 - hr.left, sc = s.left + s.width / 2 - hr.left;
      const y1 = s.top + s.height / 2 - hr.top;
      let x1: number, x2: number, y2: number, d: string;
      if (kind === 'c') {
        x1 = s.right - hr.left; x2 = t.right - hr.left; y2 = t.top + t.height / 2 - hr.top;
        const bx = Math.max(x1, x2) + 28 + i * 6;
        d = 'M' + x1 + ' ' + y1 + ' C' + bx + ' ' + y1 + ' ' + bx + ' ' + y2 + ' ' + x2 + ' ' + y2;
      } else {
        const left = tx < sc;
        x1 = (left ? s.left : s.right) - hr.left;
        const below = t.top > s.bottom;
        x2 = tx; y2 = (below ? t.top - 2 : t.bottom + 2) - hr.top;
        const ox = x1 + (left ? -1 : 1) * (50 + i * 8), oy = y2 + (below ? -40 : 40);
        d = 'M' + x1 + ' ' + y1 + ' C' + ox + ' ' + y1 + ' ' + x2 + ' ' + oy + ' ' + x2 + ' ' + y2;
      }
      out.push({ d, k: a.from + '-' + a.to + '-' + i, x: x1, y: y1, c: COLORS[a.from % COLORS.length] });
    });
    setPaths(out);
  }, [host, arrows]);
  useLayoutEffect(() => { measure(); }, [measure, tick]);
  useEffect(() => {
    if (!host) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(host);
    host.addEventListener('load', measure, true);
    return () => { ro.disconnect(); host.removeEventListener('load', measure, true); };
  }, [host, measure]);
  if (!paths.length) return null;
  return (
    <svg className="cbv-arrows" width={size.w} height={size.h} viewBox={'0 0 ' + size.w + ' ' + size.h} aria-hidden>
      <defs>
        {COLORS.map((c, k) => (
          <marker key={k} id={'cbv-head' + k} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={c} />
          </marker>
        ))}
      </defs>
      {paths.map((p) => (
        <g key={p.k} style={{ color: p.c }}>
          <path d={p.d} className="cbv-arrow" markerEnd={'url(#cbv-head' + COLORS.indexOf(p.c) + ')'} />
          <circle cx={p.x} cy={p.y} r={3.5} className="cbv-dot" />
        </g>
      ))}
    </svg>
  );
}

/* ---------- kártyakereső ---------- */
type PickAt = { kind: PickKind; side?: 'me' | 'opp'; loc?: string; bfi?: number; sideFree?: boolean };
function CardPicker({ at, onPick, onClose }: { at: PickAt; onPick: (n: string, side: 'me' | 'opp') => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [side, setSide] = useState<'me' | 'opp'>(at.side || 'me');
  const res = useMemo(() => searchCards(at.kind, q), [at.kind, q]);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { inp.current?.focus(); }, []);
  const where = at.kind === 'board' ? (at.loc === 'base' ? 'base' : locLabelOf(chainApi.get!(), at.loc || 'base')) : '';
  return (
    <div className="cb2-ov" onClick={onClose}>
      <div className="pb-panel cb2-pick" role="dialog" aria-label={'Kártyakereső: ' + PICK_TITLE[at.kind]} onClick={(e) => e.stopPropagation()}>
        <div className="pb-mh"><b>{PICK_TITLE[at.kind]}</b>{where && <span className="note">{(side === 'me' ? 'saját ' : 'ellenfél ') + where}</span>}
          <button type="button" className="pb-x" aria-label="Bezárás" onClick={onClose}><X size={18} /></button></div>
        {at.sideFree && (
          <div className="cb2-seg" role="group" aria-label="Ki játssza ki">
            <span>Ki játssza ki:</span>
            {(['me', 'opp'] as const).map((s) => <button key={s} type="button" aria-pressed={side === s} className={side === s ? 'on' : ''} onClick={() => setSide(s)}>{s === 'me' ? 'Te' : 'Ellenfél'}</button>)}
          </div>
        )}
        <input ref={inp} type="search" className="cb2-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lap neve vagy tag" aria-label="Keresés a lapok között"
          onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) onPick(res[0].n, side); }} />
        <ul className="cb2-res">
          {res.map((c, k) => (
            <li key={c.n}><button type="button" onClick={() => onPick(c.n, side)}>
              {c.img ? <img src={IMGBASE + c.img} alt="" loading={k < 12 ? 'eager' : 'lazy'} className={c.t === 'Battlefield' ? 'land' : ''} /> : <span className="cb2-noimg" />}
              <span className="cb2-rn"><b>{c.n}</b><small>{c.t}{c.e != null && c.e !== '' ? ' · ' + c.e + ' Energy' : ''}{c.p ? ' · ' + c.p + ' Power' : ''}{c.m != null && c.m !== '' && c.t === 'Unit' ? ' · ' + c.m + ' Might' : ''}</small></span>
            </button></li>
          ))}
          {!res.length && <li className="note">Nincs találat.</li>}
        </ul>
      </div>
    </div>
  );
}

/* ---------- akció-menü ---------- */
type MItem = { label: string; run?: () => void; dis?: string; ref?: string; tone?: string; need?: string };
type Menu = { title: string; card?: string; sub?: string; items: MItem[]; key: string };
function ActionMenu({ m, onClose }: { m: Menu; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, [m.key]);
  return (
    <div className="cb2-ov" onClick={onClose}>
      <div className="pb-panel menu cb2-menu" role="dialog" aria-label={m.title} onClick={(e) => e.stopPropagation()}>
        <div className="pb-mh">{m.card && imgOf(m.card) && <img className="cb2-mimg" src={imgOf(m.card)} alt="" />}<span><b>{m.title}</b>{m.sub && <small className="note">{m.sub}</small>}</span>
          <button type="button" className="pb-x" aria-label="Bezárás" onClick={onClose}><X size={18} /></button></div>
        {m.items.map((it, k) => (
          <div key={k}>
            <button ref={k === 0 ? first : undefined} type="button" className={'pb-btn ' + (it.tone || 'act')} disabled={!!it.dis} onClick={() => it.run?.()}>{it.label}</button>
            {it.dis && <p className="pb-why">{it.ref && <Refs r={it.ref} />}{it.dis}</p>}
            {!it.dis && it.need && <p className="pb-why cb2-need">Utána: {it.need}.</p>}
          </div>
        ))}
        {m.card && <button type="button" className="pb-link" onClick={() => { onClose(); openCard(m.card!); }}>Lap részletei</button>}
      </div>
    </div>
  );
}

/* ---------- board lap tulajdonságai (a builder board sorának mezői) ---------- */
function PropsPanel({ i, onClose }: { i: number; onClose: () => void }) {
  const CS = chainApi.get!();
  const b = CS.bd[i]; if (!b) return null;
  const c = cardOf(b.n); const isU = c?.t === 'Unit', isG = c?.t === 'Gear';
  const set = (fn: (b: any) => void) => chainApi.commit!((cs) => fn(cs.bd[i]));
  const units = CS.bd.map((x: any, k: number) => [x, k]).filter(([x]: any) => cardOf(x.n)?.t === 'Unit');
  return (
    <div className="cb2-ov" onClick={onClose}>
      <div className="pb-panel cb2-props" role="dialog" aria-label={'Tulajdonságok: ' + b.n} onClick={(e) => e.stopPropagation()}>
        <div className="pb-mh">{imgOf(b.n) && <img className="cb2-mimg" src={imgOf(b.n)} alt="" />}<span><b>{b.n}</b><small className="note">Tulajdonságok a kiinduló helyzetben</small></span>
          <button type="button" className="pb-x" aria-label="Bezárás" onClick={onClose}><X size={18} /></button></div>
        <div className="cb2-seg" role="group" aria-label="Irányító"><span>Irányító:</span>
          {(['A', 'B'] as const).map((p) => <button key={p} type="button" aria-pressed={b.pl === p} className={b.pl === p ? 'on' : ''} onClick={() => set((x) => { x.pl = p; })}>{p === 'A' ? 'Te' : 'Ellenfél'}</button>)}</div>
        {isU && <div className="cb2-grid">
          <label>Might <input type="number" min={0} max={30} defaultValue={b.m ?? ''} placeholder={String(c.m ?? '')} onChange={(e) => set((x) => { x.m = e.target.value === '' ? null : +e.target.value; })} /></label>
          <label>Damage <input type="number" min={0} max={30} defaultValue={b.d || 0} onChange={(e) => set((x) => { x.d = +e.target.value || 0; })} /></label>
        </div>}
        <div className="cb2-chks">
          <label className="chk"><input type="checkbox" defaultChecked={!!b.ex} onChange={(e) => set((x) => { x.ex = e.target.checked; })} /> exhausted</label>
          {isU && <label className="chk"><input type="checkbox" defaultChecked={!!b.st} onChange={(e) => set((x) => { x.st = e.target.checked; })} /> stunned</label>}
          {isU && <label className="chk"><input type="checkbox" defaultChecked={!!b.bu} onChange={(e) => set((x) => { x.bu = e.target.checked; })} /> buff (+1)</label>}
          <label className="chk"><input type="checkbox" defaultChecked={!!b.emp} onChange={(e) => set((x) => { x.emp = e.target.checked; })} /> Empowered</label>
        </div>
        {isU && <label className="cb2-row">Combat jelölés <select defaultValue={b.atk || ''} onChange={(e) => set((x) => { x.atk = e.target.value; })}><option value="">nincs</option><option value="a">attacker</option><option value="d">defender</option></select></label>}
        {isG && <label className="cb2-row">Csatolás <select defaultValue={b.on == null ? '' : String(b.on)} onChange={(e) => set((x) => { x.on = e.target.value === '' ? null : +e.target.value; if (x.on != null) x.loc = CS.bd[x.on].loc; })}>
          <option value="">nincs felcsatolva</option>{units.map(([x, k]: any) => <option key={k} value={k}>rajta: {(x.pl === 'A' ? 'Te: ' : 'Ellenfél: ') + x.n + ' (' + locLabelOf(CS, x.loc) + ')'}</option>)}</select></label>}
        <button type="button" className="pb-btn primary" onClick={onClose}>Kész</button>
      </div>
    </div>
  );
}

type Mode =
  | { k: 'target'; j: number; ti: number }
  | { k: 'move'; uid: string; n: string; dests: string[]; std: boolean }
  | { k: 'hide'; side: 'me' | 'opp'; hi: number; n: string; dests: number[] }
  | null;

/** A Chain pályás építője: a pálya a lejátszással, akció-menü, kártyakereső, célzás kattintással, idővonal, lépés-panel. */
function ChainEditor({ frames, csv }: { frames: ChainFrame[]; csv: number }) {
  const CS = chainApi.get!();
  const eff = useMemo<ChainFrame[]>(() => (frames.length ? frames : [setupFrame(CS)]), [frames, csv]); // eslint-disable-line react-hooks/exhaustive-deps
  const sf = useMemo(() => stepFrames(eff), [eff]);
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [pick, setPick] = useState<PickAt | null>(null);
  const [props, setProps] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [cfocus, setCfocus] = useState<{ bi: number; atk: 'me' | 'opp'; n: number } | null>(null);
  const jump = useRef<number | 'keep' | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => { setHostEl(host.current); }, []);

  // új frame-ek: az építő után a lépés frame-jére ugrik, különben (példa, link, űrlap) az elejére
  useEffect(() => {
    const J = jump.current; jump.current = null;
    if (J === 'keep') setI((k) => Math.min(k, eff.length - 1));
    else if (typeof J === 'number') setI(sf[J] ?? Math.max(0, eff.length - 1));
    else { setI(0); setMode(null); setSel(null); setMenu(null); }
    setPlay(false);
  }, [frames]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!play) return;
    const t = window.setInterval(() => setI((k) => { if (k >= eff.length - 1) { setPlay(false); return k; } return k + 1; }), STEP_MS);
    return () => window.clearInterval(t);
  }, [play, eff.length]);
  useEffect(() => { if (sel != null && sel >= CS.steps.length) setSel(null); }, [csv]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 9000); return () => clearTimeout(t); }, [msg]);

  const ci = Math.max(0, Math.min(i, eff.length - 1));
  const f = useMemo(() => fullFrame(eff[ci], CS, ci, sf), [eff, ci, sf, csv]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = ci > 0 ? fullFrame(eff[ci - 1], CS, ci - 1, sf).board : undefined;

  /* ---- CS írása ---- */
  const commit = (fn: (cs: any) => void, j: number | 'keep' = 'keep', ms?: number) => { jump.current = j; chainApi.commit!(fn, ms); };
  const close = () => { setMenu(null); setPick(null); setProps(null); };
  const addStep = (st: any) => {
    const j = CS.steps.length;
    commit((cs) => { cs.steps.push(st); }, j, 0);
    close(); setSel(j);
    const inf: any = stepInfo(chainApi.get!(), chainApi.get!().steps[j]);
    if (inf?.list?.length) { setMode({ k: 'target', j, ti: 0 }); setMsg(''); } else setMode(null);
  };
  const lastPl = () => { const l = [...CS.steps].reverse().find((s: any) => s.k === 'card' || s.k === 'ab'); return l ? (l.pl === 'A' ? 'opp' : 'me') : 'me'; };

  /* ---- célzás ---- */
  const tOpts = useMemo<TgOpt[]>(() => (mode?.k === 'target' ? targetOpts(CS, mode.j, mode.ti) : []), [mode, csv]); // eslint-disable-line react-hooks/exhaustive-deps
  const tInf: any = mode?.k === 'target' && CS.steps[mode.j] ? stepInfo(CS, CS.steps[mode.j]) : null;
  const tSlot = tInf?.list?.[mode?.k === 'target' ? mode.ti : 0];
  const chainStep = (ii: number) => {
    const t = (f.board.chain || [])[ii] || '';
    let best: number | null = null;
    CS.steps.forEach((s: any, j: number) => { if (sf[j] != null && sf[j] <= ci && t.startsWith(stepName(CS, s).n)) best = j; });
    return best;
  };
  const pickTarget = (v: string) => {
    if (mode?.k !== 'target') return;
    const o = tOpts.find((x) => x.v === v);
    if (!o) { setMsg('Ez nem lehet ennek a célpontja: ' + slotText(tSlot, mode.ti) + '.'); return; }
    if (!o.ok) { setMsg((o.ref ? o.ref + ': ' : '') + 'Nem választható: ' + (o.why || 'a szabályok szerint illegális') + '.'); return; }
    const j = mode.j, ti = mode.ti;
    const cur = (CS.steps[j].tg || [])[ti];
    commit((cs) => { const s = cs.steps[j]; s.tg = s.tg || []; s.tg[ti] = cur === v ? '' : v; }, j, 0);
    const n = tInf.list.length;
    if (cur === v) return;
    if (ti + 1 < n) setMode({ k: 'target', j, ti: ti + 1 }); else if (n === 1) { setMode(null); setMsg('Célpont kiválasztva. Válaszolhatsz: kattints egy lapra vagy a Chain + gombjára.'); }
  };

  /* ---- menük ---- */
  const lg = (r: Legal) => (r.ok ? { need: r.need } : { dis: r.why, ref: r.ref });
  const abItems = (src: string, pl: 'A' | 'B'): MItem[] => {
    const { c, abs, trs } = abilitiesFor(CS, src);
    if (!c) return [];
    const out: MItem[] = abs.map((a: any, ai: number) => { const st = { k: 'ab', src, ai, pl, n: c.n, tg: [], ext: {} }; return { label: 'Aktiválás: ' + String(a.label).slice(0, 70), run: () => addStep(st), ...lg(tryStep(CS, st)) }; });
    if (!abs.length) out.push({ label: 'Aktiválás', dis: 'Ennek a lapnak nincs aktiválható abilityje.' });
    trs.forEach((a: any, ti: number) => { const st = { k: 'tg', src, ti, pl, n: c.n, tg: [], ext: {} }; out.push({ label: 'Trigger a chainre: ' + String(a.label).slice(0, 60), tone: 'gold', run: () => addStep(st), ...lg(tryStep(CS, st)) }); });
    return out;
  };
  const moveItems = (uid: string, n: string): MItem[] => {
    const m = /^([bs])(\d+)$/.exec(uid); if (!m) return [];
    const k = +m[2];
    const cur = m[1] === 'b' ? CS.bd[k].loc : (CS.steps[k].loc || 'base');
    const all = ['base', 'bf0', 'bf1'].filter((l) => l !== cur);
    const out: MItem[] = [];
    if (m[1] === 'b') {
      const b = CS.bd[k]; const c = cardOf(b.n);
      let dis = '', ref = '';
      if (c?.t !== 'Unit') { dis = 'Standard Move-ja csak unitnak van.'; ref = '144'; }
      else if (b.ex) { dis = 'A unit exhausted. A Standard Move költsége a unit exhaustolása, ezért exhausted unit nem mozoghat így.'; ref = '144.2'; }
      const gank = /\[Ganking\]/.test(c?.txt || '');
      const std = cur === 'base' ? ['bf0', 'bf1'] : gank ? all : ['base'];
      out.push({ label: 'Mozgatás (Standard Move)', dis: dis || undefined, ref: ref || undefined, need: !dis ? 'célzóna kattintással; a unit exhausted lesz (144.2)' + (cur !== 'base' && !gank ? '; battlefieldről battlefieldre csak Ganking képességgel (144.4.c.1)' : '') : undefined,
        run: () => { close(); setMode({ k: 'move', uid, n, dests: std, std: true }); } });
    }
    out.push({ label: m[1] === 'b' ? 'Áthelyezés a kiinduló helyzetben' : 'Hova kerül kijátszáskor', tone: 'gold', run: () => { close(); setMode({ k: 'move', uid, n, dests: all, std: false }); } });
    return out;
  };
  const combatItem = (loc: string, side: 'me' | 'opp'): MItem[] => /^bf\d$/.test(loc)
    ? [{ label: 'Combat ezen a battlefielden', tone: 'energy', run: () => { close(); setCfocus({ bi: +loc.slice(2), atk: side, n: Date.now() }); } }]
    : [{ label: 'Combat', dis: 'Combat csak battlefielden van; a base-ben álló unit nem harcol.', ref: '463' }];

  const openUnit = (t: Extract<PTarget, { k: 'unit' }>) => {
    const uid = t.id || ''; const m = /^([bs])(\d+)$/.exec(uid);
    if (!m) { openCard(t.n); return; }
    const k = +m[2];
    if (m[1] === 'b') {
      const b = CS.bd[k]; if (!b) return;
      setMenu({ key: uid + csv, title: b.n, card: b.n, sub: (b.pl === 'A' ? 'saját' : 'ellenfél') + ', ' + locLabelOf(CS, b.loc) + ', kiinduló helyzet', items: [
        ...abItems(uid, b.pl), ...moveItems(uid, b.n), ...combatItem(b.loc, sideOf(b.pl)),
        { label: 'Tulajdonságok (Might, damage, exhausted, stunned, buff, Empowered, csatolás)', tone: 'energy', run: () => { setMenu(null); setProps(k); } },
        { label: 'Eltávolítás', tone: 'del', run: () => { close(); jump.current = 'keep'; chainApi.delBd!(k); } },
      ] });
    } else {
      const s = CS.steps[k]; if (!s) return;
      setMenu({ key: uid + csv, title: s.n, card: s.n, sub: (k + 1) + '. lépésben kijátszva', items: [
        ...abItems(uid, s.pl), ...moveItems(uid, s.n), ...combatItem(s.loc || 'base', sideOf(s.pl)),
        { label: 'Lépés szerkesztése', tone: 'energy', run: () => { close(); setSel(k); } },
        { label: 'A lépés törlése', tone: 'del', run: () => { close(); chainApi.delStep!(k); } },
      ] });
    }
  };
  const playItem = (st: any, label = 'Kijátszás'): MItem => ({ label, run: () => addStep(st), ...lg(tryStep(CS, st)) });
  const openHand = (side: 'me' | 'opp', hi: number, n: string) => {
    const p = plOf(side); const csN = (f.board[side] as any).handCS ?? 0;
    const c = cardOf(n); if (!c) return;
    if (hi >= csN) { setMenu({ key: 'h' + hi, title: n, card: n, sub: 'egy hatás tette a kézbe', items: [] }); return; }
    const st = { k: 'card', n, pl: p, from: 'hand', ...(isPerm(c) ? { loc: 'base' } : {}), tg: [], ext: {} };
    const dests = [0, 1].filter((b) => CS.bf[b].n && CS.bf[b].c === p && !CS.bf[b].fd);
    const hide: MItem = !hasHidden(c) ? { label: 'Elrejtés (Hidden)', dis: 'Csak [Hidden] keywordös lap rejthető el.', ref: '811.1.c' }
      : !dests.length ? { label: 'Elrejtés (Hidden)', dis: 'Elrejteni csak olyan battlefieldre lehet, amit te kontrollálsz, és nincs rajta facedown lap.', ref: '811.1.b' }
      : { label: 'Elrejtés (Hidden)', tone: 'gold', need: 'a battlefield kiválasztása', run: () => { close(); if (dests.length === 1) doHide(side, hi, n, dests[0]); else setMode({ k: 'hide', side, hi, n, dests }); } };
    setMenu({ key: 'h' + side + hi + csv, title: n, card: n, sub: (side === 'me' ? 'saját' : 'ellenfél') + ' kéz', items: [
      playItem(st, 'Kijátszás' + (isPerm(c) ? ' (a base-be; a hely a lépésnél állítható)' : '')), hide,
      { label: 'Eltávolítás a kézből', tone: 'del', run: () => { close(); commit((cs) => { cs.hand[p].splice(hi, 1); }); } },
    ] });
  };
  const doHide = (side: 'me' | 'opp', hi: number, n: string, b: number) => {
    const p = plOf(side);
    commit((cs) => { cs.hand[p].splice(hi, 1); cs.bf[b].fd = p; cs.bf[b].fdn = n; });
    setMode(null); setMsg(n + ' elrejtve: facedown itt: ' + (CS.bf[b].n || (b + 1) + '. battlefield') + ' (811.1.b).');
  };
  const openFd = (b: number) => {
    const bf = CS.bf[b];
    if (!bf.fd) {
      if (!bf.c) { setMsg('Előbb add meg, ki kontrollálja a battlefieldet: a facedown lap a kontrolláló játékosé (107.3, 811.1.b). Kattints a battlefield lapjára.'); return; }
      setPick({ kind: 'hidden', bfi: b, side: sideOf(bf.c) }); return;
    }
    const n = bf.fdn || '';
    const items: MItem[] = n ? [playItem({ k: 'card', n, pl: bf.fd, from: 'facedown', loc: 'bf' + b, tg: [], ext: {} }, 'Kijátszás facedown-ból')]
      : [{ label: 'Kijátszás facedown-ból', dis: 'Ismeretlen facedown lap: a nevét a Chain + gombjával add meg, "facedown-ból" forrással.' }];
    items.push({ label: 'Vissza a kézbe', tone: 'gold', run: () => { close(); commit((cs) => { if (n) cs.hand[bf.fd].push(n); cs.bf[b].fd = ''; cs.bf[b].fdn = ''; }); } });
    items.push({ label: 'Eltávolítás', tone: 'del', run: () => { close(); commit((cs) => { cs.bf[b].fd = ''; cs.bf[b].fdn = ''; }); } });
    setMenu({ key: 'fd' + b + csv, title: n || 'Facedown lap', card: n || undefined, sub: (bf.fd === 'A' ? 'saját' : 'ellenfél') + ' facedown, ' + (bf.n || (b + 1) + '. battlefield'), items });
  };
  const openLegend = (side: 'me' | 'opp') => {
    const p = plOf(side); const n = CS.lg[p];
    if (!n) { setPick({ kind: 'legend', side }); return; }
    setMenu({ key: 'L' + p + csv, title: n, card: n, sub: (side === 'me' ? 'saját' : 'ellenfél') + ' legend', items: [
      ...abItems('L' + p, p),
      { label: 'Csere', tone: 'energy', run: () => { setMenu(null); setPick({ kind: 'legend', side }); } },
      { label: 'Eltávolítás', tone: 'del', run: () => { close(); commit((cs) => { cs.lg[p] = ''; }); } },
    ] });
  };
  const openChamp = (side: 'me' | 'opp') => {
    const p = plOf(side); const n = (CS.ch || {})[p];
    if (!n || !f.board[side].champion) { if (!n) setPick({ kind: 'champion', side }); return; }
    setMenu({ key: 'C' + p + csv, title: n, card: n, sub: (side === 'me' ? 'saját' : 'ellenfél') + ' Champion Zone', items: [
      playItem({ k: 'card', n, pl: p, from: 'champ', loc: 'base', tg: [], ext: {} }, 'Kijátszás a Champion Zone-ból'),
      { label: 'Csere', tone: 'energy', run: () => { setMenu(null); setPick({ kind: 'champion', side }); } },
      { label: 'Eltávolítás', tone: 'del', run: () => { close(); commit((cs) => { cs.ch[p] = ''; }); } },
    ] });
  };
  const openBf = (b: number) => {
    const bf = CS.bf[b];
    if (!bf.n) { setPick({ kind: 'battlefield', bfi: b }); return; }
    const ctl = (c: string, l: string): MItem => ({ label: 'Kontroll: ' + l, tone: 'gold', dis: bf.c === c ? 'Most is így áll.' : undefined, run: () => { close(); commit((cs) => { cs.bf[b].c = c; }); } });
    setMenu({ key: 'bf' + b + csv, title: bf.n, card: bf.n, sub: (b + 1) + '. battlefield', items: [
      ctl('A', 'te'), ctl('B', 'ellenfél'), ctl('', 'senki'),
      ...combatItem('bf' + b, bf.c === 'A' ? 'opp' : 'me'),
      { label: 'Csere', tone: 'energy', run: () => { setMenu(null); setPick({ kind: 'battlefield', bfi: b }); } },
      { label: 'Eltávolítás', tone: 'del', run: () => { close(); commit((cs) => { cs.bf[b].n = ''; }); } },
    ] });
  };
  const onPicked = (n: string, side: 'me' | 'opp') => {
    const at = pick!; const p = plOf(side);
    if (at.kind === 'play') {
      const c = cardOf(n);
      addStep({ k: 'card', n, pl: p, from: 'hand', ...(isPerm(c) ? { loc: 'base' } : {}), tg: [], ext: {} });
      return;
    }
    commit((cs) => {
      cs.hand = cs.hand || { A: [], B: [] }; cs.ch = cs.ch || { A: '', B: '' };
      if (at.kind === 'legend') cs.lg[p] = n;
      else if (at.kind === 'champion') cs.ch[p] = n;
      else if (at.kind === 'battlefield') cs.bf[at.bfi!].n = n;
      else if (at.kind === 'hand') cs.hand[p].push(n);
      else if (at.kind === 'hidden') { cs.bf[at.bfi!].fd = p; cs.bf[at.bfi!].fdn = n; }
      else if (at.kind === 'board') cs.bd.push({ n, pl: p, loc: at.loc || 'base', d: 0 });
    });
    setPick(null);
    setMsg(n + ' hozzáadva. Kattints rá a lehetséges akciókért.');
  };

  /* ---- Playmat vezérlés ---- */
  const zoneLoc = (loc: string) => (loc === 'obase' ? 'base' : loc);
  const doMove = (loc: string) => {
    if (mode?.k !== 'move') return;
    const { uid, n, std } = mode; setMode(null);
    const err = chainApi.moveUnit!(uid, loc);
    if (err) { setMsg(err); return; }
    if (std) commit((cs) => { cs.bd[+uid.slice(1)].ex = true; });
    setMsg(n + (std ? ' Standard Move-val átment, és exhausted lett (144.2).' : ' áthelyezve: ' + locLabelOf(CS, loc) + '. Az elemzés újrafutott.'));
  };
  const ctl: PlayCtl = {
    glow: (t): Glow => {
      if (mode?.k === 'target') {
        const tg = (CS.steps[mode.j]?.tg || [])[mode.ti];
        const g = (v: string): Glow => { const o = tOpts.find((x) => x.v === v); return !o ? '' : tg === v ? 'sel' : o.ok ? 'act' : ''; };
        if (t.k === 'unit') return g(t.id || '');
        if (t.k === 'zone' && /^bf\d$/.test(t.loc)) { const o = tOpts.find((x) => x.v === 'F' + t.loc[2]); return o?.ok ? 'dest' : ''; }
        if (t.k === 'chain') { const s = chainStep(t.i); return s == null ? '' : g('s' + s); }
        return '';
      }
      if (mode?.k === 'move') {
        if (t.k === 'unit') return t.id === mode.uid ? 'sel' : '';
        if (t.k === 'zone') { const side = mode.uid[0] === 'b' ? sideOf(CS.bd[+mode.uid.slice(1)].pl) : sideOf(CS.steps[+mode.uid.slice(1)].pl); if (t.loc === 'base' && side === 'opp' || t.loc === 'obase' && side === 'me') return ''; return mode.dests.includes(zoneLoc(t.loc)) ? 'dest' : ''; }
        return '';
      }
      if (mode?.k === 'hide') return t.k === 'fd' && mode.dests.includes(t.bfi) ? 'dest' : '';
      if (sel != null && t.k === 'chain') return chainStep(t.i) === sel ? 'sel' : '';
      return '';
    },
    on: (t) => {
      window.dispatchEvent(new Event('rb:hide-tip'));
      setPlay(false);
      if (t.k === 'add' && mode) setMode(null);
      else if (mode?.k === 'target') {
        if (t.k === 'unit') pickTarget(t.id || '');
        else if (t.k === 'zone' && /^bf\d$/.test(t.loc)) pickTarget('F' + t.loc[2]);
        else if (t.k === 'chain') { const s = chainStep(t.i); if (s != null) pickTarget('s' + s); }
        return;
      }
      else if (mode?.k === 'move') {
        if (t.k === 'unit' && t.id === mode.uid) { setMode(null); return; }
        if (t.k === 'zone' && ctl.glow(t) === 'dest') doMove(zoneLoc(t.loc));
        return;
      }
      else if (mode?.k === 'hide') { if (t.k === 'fd' && mode.dests.includes(t.bfi)) doHide(mode.side, mode.hi, mode.n, t.bfi); return; }
      if (t.k === 'unit') openUnit(t);
      else if (t.k === 'hand') openHand(t.side, t.i, t.n);
      else if (t.k === 'fd') openFd(t.bfi);
      else if (t.k === 'legend') openLegend(t.side);
      else if (t.k === 'champion') openChamp(t.side);
      else if (t.k === 'zone' && /^bf\d$/.test(t.loc)) openBf(+t.loc[2]);
      else if (t.k === 'chain') { const s = chainStep(t.i); if (s != null) setSel(s); }
      else if (t.k === 'add') {
        if (t.z === 'bfcard') setPick({ kind: 'battlefield', bfi: t.bfi });
        else if (t.z === 'hand') setPick({ kind: 'hand', side: t.side });
        else if (t.z === 'chain') setPick({ kind: 'play', side: lastPl(), sideFree: true });
        else setPick({ kind: 'board', side: t.side, loc: t.z === 'base' ? 'base' : 'bf' + t.bfi, bfi: t.bfi });
      }
    },
    label: (t) => (t.k === 'unit' ? t.n + (t.side === 'me' ? ', saját' : ', ellenfél') + (mode?.k === 'target' ? ', célpontként' : ', akciók') : t.k === 'zone' ? 'Cél: ' + locLabelOf(CS, zoneLoc(t.loc)) : ''),
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (menu || pick || props != null) close(); else if (mode) setMode(null); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  /* ---- egérrel áthúzás (a kiinduló helyzet szerkesztése) ---- */
  useLayoutEffect(() => {
    host.current?.querySelectorAll<HTMLElement>('.pm-unit[data-uid]').forEach((el) => { const ok = /^[bs]\d+$/.test(el.dataset.uid || ''); el.draggable = ok; el.classList.toggle('dnd', ok); });
  });
  const drag = useRef<{ uid: string; side: string } | null>(null);
  const zoneOf = (t: EventTarget | null): { el: HTMLElement; loc: string; side?: string } | null => {
    const e = t as HTMLElement | null; if (!e || !e.closest) return null;
    const b = e.closest<HTMLElement>('.pm2-base'); if (b) return { el: b, loc: 'base', side: b.classList.contains('me') ? 'me' : 'opp' };
    const bf = e.closest<HTMLElement>('.pm2-bf'); if (bf) return { el: bf, loc: 'bf' + (bf.dataset.bfi ?? '0') };
    return null;
  };
  const clearHi = () => host.current?.querySelectorAll('.dropok,.dropno').forEach((x) => x.classList.remove('dropok', 'dropno'));
  const onDragStart = (e: React.DragEvent) => {
    const u = (e.target as HTMLElement).closest<HTMLElement>('.pm-unit.dnd'); if (!u) return;
    drag.current = { uid: u.dataset.uid!, side: u.classList.contains('opp') ? 'opp' : 'me' };
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'unit:' + u.dataset.uid); setPlay(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!drag.current) return; const z = zoneOf(e.target); clearHi(); if (!z) return;
    const bad = z.side != null && z.side !== drag.current.side; z.el.classList.add(bad ? 'dropno' : 'dropok');
    if (!bad) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  };
  const onDrop = (e: React.DragEvent) => {
    const d = drag.current; drag.current = null; clearHi(); if (!d) return;
    const z = zoneOf(e.target); if (!z || (z.side != null && z.side !== d.side)) return;
    e.preventDefault(); jump.current = 'keep';
    const err = chainApi.moveUnit!(d.uid, z.loc);
    setMsg(err || 'Áthelyezve a kiinduló helyzetben, az elemzés újrafutott.');
  };

  /* ---- idővonal ---- */
  const dragJ = useRef(-1);
  const [dropAt, setDropAt] = useState(-1);
  const mv = (from: number, to: number) => { jump.current = to; if (chainApi.moveStep!(from, to)) setSel(to); };
  const stepStatus = (j: number): ['ok' | 'bad' | 'need' | 'off', string] => {
    const k = sf[j]; if (k == null) return ['off', ''];
    const l = eff[k].label;
    if (/nem szabályos|lekerül/.test(l)) {
      const r = eff[k].changes.find((c) => /Nem szabályos|lekerül/.test(c[1]));
      const t = r ? r[1].replace(/^Nem szabályos:\s*/, '').replace(/^[^?]*\?\s*/, '').replace(/\.\s*Kimarad\.?$/, '') : l;
      return /nincs megadva/.test(t) ? ['need', 'Hiányzik: ' + t.replace(/^nincs megadva (a )?/, '') + '.'] : ['bad', (r && r[0] ? r[0] + ': ' : '') + t + '.'];
    }
    return ['ok', ''];
  };
  const togglePlay = () => { if (!play && ci >= eff.length - 1) setI(0); setPlay(!play); };
  const story: string[] = chainApi.last && !chainApi.last.empty ? chainApi.last.story : [];
  const sk = stateKeysOf(CS);
  const stRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chainApi.stateEl!(sk.length ? stRef.current : null); return () => chainApi.stateEl!(null); }, [sk.length]);

  const banner = mode?.k === 'target' && tSlot ? (
    <div className="cb2-mode" role="status">
      <div><b>{stepName(CS, CS.steps[mode.j]).n}: {slotText(tSlot, mode.ti)}</b>{tInf.list.length > 1 && <span className="note"> ({mode.ti + 1} / {tInf.list.length})</span>}
        <span className="note"> Kattints egy kiemelt lapra a pályán, vagy válassz itt:</span></div>
      <div className="cb2-chips">
        {tOpts.map((o) => (
          <button key={o.v} type="button" className={'cb2-chip' + (o.ok ? '' : ' bad') + ((CS.steps[mode.j].tg || [])[mode.ti] === o.v ? ' on' : '')} onClick={() => pickTarget(o.v)} title={o.ok ? '' : o.why} aria-pressed={(CS.steps[mode.j].tg || [])[mode.ti] === o.v}>
            {o.label.replace(/^Board: /, '')}{!o.ok && <small> (nem választható)</small>}
          </button>
        ))}
        {!tOpts.length && <span className="note">Nincs választható lap a pályán ehhez a célponthoz. A Haladó szerkesztésben megadhatsz pályán kívüli célpontot.</span>}
      </div>
      <div className="cb2-mbtn">
        {tInf.list.length > 1 && mode.ti > 0 && <button type="button" className="btn sec" onClick={() => setMode({ ...mode, ti: mode.ti - 1 })}>Előző célpont</button>}
        {tInf.list.length > 1 && mode.ti + 1 < tInf.list.length && <button type="button" className="btn sec" onClick={() => setMode({ ...mode, ti: mode.ti + 1 })}>Következő célpont</button>}
        <button type="button" className="btn" onClick={() => setMode(null)}>Kész</button>
      </div>
    </div>
  ) : mode?.k === 'move' ? (
    <div className="cb2-mode" role="status"><div>Hova kerüljön <b>{mode.n}</b>? Kattints egy kiemelt zónára.</div><div className="cb2-mbtn"><button type="button" className="btn sec" onClick={() => setMode(null)}>Mégse</button></div></div>
  ) : mode?.k === 'hide' ? (
    <div className="cb2-mode" role="status"><div>Melyik battlefieldre rejted el: <b>{mode.n}</b>? Kattints egy kiemelt facedown helyre.</div><div className="cb2-mbtn"><button type="button" className="btn sec" onClick={() => setMode(null)}>Mégse</button></div></div>
  ) : null;

  const selStep = sel != null ? CS.steps[sel] : null;
  const turn = CS.turn ? sideOf(CS.turn) : CS.steps[0] ? sideOf(CS.steps[0].pl || 'A') : 'me';

  return (
    <>
      <div className="cb2-main">
        <div className="panel pad cbv cb2-stage">
          {banner}
          <div className="cbv-mat" ref={host} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={() => { drag.current = null; clearHi(); }}>
            <Playmat key={ci} b={f.board} prev={prev} turn={turn} onlyKnown ctl={ctl} edit explain={false} />
            <Arrows host={hostEl} arrows={f.arrows} tick={ci * 1000 + csv} />
          </div>
          <p className="note cb2-msg" role="status" aria-live="polite">{msg || (CS.steps.length || CS.bd.length || CS.lg.A || CS.lg.B ? 'Kattints egy lapra az akciókért, a + gombokkal adhatsz lapot a zónákhoz. Egérrel át is húzhatod a lapokat.' : 'Kezdd a + gombokkal: legend, battlefield, unitok, kéz; a chain lépéseit a lapokra kattintva vagy a Chain zóna + gombjával adod hozzá.')}</p>
        </div>

        <div className="panel pad cb2-tl cbv">
          <h2>Lejátszás</h2>
          <div className="cbv-ctl">
            <button className="btn sec" disabled={ci === 0} onClick={() => { setPlay(false); setI(ci - 1); }}>Előző</button>
            <button className="btn sec" disabled={ci >= eff.length - 1} onClick={() => { setPlay(false); setI(ci + 1); }}>Következő</button>
            <button className="btn" aria-pressed={play} disabled={eff.length < 2} onClick={togglePlay}>{play ? 'Megállítás' : 'Lejátszás'}</button>
            <span className="cbv-step" aria-live="polite"><b>{ci + 1} / {eff.length} lépés:</b> {eff[ci].label}</span>
          </div>
          <div className="cbv-dots" aria-hidden>{eff.map((_, k) => <i key={k} className={k === ci ? 'on' : k < ci ? 'seen' : ''} onClick={() => { setPlay(false); setI(k); }} />)}</div>
          {(eff[ci].changes.length > 0 || eff[ci].mt) && (
            <div className="cbv-chg">
              <b>Mi változott?</b>
              <ul>{eff[ci].changes.map(([ref, txt, man], k) => (
                <li key={k}>{ref ? <Refs r={ref} /> : <span />}<span>{man ? <span className="cbman" title="A Haladó szerkesztés Így értelmezem a lapot blokkjában kézzel beállított értelmezés alapján">kézzel beállítva</span> : null}{txt}</span></li>
              ))}</ul>
              {eff[ci].mt && <MistargetBox mt={eff[ci].mt!} />}
            </div>
          )}
          <h2 className="cb2-h2">Chain lépései</h2>
          {!CS.steps.length && <p className="note">Még nincs lépés. Kattints egy lapra a pályán (Kijátszás, Aktiválás, Trigger), vagy add hozzá alább.</p>}
          <ol className="cb2-steps" onDragOver={(e) => { if (dragJ.current >= 0) e.preventDefault(); }}>
            {CS.steps.map((s: any, j: number) => {
              const nm = stepName(CS, s); const [stt, why] = stepStatus(j);
              return (
                <li key={j} className={'cb2-sc' + (sel === j ? ' on' : '') + ' ' + stt + (dropAt === j ? ' drop' : '')} data-step={j} draggable
                  onDragStart={(e) => { dragJ.current = j; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'step:' + j); }}
                  onDragOver={(e) => { if (dragJ.current < 0) return; e.preventDefault(); setDropAt(j); }}
                  onDragLeave={() => setDropAt(-1)}
                  onDrop={(e) => { e.preventDefault(); const from = dragJ.current; dragJ.current = -1; setDropAt(-1); if (from >= 0 && from !== j) mv(from, j); }}
                  onDragEnd={() => { dragJ.current = -1; setDropAt(-1); }}>
                  <span className="cb2-grip" aria-hidden><GripVertical size={14} /></span>
                  <button type="button" className="cb2-sb" onClick={() => { setSel(sel === j ? null : j); if (sf[j] != null) { setPlay(false); setI(sf[j]); } }} aria-expanded={sel === j} aria-label={(j + 1) + '. lépés szerkesztése: ' + nm.n}>
                    <span className="no">{j + 1}.</span>
                    {nm.img && imgOf(nm.img) ? <img src={imgOf(nm.img)} alt="" /> : <span className="cb2-kimg">{s.k === 'res' ? 'R' : s.k === 'end' ? 'K' : '?'}</span>}
                    <span className="cb2-st"><b>{nm.n}</b><small>{s.k === 'card' || s.k === 'ab' ? (s.pl === 'A' ? 'Te' : 'Ellenfél') + ', ' : ''}{nm.kind}{j === 0 && s.k === 'card' ? ', első lépés' : ''}</small>
                      {(stt === 'bad' || stt === 'need') && <small className={'cb2-' + stt}>{why}</small>}</span>
                  </button>
                  <span className="cb2-sbtn">
                    <button type="button" className="linkbtn" disabled={!j} onClick={() => mv(j, j - 1)} aria-label={(j + 1) + '. lépés feljebb'}><ArrowUp size={14} /></button>
                    <button type="button" className="linkbtn" disabled={j >= CS.steps.length - 1} onClick={() => mv(j, j + 1)} aria-label={(j + 1) + '. lépés lejjebb'}><ArrowDown size={14} /></button>
                    <button type="button" className="linkbtn" onClick={() => { if (sel === j) setSel(null); jump.current = 'keep'; chainApi.delStep!(j); }} aria-label={(j + 1) + '. lépés törlése'}><X size={14} /></button>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="cb2-add">
            <button type="button" className="btn sec" onClick={() => setPick({ kind: 'play', side: lastPl(), sideFree: true })}><Plus size={14} /> Lap a chainre</button>
            <button type="button" className="btn sec" onClick={() => addStep({ k: 'res' })} title="Mindkét játékos passzol: a chain teteje most lefut (340.1)">+ Resolve</button>
            <button type="button" className="btn sec" onClick={() => addStep({ k: 'end' })} title="A chain lefut, majd Ending Phase (317)">+ Kör vége</button>
          </div>
          {selStep && <StepPanel j={sel!} csv={csv} onTarget={(ti) => setMode({ k: 'target', j: sel!, ti })} onClose={() => setSel(null)} bad={stepStatus(sel!)} />}
          {sk.length > 0 && <div className="cb2-state" ref={stRef} />}
        </div>
      </div>

      <details className="panel pad cb2-blk" id="cb-story"><summary><h2>Sorban ez történik</h2><span className="note">{story.length ? story.length + ' mondat' : 'még üres'}</span></summary>
        {story.length ? <ol className="flow">{story.map((x, k) => <li key={k}><span>{x}</span></li>)}</ol> : <p className="note">Adj hozzá egy lépést a chainhez.</p>}
      </details>
      <CombatPanel board={f.board} bfi={f.bfi} isLast={ci === eff.length - 1} frameLabel={(ci + 1) + '. lépés: ' + eff[ci].label} focus={cfocus} />

      {menu && <ActionMenu m={menu} onClose={() => setMenu(null)} />}
      {pick && <CardPicker at={pick} onPick={onPicked} onClose={() => setPick(null)} />}
      {props != null && <PropsPanel i={props} onClose={() => setProps(null)} />}
    </>
  );
}

/** A kiválasztott lépés panelje: ki játssza, célpontok (pályán választva), és csak a lap által igényelt mezők. */
function StepPanel({ j, csv, onTarget, onClose, bad }: { j: number; csv: number; onTarget: (ti: number) => void; onClose: () => void; bad: ['ok' | 'bad' | 'need' | 'off', string] }) {
  const CS = chainApi.get!(); const s = CS.steps[j];
  const qref = useRef<HTMLDivElement>(null);
  const [hasQ, setHasQ] = useState(false);
  useEffect(() => { chainApi.quick!(qref.current, j); setHasQ(!!qref.current?.innerHTML); }, [j, csv]);
  useEffect(() => () => chainApi.quick!(null, -1), []);
  if (!s) return null;
  const nm = stepName(CS, s);
  const inf: any = s.k === 'res' || s.k === 'end' ? null : stepInfo(CS, s);
  const list: any[] = inf?.list || [];
  const lbl = (ti: number, v: string) => { if (!v) return 'nincs kiválasztva'; if (v === 'x') return 'pályán kívüli (Haladó szerkesztés)'; const o = tgOptionsOf(CS, j, list[ti]).find((x: any) => x[0] === v); return o ? String(o[1]).replace(/^Board: /, '') : v; };
  const setPl = (p: 'A' | 'B') => chainApi.commit!((cs) => { cs.steps[j].pl = p; }, 0);
  return (
    <div className="cb2-sp" aria-label={(j + 1) + '. lépés beállításai'}>
      <div className="cb2-sph">{nm.img && imgOf(nm.img) && <img src={imgOf(nm.img)} alt="" />}<span><b>{j + 1}. {nm.n}</b><small className="note">{nm.kind}{s.k === 'card' || s.k === 'ab' ? (j ? ', válasz' : ', első lépés') : ''}</small></span>
        <button type="button" className="pb-x" aria-label="Lépés panel bezárása" onClick={onClose}><X size={16} /></button></div>
      {bad[0] === 'bad' && <p className="pb-why">Nem szabályos, kimarad: {bad[1]}</p>}{bad[0] === 'need' && <p className="pb-why cb2-need">{bad[1]}</p>}
      {s.k === 'res' && <p className="note">Mindkét játékos passzol: a chain legfelső eleme most resolve-ol (340.1), a következő lépések már erre az állapotra épülnek.</p>}
      {s.k === 'end' && <p className="note">A chain lefut, majd jön az Ending Phase: a kör végi hatások triggerelnek (317.1), utána Expiration Step (317.2).</p>}
      {(s.k === 'card' || s.k === 'ab') && (
        <div className="cb2-seg" role="group" aria-label="Ki játssza"><span>Ki:</span>
          {(['A', 'B'] as const).map((p) => <button key={p} type="button" aria-pressed={s.pl === p} className={s.pl === p ? 'on' : ''} onClick={() => setPl(p)}>{p === 'A' ? 'Te' : 'Ellenfél'}</button>)}</div>
      )}
      {list.map((p, ti) => (
        <div key={ti} className="cb2-tg">
          <span className="note">{slotText(p, ti)}</span>
          <span className="cb2-tv"><b>{lbl(ti, (s.tg || [])[ti] || '')}</b>
            <button type="button" className="btn sec" onClick={() => onTarget(ti)}>Kiválasztás a pályán</button>
            {(s.tg || [])[ti] && <button type="button" className="linkbtn" aria-label={(ti + 1) + '. célpont törlése'} onClick={() => chainApi.commit!((cs) => { cs.steps[j].tg[ti] = ''; }, 0)}><X size={14} /></button>}</span>
        </div>
      ))}
      {inf && !list.length && s.k === 'card' && inf.c && <p className="note">Ennek a lapnak nincs választandó célpontja.</p>}
      <div className={'cb2-q2 row2' + (hasQ ? '' : ' empty')} ref={qref} />
      <button type="button" className="linkbtn" onClick={() => chainApi.openAdv!(j)}>Haladó szerkesztés ennél a lépésnél (értelmezés felülírása, minden mező)</button>
    </div>
  );
}

/** A Chain fül: a builder (Haladó szerkesztés) imperatív modul; a React a pályás építőt a #cb-viz helyre portálozza. */
export function ChainView() {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [frames, setFrames] = useState<ChainFrame[]>([]);
  const [csv, setCsv] = useState(0);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const on = (e: Event) => { setFrames(((e as CustomEvent).detail || []) as ChainFrame[]); setCsv((v) => v + 1); };
    const oc = () => setCsv((v) => v + 1);
    window.addEventListener('rb:chain-frames', on);
    window.addEventListener('rb:chain-cs', oc);
    if (!done.current && ref.current) { done.current = true; initChain(ref.current); }
    setFrames(getChainFrames() as ChainFrame[]);
    setSlot(ref.current?.querySelector<HTMLElement>('#cb-viz') || null);
    return () => { window.removeEventListener('rb:chain-frames', on); window.removeEventListener('rb:chain-cs', oc); };
  }, []);
  return <div ref={ref}>{slot && chainApi.get && createPortal(<ChainEditor frames={frames} csv={csv} />, slot)}</div>;
}
