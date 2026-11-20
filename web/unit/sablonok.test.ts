/* Chain sablonok: minden sablon betöltött állapotára az elemzés hibátlan (nincs nem szabályos vagy hiányos lépés),
   és a leírásában állított eredmény teljesül. A hivatkozott szabályszámok léteznek. */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/legacy/chainCore';
import { TEMPLATES } from '../src/legacy/chainTemplates';
import { ruleText } from './util';
import { vsCard } from '../src/legacy/core';

const run = (id: string) => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const r = analyze(JSON.parse(JSON.stringify(t.cs())));
  const text = r.rows.map((x) => x.join(' ')).join('\n');
  const item = (re: RegExp) => r.items.find((i: any) => re.test(i.name));
  return { r, text, item, ev: (k: string) => r.ev.filter((e: any) => e.k === k) };
};

describe('Chain sablonok', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s: valós lapok, létező szabályszámok, hibátlan elemzés', (_id, t) => {
    const cs = t.cs();
    const names = [...cs.bd.map((b: any) => b.n), ...cs.steps.filter((s: any) => s.n).map((s: any) => s.n), ...cs.bf.map((b: any) => b.fdn || b.n).filter(Boolean), ...['A', 'B'].flatMap((p) => [...((cs.trash || {})[p] || []), ...((cs.hand || {})[p] || [])])];
    names.forEach((n: string) => expect(vsCard(n), n).toBeTruthy());
    t.refs.split(/,\s*/).forEach((ref) => expect(() => ruleText(ref)).not.toThrow());
    const r = analyze(JSON.parse(JSON.stringify(cs)));
    expect(r.empty).toBe(false);
    const bad = r.rows.filter((x) => /Nem szabályos|nincs megadva/.test(x[1]));
    expect(bad).toEqual([]);
    expect(r.frames.filter((f: any) => f.sj != null)).toHaveLength(cs.steps.filter((s: any) => s.k === 'card' || s.k === 'ab' || s.k === 'tg').length);
  });
  it('counter: a Void Seeker counterelve, a "When you play a spell" nem triggerel', () => {
    const x = run('counter');
    expect(x.item(/^Void Seeker/)!.res).toBe('countered');
    expect(x.ev('might')).toHaveLength(0);
    expect(x.text).toMatch(/420\.4\.a\.1/);
  });
  it('ignored: kill és draw Ignored', () => {
    expect(run('ignored').item(/^Hidden Blade/)!.instr.map((i: any) => i.st)).toEqual(['ignored', 'ignored']);
  });
  it('negated: kill Negated, draw végrehajtódik', () => {
    const x = run('negated');
    expect(x.item(/^Hidden Blade/)!.instr.map((i: any) => i.st)).toEqual(['negated', 'executed']);
    expect(x.ev('draw')).toEqual([{ k: 'draw', pl: 'B', n: 2 }]);
  });
  it('trigorder: az ellenfél Deathknellje resolve-ol előbb (383.3.d.1)', () => {
    const x = run('trigorder');
    expect(x.text).toMatch(/383\.3\.d\.1/);
    expect(x.ev('draw').map((e: any) => e.pl)).toEqual(['B', 'A']);
  });
  it('replacement: mindkét sorrend kiírva, 372', () => {
    const x = run('replacement');
    expect(x.text).toMatch(/Prevent előbb .* duplázás előbb/);
    expect(x.text).toMatch(/372/);
  });
  it('hidden: a Hidden Blade facedown-ból válaszként szabályos, Yasuo meghal', () => {
    const x = run('hidden');
    expect(x.text).toMatch(/facedown-ból \[Reaction\]-ként jön/);
    expect(x.r.objs.b0.zone).toBe('trash');
  });
  it('endturn: Ending Step, a trigger lefut, utána Expiration Step', () => {
    const x = run('endturn');
    expect(x.r.items.map((i: any) => i.name)).toEqual(['Star-Crossed', 'Sona, Harmonious triggere (kör vége)']);
    expect(x.text).toMatch(/383\.2\.a\.1/);
    expect(x.r.frames.some((f: any) => /Expiration Step/.test(f.label))).toBe(true);
  });
  it('trash: a Morbid Return célpontja elhagyta a trasht, Ignored; a kézbe nem kerül semmi', () => {
    const x = run('trash');
    expect(x.item(/^Morbid Return/)!.instr[0].st).toBe('ignored');
    expect(x.text).toMatch(/359\.3\.e\.5, 359\.3\.e\.6/);
    expect(x.r.frames[x.r.frames.length - 1].board.me.hand).toEqual([]);
  });
});
