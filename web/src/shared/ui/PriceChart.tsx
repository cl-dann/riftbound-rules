import { useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Card } from '../../domain/data/schema';
import { eur } from '../../domain/deck/edit';
import { printingSeries, type PriceHistory } from '../../domain/deck/historyData';
import { loadHistory } from '../lib/prices';

/** Kategorikus színek rögzített sorrendben (a nyomat sorrendje a lapon), sötét felületre validálva (dataviz validate_palette, #0b1622). */
const COL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
type Ser = { key: string; label: string; col: string; v: (number | null)[] };
const W = 320, H = 150, L = 44, R = 10, T = 10, B = 22;

function ticks(lo: number, hi: number): number[] {
  const span = hi - lo || hi || 1; const raw = span / 3; const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) || raw;
  const out: number[] = []; for (let v = Math.floor(lo / step) * step; v <= hi + step / 2; v += step) out.push(+v.toFixed(2));
  return out;
}

function Panel({ title, ser, dates, idx, setIdx }: { title: string; ser: Ser[]; dates: string[]; idx: number | null; setIdx: (i: number | null) => void }) {
  const vals = ser.flatMap((s) => s.v.filter((x): x is number => x != null));
  const tk = ticks(Math.min(...vals), Math.max(...vals));
  const lo = tk[0], hi = tk[tk.length - 1] === lo ? lo + 1 : tk[tk.length - 1];
  const x = (i: number) => L + (dates.length < 2 ? 0 : (i * (W - L - R)) / (dates.length - 1));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = (v: (number | null)[]) => v.map((p, i) => (p == null ? '' : (i && v[i - 1] != null ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p).toFixed(1))).join(' ');
  const near = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0; dates.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; }); setIdx(best);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setIdx(Math.min(dates.length - 1, (idx ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setIdx(Math.max(0, (idx ?? dates.length) - 1));
    else return; e.preventDefault();
  };
  return (
    <figure className="pch-panel">
      <figcaption>{title}</figcaption>
      <div className="pch-plot">
        <svg viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label={title + ' ár, ' + dates[0] + ' és ' + dates[dates.length - 1] + ' között'} tabIndex={0}
          onPointerMove={near} onPointerLeave={() => setIdx(null)} onFocus={() => setIdx(idx ?? dates.length - 1)} onBlur={() => setIdx(null)} onKeyDown={key}>
          {tk.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="pch-grid" /><text x={L - 6} y={y(v) + 4} className="pch-ax" textAnchor="end">{v.toLocaleString('hu-HU')}</text></g>)}
          <text x={L} y={H - 6} className="pch-ax">{dates[0]}</text>
          <text x={W - R} y={H - 6} className="pch-ax" textAnchor="end">{dates[dates.length - 1]}</text>
          {idx != null && <line x1={x(idx)} x2={x(idx)} y1={T} y2={H - B} className="pch-cross" />}
          {ser.map((s) => <path key={s.key} d={path(s.v)} stroke={s.col} className="pch-line" />)}
          {ser.map((s) => { const i = idx ?? s.v.map((v, k) => (v == null ? -1 : k)).reduce((a, b) => Math.max(a, b), -1); const v = s.v[i];
            return v == null ? null : <circle key={s.key} cx={x(i)} cy={y(v)} r={4} fill={s.col} className="pch-dot" />; })}
        </svg>
        {idx != null && (
          <div className="pch-tip" style={{ left: (x(idx) / W) * 100 + '%' }}>
            <div className="pch-td">{dates[idx]}</div>
            {ser.map((s) => <div key={s.key} className="pch-tr"><i style={{ background: s.col }} /><b>{s.v[idx] == null ? 'nincs ár' : eur(s.v[idx])}</b><span>{s.label}</span></div>)}
          </div>
        )}
      </div>
    </figure>
  );
}

/** Kis vonaldiagram a kártya-ablakban: a nyomatok normál és foil ára a kézi árfrissítések napjain (legalább 2 adatpont kell). */
export function PriceChart({ card }: { card: Card }) {
  const [h, setH] = useState<PriceHistory | null>(null);
  const [idx, setIdx] = useState<number | null>(null);
  useEffect(() => { let on = true; loadHistory().then((x) => on && setH(x)); return () => { on = false; }; }, []);
  const data = useMemo(() => {
    if (!h) return null;
    const n: Ser[] = [], f: Ser[] = [];
    (card.pr || []).forEach(([code, , set, num], i) => {
      const s = printingSeries(h, code); const label = set + ' ' + num; const col = COL[i % COL.length];
      if (s.n) n.push({ key: code, label, col, v: s.n });
      if (s.f) f.push({ key: code, label, col, v: s.f });
    });
    return n.length || f.length ? { n, f } : null;
  }, [h, card]);
  if (!h || !data) return null;
  const legend = [...data.n, ...data.f].filter((s, i, a) => a.findIndex((t) => t.key === s.key) === i);
  return (
    <section className="pch">
      <h4>Ártörténet<span className="n">Cardmarket, 7 napos átlag, a kézi árfrissítések napjain</span></h4>
      <div className="pch-panels">
        {!!data.n.length && <Panel title="Normál" ser={data.n} dates={h.d} idx={idx} setIdx={setIdx} />}
        {!!data.f.length && <Panel title="Foil" ser={data.f} dates={h.d} idx={idx} setIdx={setIdx} />}
      </div>
      {legend.length > 1 && <ul className="pch-leg">{legend.map((s) => <li key={s.key}><i style={{ background: s.col }} />{s.label}</li>)}</ul>}
      <details className="pch-tbl">
        <summary>Táblázat</summary>
        <table>
          <thead><tr><th>Nap</th>{data.n.map((s) => <th key={'n' + s.key}>{s.label}, normál</th>)}{data.f.map((s) => <th key={'f' + s.key}>{s.label}, foil</th>)}</tr></thead>
          <tbody>{h.d.map((d, i) => <tr key={d}><td>{d}</td>{[...data.n, ...data.f].map((s, k) => <td key={k}>{s.v[i] == null ? '' : eur(s.v[i])}</td>)}</tr>)}</tbody>
        </table>
      </details>
    </section>
  );
}
