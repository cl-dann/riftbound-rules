import { useEffect, useMemo } from 'react';
import { renderTud } from '../../render/html/knowledge';
import { Html } from '../../shared/ui/Html';

export function KnowledgeView({ hash }: { hash: string }) {
  const html = useMemo(() => renderTud(), []);
  useEffect(() => {
    if (/^#tud-/.test(hash)) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 30);
  }, [hash]);
  return (
    <div className="panel pad"
      onInput={(e) => {
        const t = e.target as HTMLInputElement; if (!t.classList.contains('errq')) return;
        const q = t.value.trim().toLowerCase();
        (e.currentTarget as HTMLElement).querySelectorAll('.errc').forEach((c) => { (c as HTMLElement).hidden = !!q && !(c as HTMLElement).dataset.n!.includes(q); });
        (e.currentTarget as HTMLElement).querySelectorAll('.errgrp').forEach((g) => { (g as HTMLElement).hidden = !g.querySelector('.errc:not([hidden])'); });
      }}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        const s = t.closest('a[data-scroll]') as HTMLElement | null;
        if (s) { e.preventDefault(); document.getElementById(s.dataset.scroll!)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        const fs = t.closest('[data-fs]') as HTMLElement | null;
        if (fs) {
          const [bi] = fs.dataset.fs!.split(':'); const box = (e.currentTarget as HTMLElement).querySelector('.fdia[data-fb="' + bi + '"]')!;
          box.querySelectorAll('.fnode').forEach((n) => { const on = (n as HTMLElement).dataset.fs === fs.dataset.fs; n.classList.toggle('on', on); n.setAttribute('aria-selected', String(on)); if (on) (n as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); });
          box.querySelectorAll('.fpane').forEach((p) => { (p as HTMLElement).hidden = (p as HTMLElement).dataset.fp !== fs.dataset.fs; });
          return;
        }
        const cn = t.closest('button[data-card]') as HTMLElement | null;
        if (cn) { window.dispatchEvent(new CustomEvent('rb:open-card', { detail: cn.dataset.card })); return; }
        const b = t.closest('button[data-kwq]') as HTMLElement | null;
        if (b) window.dispatchEvent(new CustomEvent('rb:card-search', { detail: b.dataset.kwq }));
      }}>
      <Html html={html} />
    </div>
  );
}
