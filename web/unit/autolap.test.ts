/* "Hiányzó lap magától": a kereséssel kijátszott lap a játékos kezébe kerül, és onnan játssza ki; ha nincs legális célpont, egy alap unit
   kerül a szükséges oldalra és helyre. Az elemzés azonos azzal, mintha a lapokat kézzel tették volna fel (a frame-ek egyeznek). */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/render/html/chainReport';
import { BASIC_UNIT, addBasicTarget, handPlay, insertAt } from '../src/features/chain/chainBuild';
import { stepInfo } from '../src/domain/chain/steps';
import { vsCard } from '../src/domain/data/store';
import type { ChainState, ChainStep } from '../src/domain/chain/state';
import { newZid } from '../src/domain/chain/cs';

const empty = (): ChainState => ({ lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], steps: [], hand: { A: [], B: [] }, ch: { A: '', B: '' } });
const st = (n: string, pl: 'A' | 'B', tg: string[] = []): ChainStep => ({ k: 'card', n, pl, from: 'hand', tg, ext: {} });
const an = (cs: ChainState) => analyze(JSON.parse(JSON.stringify(cs))) as any;

describe('Hiányzó lap magától', () => {
  it('az alap unit valós, szöveg nélküli lap', () => {
    expect(vsCard(BASIC_UNIT)!.t).toBe('Unit');
    expect(vsCard(BASIC_UNIT)!.txt || '').toBe('');
  });
  it('a kereséssel kijátszott lap a kézbe kerül: a helyzet és a frame-ek azonosak a kézzel felvett lappal', () => {
    const auto = empty(); const s = st('Stupefy', 'A'); handPlay(auto, s); insertAt(auto, 0, s);
    const man = empty(); man.hand!.A!.push({ id: newZid(man, 'hand', 'A'), n: 'Stupefy' }); insertAt(man, 0, st('Stupefy', 'A')); // a kéz + gombja is newZid-del veszi fel
    expect(auto).toEqual(man);
    expect(an(auto).frames).toEqual(an(man).frames);
  });
  it('Falling Star és Not So Fast üres pályáról: alap unitok célpontnak, a frame-ek azonosak a kézzel felrakott helyzettel', () => {
    const auto = empty();
    const fs = st('Falling Star', 'A'); handPlay(auto, fs); insertAt(auto, 0, fs);
    const list = stepInfo(auto, auto.steps[0])!.list;
    expect(list).toHaveLength(2);
    addBasicTarget(auto, 0, 0, list[0]); addBasicTarget(auto, 0, 1, list[1]);
    const nsf = st('Not So Fast', 'B', ['s0']); handPlay(auto, nsf); insertAt(auto, 1, nsf);
    const man = empty();
    man.hand!.A!.push({ id: 'zhA_1', n: 'Falling Star' }); man.hand!.B!.push({ id: 'zhB_2', n: 'Not So Fast' });
    man.bd.push({ n: BASIC_UNIT, pl: 'B', loc: 'bf0', d: 0 }, { n: BASIC_UNIT, pl: 'B', loc: 'bf0', d: 0 });
    man.steps.push(st('Falling Star', 'A', ['b0', 'b1']), st('Not So Fast', 'B', ['s0']));
    const a = an(auto), m = an(man);
    expect(a.frames).toEqual(m.frames);
    expect(a.rows.filter((r: any) => /Nem szabályos|nincs megadva/.test(r[1]))).toEqual([]);
    expect(a.items.map((i: any) => [i.name, i.res])).toEqual([['Not So Fast', 'ok'], ['Falling Star', 'countered']]);
  });
  it('friendly célpontnál a saját oldalra, "here" célpontnál a forrás battlefieldjére kerül', () => {
    const cs = empty(); cs.steps.push({ ...st('Discipline', 'A'), loc: 'bf1' });
    const r = addBasicTarget(cs, 0, 0, { rel: 'friendly' });
    expect(r).toMatchObject({ side: 'A', loc: 'bf0' });
    const r2 = addBasicTarget(cs, 0, 0, { rel: 'enemy', here: true });
    expect(r2).toMatchObject({ side: 'B', loc: 'bf1' });
  });
});
