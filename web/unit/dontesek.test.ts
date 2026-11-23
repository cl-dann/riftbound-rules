/* Látható döntések leltára: minden lap minden utasításforrása (a futásidejű leltár pályáján, unit és gear kijátszva is) lefut,
   és összegyűjtjük a döntési pontokat (választó a lépés-panelben) és azokat a sorokat, ahol az elemzés még választó nélkül,
   szövegben jelzett automatikus döntéssel számol. A számok a jelentéshez kellenek; a teszt rögzíti őket, hogy csak javulhassanak. */
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/domain/data/store';
import { instrSources, phrasesTxt, splitInstr } from '../src/domain/chain/parser';
import { zoneRefOf } from '../src/domain/chain/zones';
import { analyze } from '../src/render/html/chainReport';
import type { CardLike } from '../src/domain/chain/types';

const MARK: [string, RegExp][] = [['you may: igennel számol', /igennel számol|úgy számol, hogy él vele/], ['az elsővel számol', /az elsővel számol|legkisebb Mightú/], ['trigger sorrend (383.3.d)', /a felsorolt sorrendben teszi fel/], ['első legális célpont', /első legális választással számol/]];
function sweepDec() {
  const cp = new Map<string, Set<string>>(); const txt = new Map<string, Set<string>>(); const seen = new Set<string>();
  const add = (m: Map<string, Set<string>>, k: string, n: string) => { if (!m.has(k)) m.set(k, new Set()); m.get(k)!.add(n); };
  for (const c of CARDS as CardLike[]) {
    if (seen.has(c.n)) continue; seen.add(c.n);
    const perm = c.t === 'Unit' || c.t === 'Gear';
    const all = instrSources(c).filter((s) => s.k !== 'cost');
    const sp = all.filter((s) => s.k === 'spell');
    const srcs = [...(sp.length ? [{ k: 'spell', e: sp.map((s) => s.e).join(' '), why: '' }] : []), ...all.filter((s) => s.k !== 'spell')];
    const steps: unknown[] = srcs.map((s) => {
      const tg = splitInstr(s.e).flatMap((t) => phrasesTxt(t).map(() => (zoneRefOf(t, c.n) ? '' : 'x'))).map((v, i) => (v ? (i % 2 ? 'b0' : 'b1') : ''));
      return c.t === 'Spell' && s.k === 'spell' ? { k: 'card', n: c.n, pl: 'A', tg, ext: {} } : { k: 'tr', n: c.n, src: perm ? 'b3' : null, pl: 'A', eff: s.e, why: s.why || 'x', tg, ext: {} };
    });
    if (perm) steps.unshift({ k: 'card', n: c.n, pl: 'A', tg: [], ext: {}, loc: 'bf0' });
    for (const step of steps) {
      const cs = { turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }],
        bd: [{ n: 'Blastcone Fae', pl: 'A', loc: 'bf0', d: 0 }, { n: 'Blastcone Fae', pl: 'B', loc: 'bf0', d: 0 }, { n: 'Blastcone Fae', pl: 'B', loc: 'base', d: 0 }, ...(perm ? [{ n: c.n, pl: 'A', loc: 'bf0', d: 0 }] : [])],
        hand: { A: [], B: [] }, steps: [step, { k: 'res' }] };
      let r: any; try { r = analyze(cs as never); } catch { continue; }
      const ch = r.choices || [];
      ch.forEach((x: any) => add(cp, x.kind + (x.auto ? ' (automatikus)' : ''), c.n));
      const t = r.rows.map((x: any) => x.join(' ')).join('\n');
      const cover: Record<string, string> = { 'you may: igennel számol': 'may', 'első legális célpont': 'tg' };
      MARK.forEach(([k, re]) => { if (re.test(t) && !(cover[k] && ch.some((x: any) => x.kind === cover[k]))) add(txt, k, c.n); });
    }
  }
  return { cp, txt };
}
const LIMIT = 1;
describe('Látható döntések leltára', () => {
  it('döntési pontok és a még szövegben jelzett automatikus döntések laponként', () => {
    const { cp, txt } = sweepDec();
    const sum = (m: Map<string, Set<string>>) => Object.fromEntries([...m].map(([k, v]) => [k, v.size]).sort());
    const out = { valasztoval: sum(cp), valaszto_nelkul: sum(txt), lapok: Object.fromEntries([...txt].map(([k, v]) => [k, [...v].sort()])) };
    console.log(JSON.stringify(out, null, 1));
    // a választóval lefedett automatikus célpontválasztás: ahol az elemzés "első legális választással számol", ott választó is van
    expect(txt.get('első legális célpont')).toBeUndefined();
    expect((cp.get('tg (automatikus)') || new Set()).size).toBeGreaterThan(0);
    expect((cp.get('may (automatikus)') || new Set()).size).toBeGreaterThan(0);
    // választó nélkül maradt automatikus döntés legfeljebb ennyi lapon (csak csökkenhet)
    expect([...txt.values()].reduce((a, v) => a + v.size, 0)).toBeLessThanOrEqual(LIMIT);
  });
});
