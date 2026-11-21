import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { locLabelOf } from '../../domain/chain/cs';
import { getCS } from './store';
import { IMGBASE } from '../../domain/data/store';
import { PICK_TITLE, searchCards } from './chainBuild';
import type { PickAt } from './types';

export function CardPicker({ at, onPick, onClose }: { at: PickAt; onPick: (n: string, side: 'me' | 'opp') => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [side, setSide] = useState<'me' | 'opp'>(at.side || 'me');
  const res = useMemo(() => searchCards(at.kind, q), [at.kind, q]);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { inp.current?.focus(); }, []);
  const where = at.kind === 'board' ? (at.loc === 'base' ? 'base' : locLabelOf(getCS(), at.loc || 'base')) : '';
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
              <span className="cb2-rn"><b>{c.n}</b><small>{c.t}{c.e != null ? ' · ' + c.e + ' Energy' : ''}{c.p ? ' · ' + c.p + ' Power' : ''}{c.m != null && c.t === 'Unit' ? ' · ' + c.m + ' Might' : ''}</small></span>
            </button></li>
          ))}
          {!res.length && <li className="note">Nincs találat.</li>}
        </ul>
      </div>
    </div>
  );
}
