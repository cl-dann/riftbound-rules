import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import type { Arrow } from './chainBuild';

export const STEP_MS = 1200;
/** Nyílszín a chain elem helye szerint (0 = legfelső). */
export const COLORS = ['#b07ef2', '#5fa1ff', '#f59a45', '#4fcf8a', '#e9cb4d'];

/** SVG overlay: nyíl a chain elem jelölőjétől a célpontig (unit, másik chain elem vagy battlefield). */
export function Arrows({ host, arrows, tick }: { host: HTMLDivElement | null; arrows: Arrow[]; tick: number }) {
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
