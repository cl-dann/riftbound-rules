/* A Chain futásidejű korlátleltára: minden lap minden utasításforrását (spell, trigger, ability) egy egyszerű pályán lefuttatja,
   és összegyűjti azokat a sorokat, ahol az elemzés kimondja, hogy valamit nem követ ("nem követi", "nem számolja", "nem követett").
   A pálya: egy-egy Blastcone Fae mindkét oldalon az 1. battlefielden és az ellenfél base-ében, a forrás lap (unit, gear) az 1. battlefielden;
   a célpontok felváltva az ellenfél és a saját unit (zónából választó utasításnál üres). A kéz, trash és deck üres, ezért a zónaválasztásos utasítások itt nem kapnak lapot. */
import { CARDS } from '../src/domain/data/store';
import { instrSources, phrasesTxt, splitInstr } from '../src/domain/chain/parser';
import { zoneRefOf } from '../src/domain/chain/zones';
import { analyze } from '../src/render/html/chainReport';
import type { CardLike } from '../src/domain/chain/types';

export type Hit = { n: string; k: string; line: string };
export function sweep(): Hit[] {
  const hits: Hit[] = [];
  const seen = new Set<string>();
  for (const c of CARDS as CardLike[]) {
    if (seen.has(c.n)) continue;
    seen.add(c.n);
    const perm = c.t === 'Unit' || c.t === 'Gear';
    const all = instrSources(c).filter((s) => s.k !== 'cost');
    const sp = all.filter((s) => s.k === 'spell');
    const srcs = [...(sp.length ? [{ k: 'spell', e: sp.map((s) => s.e).join(' '), why: '' }] : []), ...all.filter((s) => s.k !== 'spell')];
    for (const s of srcs) {
      // zónából választó utasítás (kéz, trash, deck) célpont-helye nem board unit: üresen marad, mint a felületen
      const tg = splitInstr(s.e).flatMap((t) => phrasesTxt(t).map(() => (zoneRefOf(t, c.n) ? '' : 'x'))).map((v, i) => (v ? (i % 2 ? 'b0' : 'b1') : ''));
      const step = c.t === 'Spell' && s.k === 'spell' ? { k: 'card', n: c.n, pl: 'A', tg, ext: {} } : { k: 'tr', n: c.n, src: perm ? 'b3' : null, pl: 'A', eff: s.e, why: s.why || 'x', tg, ext: {} };
      const cs = {
        turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }],
        bd: [{ n: 'Blastcone Fae', pl: 'A', loc: 'bf0', d: 0 }, { n: 'Blastcone Fae', pl: 'B', loc: 'bf0', d: 0 }, { n: 'Blastcone Fae', pl: 'B', loc: 'base', d: 0 }, ...(perm ? [{ n: c.n, pl: 'A', loc: 'bf0', d: 0 }] : [])],
        hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] }, steps: [step, { k: 'res' }],
      };
      let r;
      try { r = analyze(cs as never); } catch (e) { hits.push({ n: c.n, k: 'hiba', line: String(e) }); continue; }
      const text = r.rows.map((x) => x.join(' ')).join('\n').replace(/<[^>]+>/g, '');
      for (const ln of text.split('\n')) {
        const k = /nem követi részletesen/.test(ln) ? 'részletesen' : /nem követi tovább/.test(ln) ? 'tovább' : /nem követett/.test(ln) ? 'nem követett' : /nem számol|nem követi/.test(ln) ? 'egyéb' : '';
        if (k) hits.push({ n: c.n, k, line: ln.slice(0, 900) });
      }
    }
  }
  return hits;
}
