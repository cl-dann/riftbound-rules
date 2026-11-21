import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { openCard } from '../../shared/lib/events';
import type { Menu } from './types';
import { Refs, imgOf } from './bits';

export function ActionMenu({ m, onClose }: { m: Menu; onClose: () => void }) {
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
