/* Chain sablonok: minden sablon betöltött állapotára az elemzés hibátlan (nincs nem szabályos vagy hiányos lépés),
   és a leírásában állított eredmény teljesül. A hivatkozott szabályszámok léteznek. */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/render/html/chainReport';
import { TEMPLATES } from '../src/domain/chain/templates';
import { ruleText } from './util';
import { vsCard } from '../src/domain/data/store';

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
    const names = [...cs.bd.map((b: any) => b.n), ...cs.steps.filter((s: any) => s.n).map((s: any) => s.n), ...cs.bf.map((b: any) => b.fdn || b.n).filter(Boolean), ...['A', 'B'].flatMap((p) => [...((cs.trash || {})[p] || []), ...((cs.hand || {})[p] || []), ...((cs.deck || {})[p] || [])])].map((e: any) => (typeof e === 'string' ? e : e.n));
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

describe('Következő kör sablon', () => {
  it('nextturn: Temporary, hold triggerek, delayed trigger a Main Phase elején', () => {
    const x = run('nextturn');
    expect(x.r.items.map((i: any) => i.name)).toEqual(['Sprite triggere (Temporary, 816.1.b)', 'Grove of the God-Willow triggere (hold)', 'Vex, Gloomist triggere (hold)', 'Iascylla triggere (hold)', 'Iascylla triggere (delayed, Main Phase eleje)']);
    expect(x.r.objs.b2.loc).toBe('bf0');
  });
});

describe("Rek'Sai sablonok: a lefutás sorrendje és állapotai", () => {
  const changes = (r: any) => r.frames.flatMap((f: any) => f.changes.map((c: any) => c.join(' '))).join('\n');
  it('Sanctum fölül: előbb a Sanctum, utána a Rek\'Sai, majd a Ki Barrier és a Tracker trigger', () => {
    const x = run('reksai-sanctum');
    expect(x.r.items.map((i: any) => i.name)).toEqual(['The Candlelit Sanctum triggere (When you conquer here)', "Rek'Sai, Void Burrower triggere (When you conquer)", 'Ki Barrier', 'Bilgewater Tracker play triggere']);
    expect(x.r.items.every((i: any) => i.res === 'ok')).toBe(true);
    // a "you may" és az exhaust költség a chainre tételkor (383.3.a, 383.3.b)
    expect(changes(x.r)).toMatch(/Rek'Sai, Void Burrower triggere: a "you may" döntés \(igen\) és az exhaust költség a chainre tételkor/);
    expect(x.r.objs.LA.ex).toBe(true);
    // Sanctum: a Chemtech Enforcer recycle, a Tracker marad felül; Rek'Sai: Tracker és Dangerous Duo
    expect(x.text).toMatch(/Chemtech Enforcer: megnézett lapok közül recycle/);
    expect(x.text).toMatch(/Felfedett lapok \(nyilvánossá válnak, 128\.5\): Bilgewater Tracker, Dangerous Duo/);
    // a Tracker a Sanctumra, ready (Rek'Sai, Breacher Accelerate-je), a Duo recycle
    const tr = Object.values(x.r.objs).find((o: any) => o.name === 'Bilgewater Tracker' && o.zone === 'board') as any;
    expect(tr).toMatchObject({ loc: 'bf0', ex: false });
    expect(x.text).toMatch(/Rek'Sai, Breacher adja a nem kézből kijátszott unitnak \(805\.1\.b, 805\.6\)/);
    expect(x.r.objs.zdA_3.ord).toBeGreaterThanOrEqual(900);
    // a Ki Barrier válaszként a Tracker trigger fölé, a Demolitionist túléli, a Feline 1 damage
    expect(x.text).toMatch(/Az ellenfél válaszként kijátssza a Ki Barrier lapot/);
    expect([x.r.objs.b2.dmg, x.r.objs.b3.dmg, x.r.objs.b2.zone]).toEqual([0, 1, 'board']);
  });
  it('fordított sorrend (Sanctum alul): a Rek\'Sai fed fel előbb (Tracker, Chemtech Enforcer), a Sanctum a megmaradt tetejét nézi', () => {
    const cs = TEMPLATES.find((t) => t.id === 'reksai-sanctum')!.cs();
    const [rek, san] = [cs.steps[0], cs.steps[1]];
    san.cb = rek.cb; delete rek.cb; san.zp = { 1: ['zdA_3'] };
    cs.steps = [san, rek, { k: 'res' }, { k: 'res' }];
    const r = analyze(JSON.parse(JSON.stringify(cs)));
    // a Rek'Sai által kijátszott Tracker play triggere a Sanctum fölé kerül, ezért előbb resolve-ol
    expect(r.items.map((i: any) => i.name).slice(0, 3)).toEqual(["Rek'Sai, Void Burrower triggere (When you conquer)", 'Bilgewater Tracker play triggere', 'The Candlelit Sanctum triggere (When you conquer here)']);
    const t = r.rows.map((x) => x.join(' ')).join('\n');
    expect(t).toMatch(/Felfedett lapok \(nyilvánossá válnak, 128\.5\): Bilgewater Tracker, Chemtech Enforcer/);
    expect(t).toMatch(/Megnézett lapok \(rejtett adat, csak a tulajdonos látja, 128\.4\): Dangerous Duo/);
  });
  it('Swarm Queen: a kijátszott unit a támadott, ellenfél irányította battlefieldre kerül (355.2.b)', () => {
    const x = run('reksai-queen');
    const sk = Object.values(x.r.objs).find((o: any) => o.name === 'Shipyard Skulker' && o.zone === 'board') as any;
    expect(sk.loc).toBe('bf1');
    expect(x.text).toMatch(/a lap erre engedélyt ad \(355\.2\.b\)/);
    expect(x.r.objs.zdA_2.ord).toBeGreaterThanOrEqual(900);
  });
});
