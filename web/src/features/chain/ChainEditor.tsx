import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from 'lucide-react';
import { locLabelOf, newZid, stateKeysOf } from '../../domain/chain/cs';
import { chainActions, chainStore, getCS } from './store';
import { stepInfo } from '../../domain/chain/steps';
import { TEMPLATES } from '../../domain/chain/templates';
import { IMGBASE } from '../../domain/data/store';
import { type Glow, type PTarget, type PlayCtl, Playmat } from '../../shared/board/Playmat';
import { CombatPanel } from './CombatPanel';
import { type ChainFrame, type Legal, abilitiesFor, cardOf, fullFrame, hasHidden, insertAt, isPerm, plOf, setupFrame, sideOf, slotText, stepFrames, stepName, tryStep, zoneCands, zonePicks } from './chainBuild';
import { emit, openCard } from '../../shared/lib/events';
import type { MItem, Menu, Mode, PickAt } from './types';
import { Refs, imgOf } from './bits';
import { MistargetBox } from './MistargetBox';
import { Arrows, STEP_MS } from './Arrows';
import { CardPicker } from './CardPicker';
import { ActionMenu } from './ActionMenu';
import { PropsPanel } from './PropsPanel';
import { useNarrow } from './hooks/useNarrow';
import { useChainLegality } from './hooks/useChainLegality';
import { useWizard } from './hooks/useWizard';
import { StepPanel } from './StepPanel';
import '../../styles/practice.css';

/** A varázsló "extra mezők" lépése csak akkor jelenik meg, ha a lapnak ilyen mezője van (a hely és a forrás a lépés-panelben állítható). */
export const EXTRA_SEL = '[data-accel],[data-rep],[data-repn],[data-modek],[data-mode],[data-spl],[data-addc],[data-cost],[data-cnd],[data-hv],[data-mp],[data-plc],[data-so],[data-soh],[data-erd],[data-sub],[data-dest],[data-pay],[data-eloc],[data-ai],[data-ti2],[data-mfrom]';

/** A Chain pályás építője: a pálya a lejátszással, akció-menü, kártyakereső, célzás kattintással, idővonal, lépés-panel. */
export function ChainEditor({ frames, csv }: { frames: ChainFrame[]; csv: number }) {
  const CS = getCS();
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
  const [ins, setIns] = useState<number | null>(null);
  const narrow = useNarrow();
  const { wiz, setWiz, wq, setWq, wres, xref } = useWizard();
  const showMenu = (m: Menu) => { if (narrow) { setMenu(null); setSel(null); setWiz((w) => ({ st: 'action', menu: m, side: w?.side || 'me' })); } else setMenu(m); };
  const [tpl, setTpl] = useState<{ open: boolean; ask?: string }>({ open: false });
  const tplSlot = typeof document !== 'undefined' ? document.getElementById('cb-tplslot') : null;
  const jump = useRef<number | 'keep' | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => { setHostEl(host.current); }, []);

  // új frame-ek: az építő után a lépés frame-jére ugrik, különben (példa, link, űrlap) az elejére
  useEffect(() => {
    const J = jump.current ?? (chainStore.getState().internal ? 'keep' : null); jump.current = null; chainStore.setState({ internal: false });
    if (J === 'keep') setI((k) => Math.min(k, eff.length - 1));
    else if (typeof J === 'number') setI(sf[J] ?? Math.max(0, eff.length - 1));
    else { setI(0); setMode(null); setSel(null); setMenu(null); setIns(null); setWiz(null); }
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
  const prev = useMemo(() => (ci > 0 ? fullFrame(eff[ci - 1], CS, ci - 1, sf).board : undefined), [eff, ci, sf, csv]); // eslint-disable-line react-hooks/exhaustive-deps
  // A lépések rövid neve (idővonal, chain-kártya keresés) egyszer, a CS változásakor számolódik.
  const names = useMemo(() => CS.steps.map((s) => stepName(CS, s)), [csv]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- CS írása ---- */
  const commit = (fn: (cs: any) => void, j: number | 'keep' = 'keep', ms?: number) => { jump.current = j; chainActions().commit(fn, ms); };
  const close = () => { setMenu(null); setPick(null); setProps(null); };
  const addStep = (st: any) => {
    const j = ins == null ? CS.steps.length : Math.min(ins, CS.steps.length);
    commit((cs) => { insertAt(cs, j, st); }, j, 0);
    close(); if (!narrow) setIns(null);
    const inf: any = stepInfo(getCS(), getCS().steps[j]);
    const hasT = !!inf?.list?.length;
    if (hasT) { setMode({ k: 'target', j, ti: 0 }); setMsg(''); } else afterTargets(j);
    const hasZ = !hasT && zonePicks(getCS(), j).some((z) => zoneCands(getCS(), j, z.xi).length);
    if (narrow) setWiz((w) => ({ ...(w || { side: 'me' }), st: hasT || hasZ ? 'target' : 'extra', j, hadT: hasT || hasZ })); else setSel(j);
  };
  const lastPl = () => { const l = CS.steps.slice(0, ins ?? CS.steps.length).reverse().find((s) => s.k === 'card' || s.k === 'ab'); return l ? (l.pl === 'A' ? 'opp' : 'me') : 'me'; };

  /* ---- célzás ---- */
  const { tOpts, zCands, tInf, tSlot, zInfo } = useChainLegality(CS, mode, csv);
  const chainStep = (ii: number) => {
    const t = (f.board.chain || [])[ii] || '';
    let best: number | null = null;
    CS.steps.forEach((_s, j) => { if (sf[j] != null && sf[j] <= ci && t.startsWith(names[j].n)) best = j; });
    return best;
  };
  /** A ti. célpont jelenlegi értéke; pályán kívüli célpontnál "x:hely:játékos". */
  const curTg = (j: number, ti: number) => { const s = CS.steps[j]; const v = (s?.tg || [])[ti] || ''; if (v !== 'x') return v; const e = ((s.ext || {})[ti] || {}) as { loc?: string; pl?: string }; return 'x:' + (e.loc || 'bf0') + ':' + (e.pl || ''); };
  const addV = (t: Extract<PTarget, { k: 'add' }>) => t.z === 'base' ? 'x:base:' + plOf(t.side!) : t.z === 'unit' ? 'x:bf' + t.bfi + ':' + plOf(t.side!) : '';
  const pickTarget = (v: string) => {
    if (mode?.k !== 'target') return;
    const o = tOpts.find((x) => x.v === v);
    if (!o) { setMsg('Ez nem lehet ennek a célpontja: ' + slotText(tSlot, mode.ti) + '.'); return; }
    if (!o.ok) { setMsg((o.ref ? o.ref + ': ' : '') + 'Nem választható: ' + (o.why || 'a szabályok szerint illegális') + '.'); return; }
    const j = mode.j, ti = mode.ti;
    const cur = curTg(j, ti);
    commit((cs) => {
      const s = cs.steps[j]; s.tg = s.tg || [];
      if (cur === v) { s.tg[ti] = ''; return; }
      if (v.startsWith('x:')) { const [, loc, pl] = v.split(':'); s.tg[ti] = 'x'; s.ext = s.ext || {}; s.ext[ti] = { ...(s.ext[ti] || {}), loc, pl }; } else s.tg[ti] = v;
    }, j, 0);
    const n = tInf.list.length;
    if (cur === v) return;
    if (ti + 1 < n) setMode({ k: 'target', j, ti: ti + 1 }); else if (n === 1) { afterTargets(j); setMsg('Célpont kiválasztva. Válaszolhatsz: kattints egy lapra vagy a Chain + gombjára.'); }
  };

  /* ---- kéz, trash és deck lapjainak választása (355.9.a, 355.10.a, 355.18) ---- */
  const [zpan, setZpan] = useState<{ z: 'trash' | 'deck' | 'banish'; side: 'me' | 'opp' } | null>(null);
  const zSel = (j: number, xi: number): string[] => ((CS.steps[j]?.zp || {})[xi] || []);
  /** A célpontok után: az első olyan zóna-választás, amelyhez van lap a zónában; ha nincs, a lépés kész. */
  const afterTargets = (j: number, from = 0) => {
    const zs = zonePicks(getCS(), j).filter((z) => z.xi >= from);
    for (const z of zs) { if (zoneCands(getCS(), j, z.xi).length) { setMode({ k: 'zpick', j, xi: z.xi }); return; } }
    setMode(null);
  };
  const toggleZ = (id: string) => {
    if (mode?.k !== 'zpick' || !zInfo) return;
    const o = zCands.find((x) => x.id === id);
    if (!o) { setMsg('Ez a lap nem választható ehhez: "' + zInfo.t + '".'); return; }
    if (!o.ok) { setMsg('Nem választható: ' + o.n + ' ' + (o.why || '') + '.'); return; }
    const { j, xi } = mode; const cur = zSel(j, xi); const n = zInfo.zr.n;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : n === 1 ? [id] : cur.length < n ? [...cur, id] : cur;
    commit((cs) => { const s = cs.steps[j]; s.zp = { ...(s.zp || {}), [xi]: next }; }, j, 0);
    if (n === 1 && !cur.includes(id)) afterTargets(j, xi + 1);
  };
  const zoneHu = (z: string) => (z === 'trash' ? 'trash' : z === 'hand' ? 'kéz' : z === 'among' ? 'megnézett lapok' : 'deck');
  const zNote = (z: { zr: any }) => (z.zr.target ? 'Célpont a trashből: a trash nyilvános zóna, ezért a lerakáskor kell választani (355.10.a, 355.8).' : z.zr.z === 'hand' ? 'Választás a kézből: a kéz privát, ezért nem célpont, a resolve-kor dől el (355.10.a, 355.18).' : z.zr.z === 'among' ? 'Választás a megnézett lapok közül: rejtett adat (128.4), a deck felső lapjai a Deck panelben megadva, sorrendben; a választás a resolve-kor (355.18).' : 'Választás a deckből: a deck sorrendje titkos információ (108.4.e, 128.3).') + (z.zr.n > 1 ? ' Legfeljebb ' + z.zr.n + ' lap.' : '');
  const zChips = mode?.k === 'zpick' ? (zCands.length ? zCands.map((o) => (
    <button key={o.id} type="button" className={'cb2-chip' + (o.ok ? '' : ' bad') + (zSel(mode.j, mode.xi).includes(o.id) ? ' on' : '')} aria-pressed={zSel(mode.j, mode.xi).includes(o.id)} title={o.why} onClick={() => toggleZ(o.id)}>
      {o.n} <small>({o.own === 'A' ? 'saját' : 'ellenfél'} {zoneHu(o.zone)}{o.ok ? '' : ', nem választható: ' + o.why})</small></button>)) : <span className="note">Ebben a zónában nincs lap. A Trash, a Deck és a kéz + gombjával adhatsz hozzá.</span>) : null;
  const zList = (z: 'trash' | 'deck' | 'banish', side: 'me' | 'opp') => {
    const b: any = f.board[side]; const p = plOf(side);
    if (z === 'deck') return ((CS.deck || {})[p] || []).map((e: any, i: number) => ({ id: typeof e === 'string' ? 'zd' + p + i : e.id, n: typeof e === 'string' ? e : e.n }));
    if (z === 'banish') return (b.banish || []).map((n: string) => ({ id: '', n }));
    return (b.trash || []).map((n: string, i: number) => ({ id: (b.zids?.trash || [])[i] || '', n }));
  };
  const zPanel = zpan ? (() => {
    const { z, side } = zpan; const p = plOf(side); const list = zList(z, side);
    return (
      <div className="cb2-ov" onClick={() => setZpan(null)}>
        <div className="pb-panel cb2-zp" role="dialog" aria-label={(side === 'me' ? 'Saját ' : 'Ellenfél ') + z} onClick={(e) => e.stopPropagation()}>
          <div className="pb-mh"><span><b>{(side === 'me' ? 'Saját ' : 'Ellenfél ') + (z === 'trash' ? 'trash' : z === 'deck' ? 'Main Deck' : 'banishment')}</b>
            <small className="note">{z === 'trash' ? 'Nyilvános zóna (108.2.d).' : z === 'deck' ? 'A sorrend titkos (108.4.e): az 1. a felső lap, ez a pályás építő feltételezése.' : 'Nyilvános zóna (108.6.e).'}</small></span>
            <button type="button" className="pb-x" aria-label="Bezárás" onClick={() => setZpan(null)}><X size={18} /></button></div>
          {mode?.k === 'zpick' && zInfo && <p className="pb-why cb2-need">"{zInfo.t}": {zNote(zInfo)}</p>}
          <ul className="cb2-zl">
            {list.map((x: any, k: number) => { const o = mode?.k === 'zpick' ? zCands.find((c) => c.id === x.id) : undefined; const on = mode?.k === 'zpick' && zSel(mode.j, mode.xi).includes(x.id);
              return (
                <li key={k} className={o ? (o.ok ? 'ok' : 'bad') : ''}>
                  {imgOf(x.n) ? <img src={imgOf(x.n)} alt="" /> : <span className="cb2-noimg" />}
                  <span className="cb2-rn"><b>{z === 'deck' ? (k + 1) + '. ' : ''}{x.n}</b>{o && !o.ok && <small>{o.why}</small>}</span>
                  {o && <button type="button" className={'btn' + (on ? '' : ' sec')} disabled={!o.ok} aria-pressed={on} onClick={() => toggleZ(x.id)}>{on ? 'Kiválasztva' : 'Kiválasztás'}</button>}
                  {/^z[td][AB]/.test(x.id) && !o && <button type="button" className="linkbtn" aria-label={x.n + ' eltávolítása'} onClick={() => commit((cs) => { cs[z][p] = cs[z][p].filter((e: any) => e.id !== x.id); })}><X size={14} /></button>}
                </li>); })}
            {!list.length && <li className="note">Üres.</li>}
          </ul>
          {z !== 'banish' && <button type="button" className="pb-btn act" onClick={() => setPick({ kind: z, side })}>{z === 'trash' ? '+ Lap a trashbe' : '+ Lap a deck tetejére'}</button>}
          <button type="button" className="pb-btn primary" onClick={() => setZpan(null)}>Kész</button>
        </div>
      </div>);
  })() : null;

  /* ---- menük ---- */
  const lg = (r: Legal) => (r.ok ? { need: r.need } : { dis: r.why, ref: r.ref });
  const abItems = (src: string, pl: 'A' | 'B'): MItem[] => {
    const { c, abs, trs } = abilitiesFor(CS, src);
    if (!c) return [];
    const out: MItem[] = abs.map((a: any, ai: number) => { const st = { k: 'ab', src, ai, pl, n: c.n, tg: [], ext: {} }; return { label: 'Aktiválás: ' + String(a.label).slice(0, 70), step: true, run: () => addStep(st), ...lg(tryStep(CS, st, ins ?? undefined)) }; });
    if (!abs.length) out.push({ label: 'Aktiválás', dis: 'Ennek a lapnak nincs aktiválható abilityje.' });
    trs.forEach((a: any, ti: number) => { const st = { k: 'tg', src, ti, pl, n: c.n, tg: [], ext: {} }; out.push({ label: 'Trigger a chainre: ' + String(a.label).slice(0, 60), tone: 'gold', step: true, run: () => addStep(st), ...lg(tryStep(CS, st, ins ?? undefined)) }); });
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
      showMenu({ key: uid + csv, title: b.n, card: b.n, sub: (b.pl === 'A' ? 'saját' : 'ellenfél') + ', ' + locLabelOf(CS, b.loc) + ', kiinduló helyzet', items: [
        ...abItems(uid, b.pl), ...moveItems(uid, b.n), ...combatItem(b.loc, sideOf(b.pl)),
        { label: 'Tulajdonságok (Might, damage, exhausted, stunned, buff, Empowered, csatolás)', tone: 'energy', run: () => { setMenu(null); setProps(k); } },
        { label: 'Eltávolítás', tone: 'del', run: () => { close(); jump.current = 'keep'; chainActions().delBd(k); } },
      ] });
    } else {
      const s = CS.steps[k]; if (!s) return;
      showMenu({ key: uid + csv, title: s.n!, card: s.n, sub: (k + 1) + '. lépésben kijátszva', items: [
        ...abItems(uid, s.pl!), ...moveItems(uid, s.n!), ...combatItem(s.loc || 'base', sideOf(s.pl!)),
        { label: 'Lépés szerkesztése', tone: 'energy', run: () => { close(); setSel(k); } },
        { label: 'A lépés törlése', tone: 'del', run: () => { close(); chainActions().delStep(k); } },
      ] });
    }
  };
  const playItem = (st: any, label = 'Kijátszás'): MItem => ({ label, step: true, run: () => addStep(st), ...lg(tryStep(CS, st, ins ?? undefined)) });
  const openHand = (side: 'me' | 'opp', hi0: number, n: string) => {
    const p = plOf(side); const hid = ((f.board[side] as any).zids?.hand || [])[hi0] || '';
    const c = cardOf(n); if (!c) return;
    if (!/^zh[AB]/.test(hid)) { showMenu({ key: 'h' + hi0, title: n, card: n, sub: 'egy hatás tette a kézbe', items: [] }); return; }
    const hi = hid;
    const st = { k: 'card', n, pl: p, from: 'hand', ...(isPerm(c) ? { loc: 'base' } : {}), tg: [], ext: {} };
    const dests = [0, 1].filter((b) => CS.bf[b].n && CS.bf[b].c === p && !CS.bf[b].fd);
    const hide: MItem = !hasHidden(c) ? { label: 'Elrejtés (Hidden)', dis: 'Csak [Hidden] keywordös lap rejthető el.', ref: '811.1.c' }
      : !dests.length ? { label: 'Elrejtés (Hidden)', dis: 'Elrejteni csak olyan battlefieldre lehet, amit te kontrollálsz, és nincs rajta facedown lap.', ref: '811.1.b' }
      : { label: 'Elrejtés (Hidden)', tone: 'gold', need: 'a battlefield kiválasztása', run: () => { close(); if (dests.length === 1) doHide(side, hi, n, dests[0]); else setMode({ k: 'hide', side, hi, n, dests }); } };
    showMenu({ key: 'h' + side + hi + csv, title: n, card: n, sub: (side === 'me' ? 'saját' : 'ellenfél') + ' kéz', items: [
      playItem(st, 'Kijátszás' + (isPerm(c) ? ' (a base-be; a hely a lépésnél állítható)' : '')), hide,
      { label: 'Eltávolítás a kézből', tone: 'del', run: () => { close(); commit((cs) => { cs.hand[p] = cs.hand[p].filter((e: any) => e.id !== hi); }); } },
    ] });
  };
  const doHide = (side: 'me' | 'opp', hi: string, n: string, b: number) => {
    const p = plOf(side);
    commit((cs) => { cs.hand[p] = cs.hand[p].filter((e: any) => e.id !== hi); cs.bf[b].fd = p; cs.bf[b].fdn = n; });
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
    items.push({ label: 'Vissza a kézbe', tone: 'gold', run: () => { close(); commit((cs) => { if (n) cs.hand![bf.fd as 'A' | 'B']!.push({ id: newZid(cs, 'hand', bf.fd!), n }); cs.bf[b].fd = ''; cs.bf[b].fdn = ''; }); } });
    items.push({ label: 'Eltávolítás', tone: 'del', run: () => { close(); commit((cs) => { cs.bf[b].fd = ''; cs.bf[b].fdn = ''; }); } });
    showMenu({ key: 'fd' + b + csv, title: n || 'Facedown lap', card: n || undefined, sub: (bf.fd === 'A' ? 'saját' : 'ellenfél') + ' facedown, ' + (bf.n || (b + 1) + '. battlefield'), items });
  };
  const openLegend = (side: 'me' | 'opp') => {
    const p = plOf(side); const n = CS.lg[p];
    if (!n) { setPick({ kind: 'legend', side }); return; }
    showMenu({ key: 'L' + p + csv, title: n, card: n, sub: (side === 'me' ? 'saját' : 'ellenfél') + ' legend', items: [
      ...abItems('L' + p, p),
      { label: 'Csere', tone: 'energy', run: () => { setMenu(null); setPick({ kind: 'legend', side }); } },
      { label: 'Eltávolítás', tone: 'del', run: () => { close(); commit((cs) => { cs.lg[p] = ''; }); } },
    ] });
  };
  const openChamp = (side: 'me' | 'opp') => {
    const p = plOf(side); const n = (CS.ch || {})[p];
    if (!n || !f.board[side].champion) { if (!n) setPick({ kind: 'champion', side }); return; }
    showMenu({ key: 'C' + p + csv, title: n, card: n, sub: (side === 'me' ? 'saját' : 'ellenfél') + ' Champion Zone', items: [
      playItem({ k: 'card', n, pl: p, from: 'champ', loc: 'base', tg: [], ext: {} }, 'Kijátszás a Champion Zone-ból'),
      { label: 'Csere', tone: 'energy', run: () => { setMenu(null); setPick({ kind: 'champion', side }); } },
      { label: 'Eltávolítás', tone: 'del', run: () => { close(); commit((cs) => { cs.ch[p] = ''; }); } },
    ] });
  };
  const openBf = (b: number) => {
    const bf = CS.bf[b];
    if (!bf.n) { setPick({ kind: 'battlefield', bfi: b }); return; }
    const ctl = (c: string, l: string): MItem => ({ label: 'Kontroll: ' + l, tone: 'gold', dis: bf.c === c ? 'Most is így áll.' : undefined, run: () => { close(); commit((cs) => { cs.bf[b].c = c; }); } });
    showMenu({ key: 'bf' + b + csv, title: bf.n, card: bf.n, sub: (b + 1) + '. battlefield', items: [
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
      else if (at.kind === 'hand') cs.hand[p].push({ id: newZid(cs, 'hand', p), n });
      else if (at.kind === 'trash') { cs.trash = cs.trash || { A: [], B: [] }; cs.trash[p].push({ id: newZid(cs, 'trash', p), n }); }
      else if (at.kind === 'deck') { cs.deck = cs.deck || { A: [], B: [] }; cs.deck[p].unshift({ id: newZid(cs, 'deck', p), n }); }
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
    const err = chainActions().moveUnit(uid, loc);
    if (err) { setMsg(err); return; }
    if (std) commit((cs) => { cs.bd[+uid.slice(1)].ex = true; });
    setMsg(n + (std ? ' Standard Move-val átment, és exhausted lett (144.2).' : ' áthelyezve: ' + locLabelOf(CS, loc) + '. Az elemzés újrafutott.'));
  };
  const ctl: PlayCtl = {
    glow: (t): Glow => {
      if (mode?.k === 'target') {
        const tg = curTg(mode.j, mode.ti);
        const g = (v: string): Glow => { const o = tOpts.find((x) => x.v === v); return !o ? '' : tg === v ? 'sel' : o.ok ? 'act' : ''; };
        if (t.k === 'unit') return g(t.id || '');
        if (t.k === 'zone' && /^bf\d$/.test(t.loc)) { const o = tOpts.find((x) => x.v === 'F' + t.loc[2]); return o?.ok ? 'dest' : ''; }
        if (t.k === 'chain') { const s = chainStep(t.i); return s == null ? '' : g('s' + s); }
        if (t.k === 'add') return g(addV(t));
        return '';
      }
      if (mode?.k === 'zpick') {
        if (t.k === 'hand') { const id = ((f.board[t.side] as any).zids?.hand || [])[t.i]; const o = zCands.find((x) => x.id === id); return !o ? '' : zSel(mode.j, mode.xi).includes(id) ? 'sel' : o.ok ? 'act' : ''; }
        if (t.k === 'pile') return zCands.some((o) => o.ok && (o.zone === t.z || (o.zone === 'among' && t.z === 'deck')) && o.own === plOf(t.side)) ? 'act' : '';
        return '';
      }
      if (mode?.k === 'hpick') return t.k === 'hand' && t.side === mode.side && (!mode.unit || cardOf(t.n)?.t === 'Unit') ? 'act' : '';
      if (mode?.k === 'move') {
        if (t.k === 'unit') return t.id === mode.uid ? 'sel' : '';
        if (t.k === 'zone') { const side = mode.uid[0] === 'b' ? sideOf(CS.bd[+mode.uid.slice(1)].pl) : sideOf(CS.steps[+mode.uid.slice(1)].pl!); if (t.loc === 'base' && side === 'opp' || t.loc === 'obase' && side === 'me') return ''; return mode.dests.includes(zoneLoc(t.loc)) ? 'dest' : ''; }
        return '';
      }
      if (mode?.k === 'hide') return t.k === 'fd' && mode.dests.includes(t.bfi) ? 'dest' : '';
      if (sel != null && t.k === 'chain') return chainStep(t.i) === sel ? 'sel' : '';
      return '';
    },
    on: (t) => {
      emit('rb:hide-tip');
      setPlay(false);
      if (narrow && wiz?.st === 'extra') return;
      if (narrow && t.k === 'add' && t.z === 'chain' && mode?.k !== 'target') { openWiz(); return; }
      if (t.k === 'add' && mode?.k === 'target' && tOpts.some((o) => o.v === addV(t) && o.ok)) { pickTarget(addV(t)); return; }
      if (t.k === 'pile') { setZpan({ z: t.z, side: t.side }); return; }
      if (mode?.k === 'zpick') { if (t.k === 'hand') toggleZ(((f.board[t.side] as any).zids?.hand || [])[t.i] || ''); return; }
      if (mode?.k === 'hpick') {
        if (t.k === 'hand' && ctl.glow(t)) { const m = mode; commit((cs) => { const s = cs.steps[m.j]; if (m.f === 'so') s.so = 'h:' + t.n; else { s.plc = s.plc || {}; s.plc[m.xi] = t.n; } }, m.j, 0); setMode(null); setMsg(t.n + ' kiválasztva a kézből.'); }
        if (t.k !== 'add') return;
      }
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
    label: (t) => (t.k === 'add' && mode?.k === 'target' ? 'Pályán kívüli célpont ide' : t.k === 'unit' ? t.n + (t.side === 'me' ? ', saját' : ', ellenfél') + (mode?.k === 'target' ? ', célpontként' : ', akciók') : t.k === 'zone' ? 'Cél: ' + locLabelOf(CS, zoneLoc(t.loc)) : ''),
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
    const err = chainActions().moveUnit(d.uid, z.loc);
    setMsg(err || 'Áthelyezve a kiinduló helyzetben, az elemzés újrafutott.');
  };

  /* ---- idővonal ---- */
  const dragJ = useRef(-1);
  const [dropAt, setDropAt] = useState(-1);
  const mv = (from: number, to: number) => { jump.current = to; if (chainActions().moveStep(from, to)) setSel(to); };
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
  const last = chainStore.getState().last;
  const story: string[] = last && !last.empty ? last.story : [];
  const sk = stateKeysOf(CS);
  const stRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chainActions().stateEl(sk.length ? stRef.current : null); return () => chainActions().stateEl(null); }, [sk.length]);

  const tChips = mode?.k === 'target' ? tOpts.map((o) => (
          <button key={o.v} type="button" className={'cb2-chip' + (o.ok ? '' : ' bad') + (curTg(mode.j, mode.ti) === o.v ? ' on' : '')} onClick={() => pickTarget(o.v)} title={o.ok ? '' : o.why} aria-pressed={curTg(mode.j, mode.ti) === o.v}>
            {o.label.replace(/^Board: /, '')}{!o.ok && <small> (nem választható{o.why && /\(206\)/.test(o.why) ? ': ' + o.why.replace(/^\d+\. célpont nem választható:\s*/, '') : ''})</small>}
          </button>
        )) : null;
  const banner = mode?.k === 'target' && tSlot ? (
    <div className="cb2-mode" role="status">
      <div><b>{stepName(CS, CS.steps[mode.j]).n}: {slotText(tSlot, mode.ti)}</b>{tInf.list.length > 1 && <span className="note"> ({mode.ti + 1} / {tInf.list.length})</span>}
        <span className="note"> Kattints egy kiemelt lapra a pályán, vagy válassz itt:</span></div>
      <div className="cb2-chips">
        {tChips}
        {!tOpts.length && <span className="note">Nincs választható lap a pályán ehhez a célponthoz. A Haladó szerkesztésben megadhatsz pályán kívüli célpontot.</span>}
      </div>
      <div className="cb2-mbtn">
        {tInf.list.length > 1 && mode.ti > 0 && <button type="button" className="btn sec" onClick={() => setMode({ ...mode, ti: mode.ti - 1 })}>Előző célpont</button>}
        {tInf.list.length > 1 && mode.ti + 1 < tInf.list.length && <button type="button" className="btn sec" onClick={() => setMode({ ...mode, ti: mode.ti + 1 })}>Következő célpont</button>}
        <button type="button" className="btn" onClick={() => afterTargets(mode.j)}>Kész</button>
      </div>
    </div>
  ) : mode?.k === 'zpick' && zInfo ? (
    <div className="cb2-mode" role="status">
      <div><b>{stepName(CS, CS.steps[mode.j]).n}: "{zInfo.t}"</b> <span className="note">{zNote(zInfo)} Kattints egy kiemelt lapra {zInfo.zr.z === 'hand' ? 'a kézben' : 'a ' + (zInfo.zr.z === 'among' ? 'Deck' : zoneHu(zInfo.zr.z)) + ' pakli megnyitásával'}, vagy válassz itt:</span></div>
      <div className="cb2-chips">{zChips}</div>
      <div className="cb2-mbtn"><button type="button" className="btn" onClick={() => afterTargets(mode.j, mode.xi + 1)}>Kész</button></div>
    </div>
  ) : mode?.k === 'move' ? (
    <div className="cb2-mode" role="status"><div>Hova kerüljön <b>{mode.n}</b>? Kattints egy kiemelt zónára.</div><div className="cb2-mbtn"><button type="button" className="btn sec" onClick={() => setMode(null)}>Mégse</button></div></div>
  ) : mode?.k === 'hide' ? (
    <div className="cb2-mode" role="status"><div>Melyik battlefieldre rejted el: <b>{mode.n}</b>? Kattints egy kiemelt facedown helyre.</div><div className="cb2-mbtn"><button type="button" className="btn sec" onClick={() => setMode(null)}>Mégse</button></div></div>
  ) : mode?.k === 'hpick' ? (
    <div className="cb2-mode" role="status"><div>{mode.f === 'so' ? 'Show Off: melyik unitot fedi fel a kézből?' : 'Melyik lapot játssza ki a kézből?'} Kattints egy kiemelt lapra a {mode.side === 'me' ? 'saját' : 'ellenfél'} kezében{(f.board[mode.side].hand || []).length ? '' : ' (a kéz üres: előbb adj hozzá lapot a kéz + gombjával)'}.</div><div className="cb2-mbtn"><button type="button" className="btn sec" onClick={() => setMode(null)}>Mégse</button></div></div>
  ) : ins != null ? (
    <div className="cb2-mode" role="status"><div>Beszúrás {ins === 0 ? 'az 1. lépés elé' : 'a(z) ' + ins + '. lépés után'}: kattints egy lapra a pályán (Kijátszás, Aktiválás, Trigger), vagy válassz:</div>
      <div className="cb2-mbtn">
        <button type="button" className="btn sec" onClick={() => setPick({ kind: 'play', side: lastPl(), sideFree: true })}>Lap kereséssel</button>
        <button type="button" className="btn sec" onClick={() => addStep({ k: 'res' })}>Resolve</button>
        <button type="button" className="btn sec" onClick={() => addStep({ k: 'end' })}>Kör vége</button>
        <button type="button" className="btn" onClick={() => setIns(null)}>Mégse</button>
      </div></div>
  ) : null;
  /* ---- mobilos lépés-varázsló (csak keskeny nézetben) ---- */
  const sideBefore = (at: number | null) => { const l = CS.steps.slice(0, at ?? CS.steps.length).reverse().find((x) => x.k === 'card' || x.k === 'ab'); return l ? (l.pl === 'A' ? 'opp' : 'me') : 'me'; };
  function openWiz(preset?: 'res' | 'end', at: number | null = ins) { setMsg(''); setMenu(null); setPick(null); setMode(null); setSel(null); setWiz({ st: preset ? 'action' : 'card', side: sideBefore(at), preset }); }
  const wizEnd = (msg?: string) => { chainActions().quick(null, -1); setWiz(null); setIns(null); setMode(null); if (msg) setMsg(msg); };
  const wizCancel = () => { const w = wiz; wizEnd(); if (w?.j != null && CS.steps[w.j]) { jump.current = 'keep'; chainActions().delStep(w.j); } };
  const wizBack = () => {
    const w = wiz!;
    if (w.st === 'card') { wizCancel(); return; }
    if (w.st === 'action') { setWiz({ st: 'card', side: w.side }); return; }
    if (w.st === 'target' || (w.st === 'extra' && !w.hadT)) { setMode(null); setWiz({ ...w, st: 'action', j: undefined }); chainActions().quick(null, -1); jump.current = 'keep'; chainActions().delStep(w.j!); return; }
    chainActions().quick(null, -1); setWiz({ ...w, st: 'target' }); setMode({ k: 'target', j: w.j!, ti: 0 });
  };
  useEffect(() => { if (wiz?.st === 'target' && !mode) setWiz({ ...wiz, st: 'extra' }); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  // mobilon célzáskor az első legális célpont a látható részre kerül (a sáv fölé)
  useEffect(() => {
    if (!narrow || wiz?.st !== 'target' || mode?.k !== 'target') return;
    const t = window.setTimeout(() => { const el = host.current?.querySelector<HTMLElement>('.g-act, .g-dest'); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
    return () => window.clearTimeout(t);
  }, [wiz?.st, mode?.k === 'target' ? mode.ti : -1, tOpts.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wiz?.st !== 'extra' || wiz.j == null) return;
    chainActions().quick(xref.current, wiz.j);
    if (!xref.current?.querySelector(EXTRA_SEL)) wizEnd((wiz.j + 1) + '. lépés az idővonalon: ' + stepName(CS, CS.steps[wiz.j]).n + '.');
  }, [wiz?.st, wiz?.j]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickSt = (n: string, side: 'me' | 'opp') => { const c = cardOf(n); return { k: 'card', n, pl: plOf(side), from: 'hand', ...(isPerm(c) ? { loc: 'base' } : {}), tg: [], ext: {} }; };
  const wItems: MItem[] = !narrow || !wiz || wiz.st !== 'action' ? [] : wiz.preset
    ? [{ label: wiz.preset === 'res' ? 'Resolve: a chain teteje most lefut' : 'Kör vége: Ending Phase', ref: wiz.preset === 'res' ? '340.1' : '317.1', step: true, run: () => addStep({ k: wiz.preset }) }]
    : wiz.pick ? [playItem(pickSt(wiz.pick, wiz.side), 'Kijátszás')] : (wiz.menu?.items || []);
  const WST = { card: 1, action: 2, target: 3, extra: 4 } as const;
  const wHead = (t: string) => (
    <div className="cb2-wh">
      <span className="cb2-wn">{wiz ? WST[wiz.st] : 1} / 4</span><b>{t}</b>
      <button type="button" className="btn sec" onClick={wizBack}>Vissza</button>
      <button type="button" className="btn sec" onClick={wizCancel}>Mégse</button>
    </div>
  );
  const wizSheet = !narrow || !wiz ? null : wiz.st === 'target' ? (
    <div className="cb2-wbar" role="status">
      {mode?.k === 'zpick' && zInfo ? <div className="cb2-wbt"><b>Válassz lapot ({zoneHu(zInfo.zr.z)})</b> <span>"{zInfo.t}"</span>{msg && <small>{msg}</small>}<div className="cb2-chips cb2-wch">{zChips}</div></div> :
      <div className="cb2-wbt"><b>Válassz célpontot</b>{tSlot && mode?.k === 'target' && <span> {slotText(tSlot, mode.ti)}{tInf.list.length > 1 ? ' (' + (mode.ti + 1) + ' / ' + tInf.list.length + ')' : ''}</span>}{msg && <small>{msg}</small>}{tOpts.length > 0 && <div className="cb2-chips cb2-wch">{tChips}</div>}</div>}
      <div className="cb2-wbb">
        <button type="button" className="btn sec" onClick={wizBack}>Vissza</button>
        <button type="button" className="btn sec" onClick={wizCancel}>Mégse</button>
        {mode?.k === 'target' && (tInf?.list?.length > 1 || tSlot?.opt) && <button type="button" className="btn" onClick={() => afterTargets(mode.j)}>Kész</button>}
        {mode?.k === 'zpick' && <button type="button" className="btn" onClick={() => afterTargets(mode.j, mode.xi + 1)}>Kész</button>}
      </div>
    </div>
  ) : (
    <div className="cb2-sheet" role="dialog" aria-label="Lépés varázsló">
      {wiz.st === 'card' && <>
        {wHead(ins != null ? 'Beszúrás ' + (ins === 0 ? 'az 1. lépés elé' : 'a(z) ' + ins + '. lépés után') : 'Új lépés: lap kiválasztása')}
        <p className="note">Bökj egy lapra a pályán (unit, legend, kéz, facedown), vagy keresd ki a kijátszandó lapot:</p>
        <input type="search" className="cb2-q" value={wq} onChange={(e) => setWq(e.target.value)} placeholder="Lap neve" aria-label="Keresés a kijátszható lapok között" />
        {wq && <ul className="cb2-res">{wres.map((c) => (
          <li key={c.n}><button type="button" onClick={() => { setWq(''); setWiz({ ...wiz, st: 'action', pick: c.n, menu: undefined }); }}>
            {c.img ? <img src={IMGBASE + c.img} alt="" /> : <span className="cb2-noimg" />}<span className="cb2-rn"><b>{c.n}</b><small>{c.t}{c.e != null ? ' · ' + c.e + ' Energy' : ''}</small></span>
          </button></li>))}{!wres.length && <li className="note">Nincs találat.</li>}</ul>}
        <div className="cb2-wbb"><button type="button" className="btn sec" onClick={() => setWiz({ ...wiz, st: 'action', preset: 'res' })}>Resolve</button><button type="button" className="btn sec" onClick={() => setWiz({ ...wiz, st: 'action', preset: 'end' })}>Kör vége</button></div>
      </>}
      {wiz.st === 'action' && <>
        {wHead(wiz.preset ? (wiz.preset === 'res' ? 'Resolve' : 'Kör vége') : (wiz.pick || wiz.menu?.title || '') + ': akció')}
        {wiz.menu?.sub && <p className="note">{wiz.menu.sub}</p>}
        {wiz.pick && <div className="cb2-seg" role="group" aria-label="Ki játssza ki"><span>Ki:</span>
          {(['me', 'opp'] as const).map((x) => <button key={x} type="button" aria-pressed={wiz.side === x} className={wiz.side === x ? 'on' : ''} onClick={() => setWiz({ ...wiz, side: x })}>{x === 'me' ? 'Te' : 'Ellenfél'}</button>)}</div>}
        <div className="cb2-witems">{wItems.map((it, k) => (
          <div key={k}>
            <button type="button" className={'pb-btn ' + (it.tone || 'act')} disabled={!!it.dis} onClick={() => { if (!it.step) { setWiz(null); setIns(null); } it.run?.(); }}>{it.label}</button>
            {it.dis && <p className="pb-why">{it.ref && <Refs r={it.ref} />}{it.dis}</p>}
            {!it.dis && it.need && <p className="pb-why cb2-need">Utána: {it.need}.</p>}
          </div>))}
          {!wItems.length && <p className="note">Ehhez a laphoz nincs akció.</p>}</div>
        {wiz.menu?.card && <button type="button" className="pb-link" onClick={() => openCard(wiz.menu!.card!)}>Lap részletei</button>}
      </>}
      {wiz.st === 'extra' && <>
        {wHead('A lap beállításai')}
        <div className="cb2-q2 row2 cb2-wx" ref={xref} />
        <button type="button" className="pb-btn primary" onClick={() => wizEnd((wiz.j! + 1) + '. lépés az idővonalon.')}>Kész</button>
      </>}
    </div>
  );
  const hasContent = !!(CS.steps.length || CS.bd.length || CS.lg.A || CS.lg.B || CS.bf.some((b) => b.n || b.fd) || (['A', 'B'] as const).some((p) => (CS.hand?.[p] || []).length || CS.ch?.[p]));
  const loadTpl = (id: string) => { const t = TEMPLATES.find((x) => x.id === id)!; setTpl({ open: false }); chainActions().set(t.cs()); setMsg('Sablon betöltve: ' + t.title + '. Lépésenként a Következő gombbal nézheted végig.'); };
  const setTurn = (v: string) => commit((cs) => { cs.turn = v; }, 'keep', 0);
  const setPhase = (v: string) => commit((cs) => { cs.phase = v; }, 'keep', 0);

  const selStep = sel != null ? CS.steps[sel] : null;
  const turn = CS.turn ? sideOf(CS.turn) : CS.steps[0] ? sideOf(CS.steps[0].pl || 'A') : 'me';

  return (
    <>
      {tplSlot && createPortal(<button type="button" className="btn sec" aria-expanded={tpl.open} title="Kész helyzetek témánként: counter, mistarget, trigger sorrend, replacement, Hidden, kör vége" onClick={() => setTpl({ open: !tpl.open })}>Sablonok</button>, tplSlot)}
      {tpl.open && (
        <div className="panel pad cb2-tpls" role="region" aria-label="Sablonok">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="cb2-tpl" data-tpl={t.id}>
              <b>{t.title}</b><Refs r={t.refs} />
              <p className="note">{t.desc}</p>
              {tpl.ask === t.id ? (
                <div className="cb2-mbtn"><span className="pb-why">A mostani helyzet elvész.</span>
                  <button type="button" className="btn" onClick={() => loadTpl(t.id)}>Betöltés mégis</button>
                  <button type="button" className="btn sec" onClick={() => setTpl({ open: true })}>Mégse</button></div>
              ) : <button type="button" className="btn sec" onClick={() => (hasContent ? setTpl({ open: true, ask: t.id }) : loadTpl(t.id))}>Betöltés</button>}
            </div>
          ))}
        </div>
      )}
      <div className="cb2-main">
        <div className="panel pad cbv cb2-stage">
          {!(narrow && wiz) && banner}
          <div className="cb2-hdr">
            <div className="cb2-seg" role="group" aria-label="Kinek a köre"><span>Kör:</span>
              {([['', 'automatikus'], ['A', 'te'], ['B', 'ellenfél']] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={(CS.turn || '') === v} className={(CS.turn || '') === v ? 'on' : ''} onClick={() => setTurn(v)} title={v ? undefined : 'az első lépés játékosáé'}>{l}</button>)}</div>
            <div className="cb2-seg" role="group" aria-label="Fázis"><span>Fázis:</span>
              {([['', 'Main Phase'], ['beginning', 'Beginning Phase']] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={(CS.phase || '') === v} className={(CS.phase || '') === v ? 'on' : ''} onClick={() => setPhase(v)}>{l}</button>)}</div>
          </div>
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
            {CS.steps.map((s, j) => {
              const nm = names[j]; const [stt, why] = stepStatus(j);
              return (
                <Fragment key={j}>
                {j > 0 && <li className="cb2-insrow"><button type="button" className={'cb2-ins' + (ins === j ? ' on' : '')} onClick={() => { setMode(null); if (narrow) { setIns(j); openWiz(undefined, j); } else setIns(ins === j ? null : j); }} aria-label={'Beszúrás a ' + j + '. és a ' + (j + 1) + '. lépés közé'} title="Beszúrás ide"><Plus size={12} /></button></li>}
                <li className={'cb2-sc' + (sel === j ? ' on' : '') + ' ' + stt + (dropAt === j ? ' drop' : '')} data-step={j} draggable
                  onDragStart={(e) => { dragJ.current = j; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'step:' + j); }}
                  onDragOver={(e) => { if (dragJ.current < 0) return; e.preventDefault(); setDropAt(j); }}
                  onDragLeave={() => setDropAt(-1)}
                  onDrop={(e) => { e.preventDefault(); const from = dragJ.current; dragJ.current = -1; setDropAt(-1); if (from >= 0 && from !== j) mv(from, j); }}
                  onDragEnd={() => { dragJ.current = -1; setDropAt(-1); }}>
                  <span className="cb2-grip" aria-hidden><GripVertical size={14} /></span>
                  <button type="button" className="cb2-sb" onClick={() => { setSel(sel === j ? null : j); if (sf[j] != null) { setPlay(false); setI(sf[j]); } }} aria-expanded={sel === j} aria-description={(j + 1) + '. lépés szerkesztése: ' + nm.n}>
                    <span className="no">{j + 1}.</span>
                    {nm.img && imgOf(nm.img) ? <img src={imgOf(nm.img)} alt="" /> : <span className="cb2-kimg">{s.k === 'res' ? 'R' : s.k === 'end' ? 'K' : '?'}</span>}
                    <span className="cb2-st"><b>{nm.n}</b><small>{s.k === 'card' || s.k === 'ab' ? (s.pl === 'A' ? 'Te' : 'Ellenfél') + ', ' : ''}{nm.kind}{j === 0 && s.k === 'card' ? ', első lépés' : ''}</small>
                      {(stt === 'bad' || stt === 'need') && <small className={'cb2-' + stt}>{why}</small>}</span>
                  </button>
                  <span className="cb2-sbtn">
                    <button type="button" className="linkbtn" disabled={!j} onClick={() => mv(j, j - 1)} aria-label={(j + 1) + '. lépés feljebb'}><ArrowUp size={14} /></button>
                    <button type="button" className="linkbtn" disabled={j >= CS.steps.length - 1} onClick={() => mv(j, j + 1)} aria-label={(j + 1) + '. lépés lejjebb'}><ArrowDown size={14} /></button>
                    <button type="button" className="linkbtn" onClick={() => { if (sel === j) setSel(null); jump.current = 'keep'; chainActions().delStep(j); }} aria-label={(j + 1) + '. lépés törlése'}><X size={14} /></button>
                  </span>
                </li>
                </Fragment>
              );
            })}
          </ol>
          <div className="cb2-add">
            <button type="button" className="btn sec" onClick={() => (narrow ? openWiz() : setPick({ kind: 'play', side: lastPl(), sideFree: true }))}><Plus size={14} /> Lap a chainre</button>
            <button type="button" className="btn sec" onClick={() => (narrow ? openWiz('res') : addStep({ k: 'res' }))} title="Mindkét játékos passzol: a chain teteje most lefut (340.1)">+ Resolve</button>
            <button type="button" className="btn sec" onClick={() => (narrow ? openWiz('end') : addStep({ k: 'end' }))} title="A chain lefut, majd Ending Phase (317)">+ Kör vége</button>
          </div>
          {selStep && <StepPanel j={sel!} csv={csv} onTarget={(ti) => setMode({ k: 'target', j: sel!, ti })} onClose={() => setSel(null)} bad={stepStatus(sel!)}
            onInsert={(k) => { setMode(null); setIns(k); if (narrow) openWiz(undefined, k); }} onZone={(xi) => setMode({ k: 'zpick', j: sel!, xi })} onHand={(f, xi) => { const st = CS.steps[sel!]; setIns(null); setMode({ k: 'hpick', j: sel!, f, xi, side: sideOf(st.pl || 'A'), unit: f === 'so' }); }} />}
          {sk.length > 0 && <div className="cb2-state" ref={stRef} />}
        </div>
      </div>

      <details className="panel pad cb2-blk" id="cb-story"><summary><h2>Sorban ez történik</h2><span className="note">{story.length ? story.length + ' mondat' : 'még üres'}</span></summary>
        {story.length ? <ol className="flow">{story.map((x, k) => <li key={k}><span>{x}</span></li>)}</ol> : <p className="note">Adj hozzá egy lépést a chainhez.</p>}
      </details>
      <CombatPanel board={f.board} bfi={f.bfi} isLast={ci === eff.length - 1} frameLabel={(ci + 1) + '. lépés: ' + eff[ci].label} focus={cfocus} />

      {menu && <ActionMenu m={menu} onClose={() => setMenu(null)} />}
      {zPanel}
      {wizSheet}{narrow && <div className={'cb2-wizpad' + (wiz && wiz.st !== 'target' ? '' : ' sm')} />}
      {narrow && !wiz && !pick && !menu && props == null && !mode && <div className="cb2-fab"><button type="button" className="btn" onClick={() => openWiz()}><Plus size={16} /> Új lépés</button></div>}
      {pick && <CardPicker at={pick} onPick={onPicked} onClose={() => setPick(null)} />}
      {props != null && <PropsPanel i={props} onClose={() => setProps(null)} />}
    </>
  );
}
