import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { initChain, getChainFrames, chainApi } from '../legacy/chain';
import { Playmat, type PBoard } from '../components/Playmat';
import { CombatPanel } from '../components/CombatPanel';

type Arrow = { from: number; to: string };
type MtInstr = { t: string; st: 'executed' | 'partial' | 'ignored' | 'negated' | 'skipped'; ref: string; why: string };
/** Mistarget adat egy resolve frame-hez (359.3.e.9): a célpontok legalitása és az utasítások sorsa. */
type MtInfo = { item: string; kind: 'full' | 'partial' | 'none'; targets: { n: string; ok: boolean; skip?: boolean; why?: string }[]; instr: MtInstr[] };
export type ChainFrame = { label: string; board: PBoard; changes: [string, string][]; arrows: Arrow[]; bfi?: number[]; mt?: MtInfo | null };

const ST_TXT: Record<MtInstr['st'], [string, string]> = {
  executed: ['Végrehajtódik', 'ok'], partial: ['Részben', 'part'], ignored: ['Ignored', 'ign'], negated: ['Negated', 'neg'], skipped: ['Nem hajtódik végre', 'ign'],
};
const Refs = ({ r }: { r: string }) => <span className="cbv-refs">{r.split(/,\s*/).filter(Boolean).map((x) => <a key={x} className="rref" href="#szabalyok" data-ref={x}>{x}</a>)}</span>;

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
          <tr key={k}><td className="q">"{x.t}"</td><td><span className={'cbv-st ' + ST_TXT[x.st][1]}>{ST_TXT[x.st][0]}</span></td><td>{x.ref && <Refs r={x.ref} />}{x.why}</td></tr>
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
      const sel = kind === 'u' ? '.pm-unit[data-uid="' + id + '"] > .cl' : kind === 'c' ? '.pm2-ci[data-ci="' + id + '"]' : '.pm2-bfc[data-bfi="' + id + '"] > .cl';
      const dst = host.querySelector<HTMLElement>(sel);
      if (!src || !dst) return;
      const s = src.getBoundingClientRect(), t = dst.getBoundingClientRect();
      const tx = t.left + t.width / 2 - hr.left, sc = s.left + s.width / 2 - hr.left;
      const y1 = s.top + s.height / 2 - hr.top;
      let x1: number, x2: number, y2: number, d: string;
      if (kind === 'c') {
        // chain elemről chain elemre: ív a lista jobb oldalán
        x1 = s.right - hr.left; x2 = t.right - hr.left; y2 = t.top + t.height / 2 - hr.top;
        const bx = Math.max(x1, x2) + 28 + i * 6;
        d = 'M' + x1 + ' ' + y1 + ' C' + bx + ' ' + y1 + ' ' + bx + ' ' + y2 + ' ' + x2 + ' ' + y2;
      } else {
        const left = tx < sc;
        x1 = (left ? s.left : s.right) - hr.left;
        const below = t.top > s.bottom;
        x2 = tx; y2 = (below ? t.top - 2 : t.bottom + 2) - hr.top;
        // oldalra indul a chain elemtől, hogy ne takarja a többi chain sort
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

function ChainPlayback({ frames }: { frames: ChainFrame[] }) {
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  const keep = useRef(false);
  const [dropMsg, setDropMsg] = useState('');
  useEffect(() => {
    if (keep.current) { keep.current = false; setI((k) => Math.min(k, frames.length - 1)); } else setI(0);
    setPlay(false);
  }, [frames]);
  useEffect(() => { setHostEl(host.current); }, []);
  useEffect(() => {
    if (!play) return;
    const t = window.setInterval(() => setI((k) => {
      if (k >= frames.length - 1) { setPlay(false); return k; }
      return k + 1;
    }), STEP_MS);
    return () => window.clearInterval(t);
  }, [play, frames.length]);
  const ci = Math.max(0, Math.min(i, frames.length - 1));
  const f = frames[ci];
  const prev = ci > 0 ? frames[ci - 1].board : undefined;
  const togglePlay = () => { if (!play && i >= frames.length - 1) setI(0); setPlay(!play); };
  /* Drag and drop a Playmaton: a builder board listájából (bN) és a kijátszott permanentekből (sN) jövő unit vagy gear
     másik zónára húzható; ez a kiinduló helyzetben állítja át a helyét, majd újrafut az elemzés. */
  useLayoutEffect(() => {
    host.current?.querySelectorAll<HTMLElement>('.pm-unit[data-uid]').forEach((el) => {
      const ok = /^[bs]\d+$/.test(el.dataset.uid || '');
      el.draggable = ok; el.classList.toggle('dnd', ok);
    });
  });
  const drag = useRef<{ uid: string; side: string } | null>(null);
  const zoneOf = (t: EventTarget | null): { el: HTMLElement; loc: string; side?: string } | null => {
    const e = t as HTMLElement | null; if (!e || !e.closest) return null;
    const b = e.closest<HTMLElement>('.pm2-base');
    if (b) return { el: b, loc: 'base', side: b.classList.contains('me') ? 'me' : 'opp' };
    const bf = e.closest<HTMLElement>('.pm2-bf');
    if (bf) { const k = +(bf.querySelector<HTMLElement>('.pm2-bfc')?.dataset.bfi ?? -1); const real = f.bfi?.[k]; if (real != null) return { el: bf, loc: 'bf' + real }; }
    return null;
  };
  const clearHi = () => host.current?.querySelectorAll('.dropok,.dropno').forEach((x) => x.classList.remove('dropok', 'dropno'));
  const onDragStart = (e: React.DragEvent) => {
    const u = (e.target as HTMLElement).closest<HTMLElement>('.pm-unit.dnd'); if (!u) return;
    drag.current = { uid: u.dataset.uid!, side: u.classList.contains('opp') ? 'opp' : 'me' };
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'unit:' + u.dataset.uid);
    setPlay(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!drag.current) return; const z = zoneOf(e.target); clearHi(); if (!z) return;
    const bad = z.side != null && z.side !== drag.current.side;
    z.el.classList.add(bad ? 'dropno' : 'dropok');
    if (!bad) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  };
  const onDrop = (e: React.DragEvent) => {
    const d = drag.current; drag.current = null; clearHi(); if (!d) return;
    const z = zoneOf(e.target); if (!z || (z.side != null && z.side !== d.side)) return;
    e.preventDefault(); keep.current = true;
    const err = chainApi.moveUnit?.(d.uid, z.loc) ?? null;
    if (err) { keep.current = false; setDropMsg(err); } else setDropMsg('Áthelyezve a kiinduló helyzetben, az elemzés újrafutott.');
  };
  const onDragEnd = () => { drag.current = null; clearHi(); };
  return (
    <>
    <div className="panel pad cbv">
      <h2>Lejátszás</h2>
      <div className="cbv-mat" ref={host} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}>
        <Playmat key={ci} b={f.board} prev={prev} turn={null} onlyKnown />
        <Arrows host={hostEl} arrows={f.arrows} tick={ci} />
      </div>
      <p className="note cbv-dndn" role="status">{dropMsg || 'A builder board lapjait és a kijátszott unitokat másik zónára (base, battlefield) húzhatod: ez a kiinduló helyzetben helyezi át őket, majd újrafuttatja az elemzést.'}</p>
      <div className="cbv-ctl">
        <button className="btn sec" disabled={ci === 0} onClick={() => { setPlay(false); setI(ci - 1); }}>Előző</button>
        <button className="btn sec" disabled={ci >= frames.length - 1} onClick={() => { setPlay(false); setI(ci + 1); }}>Következő</button>
        <button className="btn" aria-pressed={play} onClick={togglePlay}>{play ? 'Megállítás' : 'Lejátszás'}</button>
        <span className="cbv-step" aria-live="polite"><b>{ci + 1} / {frames.length} lépés:</b> {f.label}</span>
      </div>
      <div className="cbv-dots" aria-hidden>{frames.map((_, k) => <i key={k} className={k === ci ? 'on' : k < ci ? 'seen' : ''} onClick={() => { setPlay(false); setI(k); }} />)}</div>
      <div className="cbv-chg">
        <b>Mi változott?</b>
        {f.changes.length ? (
          <ul>{f.changes.map(([ref, txt], k) => (
            <li key={k}>
              {ref && <span className="cbv-refs">{ref.split(',').map((r) => r.trim()).filter(Boolean).map((r) => <a key={r} className="rref" href="#szabalyok" data-ref={r}>{r}</a>)}</span>}
              <span>{txt}</span>
            </li>
          ))}</ul>
        ) : <p className="note">Ebben a lépésben nincs külön szabálysor.</p>}
        {f.mt && <MistargetBox mt={f.mt} />}
      </div>
    </div>
    <CombatPanel board={f.board} frameLabel={(ci + 1) + '. lépés: ' + f.label} />
    </>
  );
}

/** A Chain elemző imperatív modul; a React a gyökér elemet adja neki, és a lejátszást a jobb oszlopba portálozza. */
export function ChainView() {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [frames, setFrames] = useState<ChainFrame[]>([]);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const on = (e: Event) => setFrames(((e as CustomEvent).detail || []) as ChainFrame[]);
    window.addEventListener('rb:chain-frames', on);
    if (!done.current && ref.current) { done.current = true; initChain(ref.current); }
    setFrames(getChainFrames() as ChainFrame[]);
    setSlot(ref.current?.querySelector<HTMLElement>('#cb-viz') || null);
    return () => window.removeEventListener('rb:chain-frames', on);
  }, []);
  return <div ref={ref}>{slot && frames.length > 0 && createPortal(<ChainPlayback frames={frames} />, slot)}</div>;
}
