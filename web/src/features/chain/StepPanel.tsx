import type { TargetParam } from '../../domain/chain/types';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { tgOptionsOf } from '../../domain/chain/cs';
import { chainActions, chainStore, getCS } from './store';
import { stepInfo } from '../../domain/chain/steps';
import { interp } from '../../domain/chain/actions';
import { slotText, stepName, zonePicks } from './chainBuild';
import { imgOf } from './bits';

/** A kiválasztott lépés panelje: ki játssza, célpontok (pályán választva), és csak a lap által igényelt mezők. */
export function StepPanel({ j, csv, onTarget, onClose, bad, onInsert, onHand, onZone }: { j: number; csv: number; onTarget: (ti: number) => void; onClose: () => void; bad: ['ok' | 'bad' | 'need' | 'off', string]; onInsert: (k: number) => void; onHand: (f: 'so' | 'plc', xi: number) => void; onZone: (xi: number) => void }) {
  const CS = getCS(); const s = CS.steps[j];
  const qref = useRef<HTMLDivElement>(null);
  const [hasQ, setHasQ] = useState(false);
  useEffect(() => { chainActions().quick(qref.current, j); setHasQ(!!qref.current?.innerHTML); }, [j, csv]);
  useEffect(() => () => chainActions().quick(null, -1), []);
  if (!s) return null;
  const nm = stepName(CS, s);
  const inf = s.k === 'res' || s.k === 'end' ? null : stepInfo(CS, s);
  const list: TargetParam[] = inf?.list || [];
  const lbl = (ti: number, v: string) => { if (!v) return 'nincs kiválasztva'; if (v === 'x') return 'pályán kívüli (Haladó szerkesztés)'; const o = tgOptionsOf(CS, j, list[ti]).find((x) => x[0] === v); return o ? String(o[1]).replace(/^Board: /, '') : v; };
  const setPl = (p: 'A' | 'B') => chainActions().commit((cs) => { cs.steps[j].pl = p; }, 0);
  return (
    <div className="cb2-sp" aria-label={(j + 1) + '. lépés beállításai'}>
      <div className="cb2-sph">{nm.img && imgOf(nm.img) && <img src={imgOf(nm.img)} alt="" />}<span><b>{j + 1}. {nm.n}</b><small className="note">{nm.kind}{s.k === 'card' || s.k === 'ab' ? (j ? ', válasz' : ', első lépés') : ''}</small></span>
        <button type="button" className="pb-x" aria-label="Lépés panel bezárása" onClick={onClose}><X size={16} /></button></div>
      {bad[0] === 'bad' && <p className="pb-why">Nem szabályos, kimarad: {bad[1]}</p>}{bad[0] === 'need' && <p className="pb-why cb2-need">{bad[1]}</p>}
      {s.k === 'res' && <p className="note">Mindkét játékos passzol: a chain legfelső eleme most resolve-ol (340.1), a következő lépések már erre az állapotra épülnek.</p>}
      {s.k === 'end' && <p className="note">A chain lefut, majd jön az Ending Phase: a kör végi hatások triggerelnek (317.1), utána Expiration Step (317.2).</p>}
      {(s.k === 'card' || s.k === 'ab') && (
        <div className="cb2-seg" role="group" aria-label="Ki játssza"><span>Ki:</span>
          {(['A', 'B'] as const).map((p) => <button key={p} type="button" aria-pressed={s.pl === p} className={s.pl === p ? 'on' : ''} onClick={() => setPl(p)}>{p === 'A' ? 'Te' : 'Ellenfél'}</button>)}</div>
      )}
      {list.map((p, ti) => (
        <div key={ti} className="cb2-tg">
          <span className="note">{slotText(p, ti)}</span>
          <span className="cb2-tv"><b>{lbl(ti, (s.tg || [])[ti] || '')}</b>
            <button type="button" className="btn sec" onClick={() => onTarget(ti)}>Kiválasztás a pályán</button>
            {(s.tg || [])[ti] && <button type="button" className="linkbtn" aria-label={(ti + 1) + '. célpont törlése'} onClick={() => chainActions().commit((cs) => { cs.steps[j].tg![ti] = ''; }, 0)}><X size={14} /></button>}</span>
        </div>
      ))}
      {zonePicks(CS, j).map((z) => (
        <div key={'z' + z.xi} className="cb2-tg"><span className="note">"{z.t}": {z.zr.target ? 'célpont a trashből' : z.zr.z === 'hand' ? 'választás a kézből (resolve-kor)' : 'választás a deckből'}</span>
          <span className="cb2-tv"><b>{((s.zp || {})[z.xi] || []).map((id: string) => chainStore.getState().last?.objs?.[id]?.name || 'törölt lap, válassz újra').join(', ') || 'nincs kiválasztva'}</b>
            <button type="button" className="btn sec" onClick={() => onZone(z.xi)}>Kiválasztás</button></span></div>))}
      {inf && !list.length && !zonePicks(CS, j).length && s.k === 'card' && inf.c && <p className="note">Ennek a lapnak nincs választandó célpontja.</p>}
      <div className={'cb2-q2 row2' + (hasQ ? '' : ' empty')} ref={qref} />
      {inf?.c && /\[Show Off\]/.test(inf.c.txt || '') && <div className="cb2-tv"><span className="note">Show Off: {String(s.so || '').startsWith('h:') ? s.so!.slice(2) + ' (kézből)' : s.so ? 'board unit' : 'nincs'}</span><button type="button" className="btn sec" onClick={() => onHand('so', 0)}>Unit a kézből</button></div>}
      {inf?.eff ? interp(s, inf).map((y, xi) => y.act.k === 'playcard' && !y.act.self ? (
        <div key={xi} className="cb2-tv"><span className="note">Kijátszott lap ({xi + 1}. utasítás): <b>{((s.plc || {}) as Record<number, string>)[xi] || 'nincs megadva'}</b></span><button type="button" className="btn sec" onClick={() => onHand('plc', xi)}>Lap a kézből</button></div>) : null) : null}
      <div className="cb2-tv">
        <button type="button" className="btn sec" onClick={() => onInsert(j)}>Beszúrás elé</button>
        <button type="button" className="btn sec" onClick={() => onInsert(j + 1)}>Beszúrás utána</button>
      </div>
      <button type="button" className="linkbtn" onClick={() => chainActions().openAdv(j)}>Haladó szerkesztés ennél a lépésnél (értelmezés felülírása, minden mező)</button>
    </div>
  );
}
