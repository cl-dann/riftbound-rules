import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { initChain, getChainFrames } from '../legacy/chain';
import { Playmat, type PBoard } from '../components/Playmat';

type Arrow = { from: number; to: string };
export type ChainFrame = { label: string; board: PBoard; changes: [string, string][]; arrows: Arrow[] };

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
  useEffect(() => { setI(0); setPlay(false); }, [frames]);
  useEffect(() => { setHostEl(host.current); }, []);
  useEffect(() => {
    if (!play) return;
    const t = window.setInterval(() => setI((k) => {
      if (k >= frames.length - 1) { setPlay(false); return k; }
      return k + 1;
    }), STEP_MS);
    return () => window.clearInterval(t);
  }, [play, frames.length]);
  const f = frames[Math.min(i, frames.length - 1)];
  const prev = i > 0 ? frames[i - 1].board : undefined;
  const togglePlay = () => { if (!play && i >= frames.length - 1) setI(0); setPlay(!play); };
  return (
    <div className="panel pad cbv">
      <h2>Lejátszás</h2>
      <div className="cbv-mat" ref={host}>
        <Playmat key={i} b={f.board} prev={prev} turn={null} onlyKnown />
        <Arrows host={hostEl} arrows={f.arrows} tick={i} />
      </div>
      <div className="cbv-ctl">
        <button className="btn sec" disabled={i === 0} onClick={() => { setPlay(false); setI(i - 1); }}>Előző</button>
        <button className="btn sec" disabled={i >= frames.length - 1} onClick={() => { setPlay(false); setI(i + 1); }}>Következő</button>
        <button className="btn" aria-pressed={play} onClick={togglePlay}>{play ? 'Megállítás' : 'Lejátszás'}</button>
        <span className="cbv-step" aria-live="polite"><b>{i + 1} / {frames.length} lépés:</b> {f.label}</span>
      </div>
      <div className="cbv-dots" aria-hidden>{frames.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'seen' : ''} onClick={() => { setPlay(false); setI(k); }} />)}</div>
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
      </div>
    </div>
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
