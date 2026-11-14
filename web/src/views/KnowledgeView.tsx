import { useEffect, useMemo } from 'react';
import { renderTud } from '../legacy/knowledge';
import { Html } from '../components/Html';

export function KnowledgeView({ hash }: { hash: string }) {
  const html = useMemo(() => renderTud(), []);
  useEffect(() => {
    if (/^#tud-/.test(hash)) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 30);
  }, [hash]);
  return (
    <div className="panel pad"
      onClick={(e) => {
        const t = e.target as HTMLElement;
        const s = t.closest('a[data-scroll]') as HTMLElement | null;
        if (s) { e.preventDefault(); document.getElementById(s.dataset.scroll!)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        const b = t.closest('button[data-kwq]') as HTMLElement | null;
        if (b) window.dispatchEvent(new CustomEvent('rb:card-search', { detail: b.dataset.kwq }));
      }}>
      <Html html={html} />
    </div>
  );
}
