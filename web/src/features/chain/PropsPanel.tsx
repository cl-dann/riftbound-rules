import type { BoardEntry } from '../../domain/chain/state';
import { X } from 'lucide-react';
import { locLabelOf } from '../../domain/chain/cs';
import { chainActions, getCS } from './store';
import { cardOf } from './chainBuild';
import { imgOf } from './bits';

/* ---------- board lap tulajdonságai (a builder board sorának mezői) ---------- */
export function PropsPanel({ i, onClose }: { i: number; onClose: () => void }) {
  const CS = getCS();
  const b = CS.bd[i]; if (!b) return null;
  const c = cardOf(b.n); const isU = c?.t === 'Unit', isG = c?.t === 'Gear';
  const set = (fn: (b: BoardEntry) => void) => chainActions().commit((cs) => fn(cs.bd[i]));
  const units = CS.bd.map((x, k) => [x, k] as const).filter(([x]) => cardOf(x.n)?.t === 'Unit');
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
          <option value="">nincs felcsatolva</option>{units.map(([x, k]) => <option key={k} value={k}>rajta: {(x.pl === 'A' ? 'Te: ' : 'Ellenfél: ') + x.n + ' (' + locLabelOf(CS, x.loc) + ')'}</option>)}</select></label>}
        <button type="button" className="pb-btn primary" onClick={onClose}>Kész</button>
      </div>
    </div>
  );
}
