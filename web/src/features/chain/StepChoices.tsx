/* A lépéshez tartozó döntések (célpont, "you may", a megnézett vagy a kézben lévő lap, Weaponmaster Equipment) választóval.
   Az elemző beállítás nélkül automatikusan választ; ilyenkor "automatikus, módosítható" jelvény áll mellette. A választás a lépés
   meglévő mezőibe kerül (zp, wm), a többi a dec mezőbe; beállítás nélkül az elemzés a régi. */
import { chainActions, chainStore } from './store';
import type { ChoicePoint } from '../../domain/chain/engine/ctx';

export function choicesOf(j: number): ChoicePoint[] {
  const all = (chainStore.getState().last?.choices || []).filter((c) => c.j === j);
  const m = new Map<string, ChoicePoint>(); all.forEach((c) => m.set(c.key, c)); return [...m.values()];
}
export function StepChoices({ j }: { j: number; csv: number }) {
  const cps = choicesOf(j);
  if (!cps.length) return null;
  const set = (c: ChoicePoint, v: string) => chainActions().commit((cs) => {
    const s = cs.steps[j]; if (!s) return;
    if (c.kind === 'zp') { s.zp = s.zp || {}; s.zp[c.xi!] = v ? [v] : []; }
    else if (c.kind === 'wm') { if (v) s.wm = v; else delete s.wm; }
    else { s.dec = s.dec || {}; if (v) s.dec[c.key] = v; else delete s.dec[c.key]; }
  });
  return (
    <div className="cb2-dec" aria-label="Döntések">
      <b className="note">Döntések</b>
      {cps.map((c) => (
        <label key={c.key} className="cb2-decl" data-dec={c.key}>
          <span>{c.label}:</span>
          <select value={c.cur} onChange={(e) => set(c, e.target.value)} aria-label={c.label}>
            {c.kind === 'zp' && !c.cur && <option value="">nincs megadva</option>}
            {c.opts.map((o) => <option key={o.v} value={o.v}>{o.n}</option>)}
            {c.none && <option value="-">{c.none}</option>}
          </select>
          {c.auto && <span className="cb2-auto">automatikus, módosítható</span>}
        </label>
      ))}
    </div>
  );
}
