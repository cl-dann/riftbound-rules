/* Laponkénti kézi hatásleírások (src/legacy/cardRules.ts): minden bejegyzés él (a lap szövegében van illeszkedő utasítás),
   a hivatkozott szabályszámok léteznek, a besorolás nem "nem felismert" és nem "bizonytalan". Utána a végrehajtó
   bejegyzések viselkedése lapról lapra, majd a játékállapotból kiértékelt feltételek. */
import { describe, expect, it } from 'vitest';
import { cs, run } from './util';
import { CARD_OV } from '../src/domain/chain/overrides';
import { instrSources, splitInstr } from '../src/domain/chain/parser';
import { classOf, hiddenWhy } from '../src/domain/chain/actions';
import { vsCard } from '../src/domain/data/store';
import RULES from '../src/generated/rules.json';

const ids = new Set((RULES as any[]).map((r) => r[0]));
const instrsOf = (n: string) => { const c = vsCard(n); return c ? instrSources(c).flatMap((s: any) => (s.k === 'cost' ? [] : splitInstr(s.e))) : []; };

describe('cardRules: minden bejegyzés', () => {
  it.each(Object.keys(CARD_OV))('%s', (name) => {
    const c = vsCard(name);
    expect(c && c.n).toBe(name);
    const L = instrsOf(name);
    for (const o of CARD_OV[name]) {
      const t = L.find((x: string) => o.re.test(x.replace(/^[-\u2014\u2013*]\s*/, '')));
      expect(t, name + ': ' + o.re).toBeTruthy();
      expect(['known', 'hidden', 'open']).toContain(classOf(t!, name));
      if (o.hidden) { expect(classOf(t!, name)).toBe('hidden'); expect(hiddenWhy(t!, name)).not.toBe(''); }
      if (o.open) expect(classOf(t!, name)).toBe('open');
      for (const r of o.refs.split(/,\s*/)) expect(ids.has(r), name + ': ' + r).toBe(true);
      expect(o.d).not.toMatch(/[\u2013\u2014]/);
      if (o.field) expect(o.field.def).not.toBeUndefined();
    }
  });
});

describe('cardRules: végrehajtó bejegyzések', () => {
  it('Angle Shot: alapból detach (lapnál megadható), attach választással felcsatol', () => {
    const d = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Long Sword', pl: 'A', loc: 'bf0', on: 0 }], steps: [{ k: 'card', n: 'Angle Shot', pl: 'A', tg: ['b0', 'b1'] }] }));
    expect(d.o('b1').on).toBeFalsy();
    const a = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Long Sword', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Angle Shot', pl: 'A', tg: ['b0', 'b1'], hv: { 1: 'attach' } }] }));
    expect(a.o('b1')).toMatchObject({ on: 'b0', loc: 'bf0' });
  });
  it('Bullet Time: a kifizetett [A] mennyiségű damage minden enemy unitra a választott battlefielden', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }, { n: 'Sona, Harmonious', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Bullet Time', pl: 'A', tg: ['F0'], hv: { 0: 3 } }] }));
    expect(x.ev('dmg').map((e: any) => e.id).sort()).toEqual(['b0', 'b1']);
    expect(x.ev('dmg')[0].n).toBe(3);
  });
  it('Carnivorous Snapvine: a két unit a saját Mightjával sebzi egymást (418.6.b.3)', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Carnivorous Snapvine', pl: 'A', loc: 'base', tg: ['b0'] }] }));
    expect(x.zone('b0')).toBe('trash');
    expect(x.o('s0').dmg).toBe(3);
  });
  it('Convergent Mutation: a Might a másik friendly unit Mightjára nő', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Convergent Mutation', pl: 'A', tg: ['b0', 'b1'] }] }));
    expect(x.ev('might')[0]).toMatchObject({ id: 'b0', from: 3, to: 8 });
  });
  it('En Garde: a további +1 csak akkor, ha egyedül áll ott', () => {
    expect(run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'En Garde', pl: 'A', tg: ['b0'] }] })).ev('might').length).toBe(2);
    expect(run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'En Garde', pl: 'A', tg: ['b0'] }] })).ev('might').length).toBe(1);
  });
  it('Get Excited!: az eldobott lap költsége rejtett adat, alap 0 (nincs damage), a lapnál megadva sebez', () => {
    const bd = [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }];
    expect(run(cs({ bd, steps: [{ k: 'card', n: 'Get Excited!', pl: 'A', tg: ['b0'] }] })).ev('dmg')).toHaveLength(0);
    expect(run(cs({ bd, steps: [{ k: 'card', n: 'Get Excited!', pl: 'A', tg: ['b0'], hv: { 1: 4 } }] })).ev('dmg')[0].n).toBe(4);
  });
  it("King's Edict: az ellenfél választ egy unitot, amit nem a kijátszó irányít, és az meghal", () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: "King's Edict", pl: 'A', mp: { 0: { B: 'b1' } } }] }));
    expect([x.zone('b0'), x.zone('b1')]).toEqual(['board', 'trash']);
  });
  it('Party Favors: a Cards választás mindkét játékosnak húzást ad', () => {
    const x = run(cs({ steps: [{ k: 'card', n: 'Party Favors', pl: 'A', mp: { 0: { B: 'Cards' } } }] }));
    expect(x.ev('draw').map((e: any) => e.pl)).toEqual(['A', 'B']);
    expect(x.ev('channel')).toHaveLength(0);
  });
  it('Rebuttal: fizetés nélkül counter, fizetéssel kontrollátvétel', () => {
    const bd = [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }];
    const no = run(cs({ bd, steps: [{ k: 'card', n: 'Void Seeker', pl: 'B', tg: ['b0'] }, { k: 'card', n: 'Rebuttal', pl: 'A', tg: ['s0'] }] }));
    expect(no.ev('counter')).toHaveLength(1);
    expect(no.ev('ctrl')).toHaveLength(0);
    const yes = run(cs({ bd, steps: [{ k: 'card', n: 'Void Seeker', pl: 'B', tg: ['b0'] }, { k: 'card', n: 'Rebuttal', pl: 'A', tg: ['s0'], hv: { 1: '1' } }] }));
    expect(yes.ev('counter')).toHaveLength(0);
    expect(yes.ev('ctrl')).toHaveLength(1);
  });
  it('Riposte: a spell counterelve, a unit a spell Energy költségét kapja Mightként; a unitot nem counterel', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'B', tg: ['b0'] }, { k: 'card', n: 'Riposte', pl: 'A', tg: ['b0', 's0'] }] }));
    expect(x.zone('b0')).toBe('board');
    expect(x.zone('s0')).toBe('countered');
    expect(x.ev('might')[0]).toMatchObject({ id: 'b0', from: 3, to: 6 });
  });
  it('Unyielding Spirit: minden unitra vonatkozik (438.1.b.1.b), levezetés, nem nyitott kérdés', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'B', tg: ['b0'] }, { k: 'card', n: 'Unyielding Spirit', pl: 'A' }] }));
    expect(x.ev('dmg')).toHaveLength(0);
    expect(x.r.html).not.toMatch(/nyitott kérdés/);
    expect(x.text).toMatch(/438\.1\.b\.1\.b, 438\.4; levezetés/);
  });
  it('Cataclysmic Duel: a választott unitok maradnak, a többi meghal', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Cataclysmic Duel', pl: 'A', mp: { 0: { A: 'b1', B: 'b2' } } }] }));
    expect(['b0', 'b1', 'b2', 'b3'].map((i) => x.zone(i))).toEqual(['trash', 'board', 'board', 'trash']);
  });
  it('Improvised Projectile: a kiválasztott gear nyomtatott Energy költsége a damage', () => {
    const x = run(cs({ bd: [{ n: 'Long Sword', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Improvised Projectile', pl: 'A', tg: ['b0', 'b1'] }] }));
    expect(x.ev('dmg')[0]).toMatchObject({ id: 'b1', n: (vsCard('Long Sword') as any).e });
  });
  it('Acceptable Losses és Cull the Weak: mindenki a saját választását öli meg (412.1)', () => {
    const a = run(cs({ bd: [{ n: 'Long Sword', pl: 'A', loc: 'base' }, { n: 'Sun Disc', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Acceptable Losses', pl: 'A', mp: { 0: { A: 'b0', B: 'b1' } } }] }));
    expect([a.zone('b0'), a.zone('b1')]).toEqual(['trash', 'trash']);
    const c = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Cull the Weak', pl: 'A', mp: { 0: { A: 'b0' } } }] }));
    expect([c.zone('b0'), c.zone('b1')]).toEqual(['trash', 'board']);
    expect(c.text).toMatch(/Az ellenfél választása: nincs megadva/);
  });
  it('Abandon: a counterelt spell a tulajdonosa kezébe kerül', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'B', tg: ['b0'] }, { k: 'card', n: 'Abandon', pl: 'A', tg: ['s0'] }] }));
    expect(x.zone('s0')).toBe('hand');
  });
  it('Piltovan Guidebot: az alap Might a kiváltó, kijátszott lap Energy költsége', () => {
    const x = run(cs({ bd: [{ n: 'Piltovan Guidebot', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Mega-Mech', pl: 'A', loc: 'base' }] }));
    expect(x.ev('setbase')[0]).toMatchObject({ id: 'b0', n: 7 });
  });
  it('Stand United: ebben a körben a buff +2 Mightot ad', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Stand United', pl: 'A', tg: ['b0'] }] }));
    expect(x.r.objs.b0.bu).toBe(true);
    expect(x.r.html).toMatch(/Shipyard Skulker \(1\. battlefield\)?[^<]*5 Might|5 Might/);
  });
  it('Consuming Curse: korábbi példányok a trashben Bonus Damage-et adnak', () => {
    const bd = [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }];
    expect(run(cs({ bd, steps: [{ k: 'card', n: 'Consuming Curse', pl: 'A', tg: ['b0'], hv: { 1: 1 } }] })).ev('dmg')[0].n).toBe(3);
  });
  it('Sivir és az "excess damage" feltételek: nyitott kérdés (flag 2), nem számolt érték', () => {
    expect(classOf('if you assigned 5 or more excess damage to enemy units, you may deal that much to an enemy unit.', 'Sivir, Ambitious')).toBe('open');
    expect(classOf('if you assigned 3 or more excess damage, play two Gold gear tokens exhausted.', 'Yeti Brawler')).toBe('open');
    const tg = { k: 'tr', n: 'Sivir, Ambitious', src: 'b0', pl: 'A', eff: 'if you assigned 5 or more excess damage to enemy units, you may deal that much to an enemy unit.', why: 'Conquer', tg: ['b1'], cb: { bf: 'bf0', dead: [], recall: [], ctrl: 'A', label: '' } };
    const x = run(cs({ bd: [{ n: 'Sivir, Ambitious', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'base' }], steps: [tg] }));
    expect(x.ev('dmg')).toHaveLength(0);
    expect(x.r.html).toMatch(/nyitott kérdés/);
    // a két értelmezés eredménye egymás mellett
    expect(x.r.html).toMatch(/1\. értelmezés:.*lethal fölött kiosztott.*2\. értelmezés:.*Mightja fölötti összes damage/);
  });
  it('Curtain Call: három Repeat költség, minden végrehajtás más mód; ugyanaz a mód kétszer szabálytalan', () => {
    const bd = [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'base' }];
    const a = run(cs({ bd, steps: [{ k: 'card', n: 'Curtain Call', pl: 'A', mode: 1, rep: 2, mode2: 2, mode3: 0, tg: ['b0', 'b1'] }] }));
    expect(a.ev('dmg').map((e: any) => [e.id, e.n])).toEqual([['b0', 2], ['b1', 3]]);
    expect(a.ev('draw')).toHaveLength(1);
    expect(a.text).toMatch(/2 alkalommal \(3 külön költségből\)/);
    // Repeat nélkül csak a választott mód (Deal 2) hajtódik végre
    const b = run(cs({ bd, steps: [{ k: 'card', n: 'Curtain Call', pl: 'A', mode: 1, tg: ['b0'] }] }));
    expect(b.ev('dmg')).toEqual([expect.objectContaining({ id: 'b0', n: 2 })]);
    expect(b.item(/Curtain Call/)!.instr.map((i: any) => i.t)).toEqual(['Deal 2 to a unit at a battlefield.']);
    const c = run(cs({ bd, steps: [{ k: 'card', n: 'Curtain Call', pl: 'A', mode: 1, rep: 1, mode2: 1, tg: ['b0', 'b0'] }] }));
    expect(c.text).toMatch(/Nem szabályos[^\n]*haven't already chosen/);
  });
  it('Kato the Arm: az összes jelenlegi keyword, a kapottak is (Block: Shield 3 és Tank), a Shield értékek összeadódnak', () => {
    const x = run(cs({ bd: [{ n: 'Kato the Arm', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }],
      steps: [{ k: 'card', n: 'Block', pl: 'A', tg: ['b0'] }, { k: 'res' }, { k: 'tg', src: 'b0', ti: 0, n: 'Kato the Arm', pl: 'A', tg: ['b1'] }] }));
    expect(x.o('b0').kws).toEqual(['Shield 3', 'Tank']);
    expect(x.o('b1').kws).toEqual(expect.arrayContaining(['Deflect', 'Shield 3', 'Tank']));
    expect(x.text).toMatch(/801\.3\.a, 814\.2/);
    expect(x.text).toMatch(/Shipyard Skulker összesített értéke: Shield 3, Deflect 1/);
  });
  it('Tornado Warrior: a "When you play me from face down" trigger csak facedown-ból kijátszva kerül a chainre; empower, a kör végén disempower', () => {
    const bd = [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }];
    const fd = run(cs({ bd, steps: [{ k: 'card', n: 'Tornado Warrior', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] }] }));
    expect(fd.o('b0').emp).toBe(true);
    expect(fd.r.delayed).toHaveLength(1);
    const end = run(cs({ bd, steps: [{ k: 'card', n: 'Tornado Warrior', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] }, { k: 'end' }] }));
    expect(end.o('b0').emp).toBe(false);
    const hand = run(cs({ bd, steps: [{ k: 'card', n: 'Tornado Warrior', pl: 'A', loc: 'bf0', tg: ['b0'] }] }));
    expect(hand.o('b0').emp).toBeFalsy();
    expect(hand.text).toMatch(/383\.2\.a A play trigger feltétele \("When you play me from face down"\) nem teljesül/);
    expect(hand.text).not.toMatch(/if you paid the additional cost|"You may"/);
  });
  it('Tomb-Raider Barbara: a "7 or more runes" a trigger feltétele (383.2.a.1), nem teljesülve nem triggerel', () => {
    const bd = [{ n: 'Sun Disc', pl: 'B', loc: 'base' }];
    const no = run(cs({ bd, steps: [{ k: 'card', n: 'Tomb-Raider Barbara', pl: 'A', loc: 'base', tg: ['b0'] }] }));
    expect(no.zone('b0')).toBe('board');
    expect(no.r.items).toHaveLength(0);
    expect(no.text).toMatch(/383\.2\.a\.1 A play trigger feltétele \("if you control 7 or more runes"\) a kijátszáskor nem teljesül/);
    const yes = run({ ...cs({ bd, steps: [{ k: 'card', n: 'Tomb-Raider Barbara', pl: 'A', loc: 'base', tg: ['b0'] }] }), ps: { A: { runes: 7 } } } as any);
    expect(yes.zone('b0')).toBe('trash');
    expect(no.text).not.toMatch(/if you paid the additional cost|You may/);
    // "If it's [Empowered], disempower it. Otherwise, kill it.": csak az egyik ág fut le
    const emp = run({ ...cs({ bd: [{ ...bd[0], emp: true }], steps: [{ k: 'card', n: 'Tomb-Raider Barbara', pl: 'A', loc: 'base', tg: ['b0'] }] }), ps: { A: { runes: 7 } } } as any);
    expect(emp.zone('b0')).toBe('board');
    expect(emp.o('b0').emp).toBe(false);
    expect(emp.text).toMatch(/az előző feltétel \("it's \[Empowered\]"\) teljesült, ezért az "Otherwise" ág nem hajtódik végre/);
    expect(yes.text).toMatch(/nem teljesült, ezért az "Otherwise" ág hajtódik végre/);
    expect(yes.ev('disempower')).toHaveLength(0);
  });
  it("King's Edict: csak a kijátszó által nem irányított unit választható; a \"hasn't been chosen\" megkötés jelezve", () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: "King's Edict", pl: 'A', mp: { 0: { B: 'b0' } } }] }));
    expect(x.zone('b0')).toBe('board');
    expect(x.text).toMatch(/nem felel meg a lap megkötésének/);
    expect(x.text).toMatch(/amelyet erre a spellre még senki nem választott/);
  });
  it('Card Sharp: az ellenfél választásától függően egy exhausted Gold token', () => {
    const t = (v: string) => run(cs({ steps: [{ k: 'card', n: 'Card Sharp', pl: 'A', loc: 'base', hv: { 1: v } }] }));
    // az első utasítás (a saját "may play") egy tokent ad, a második az ellenfél döntésétől függ
    expect(t('1').ev('token')).toHaveLength(2);
    expect(t('1').o('k1')).toMatchObject({ name: 'Gold token', type: 'gear', ex: true });
    expect(t('0').ev('token')).toHaveLength(1);
  });
});

describe('Játékállapotból kiértékelt feltételek', () => {
  const U = [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }];
  it('[Level 6]: a kezdő XP mezőből', () => {
    const st = (xp: number) => run({ ...cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Combat Experience', pl: 'A', tg: ['b0'] }] }), ps: { A: { xp } } } as any);
    expect(st(0).ev('might')[0].to).toBe(4);
    expect(st(6).ev('might')[0].to).toBe(6);
  });
  it('"If you control 7 or more runes": a rune-ok száma a játékállapotból', () => {
    const st = (runes: number) => run({ ...cs({ bd: U, steps: [{ k: 'card', n: 'Siphoning Strike', pl: 'A', tg: ['b0'] }] }), ps: { A: { runes } } } as any);
    expect(st(3).ev('dmg')[0].n).toBe(4);
    expect(st(7).ev('dmg')[0].n).toBe(7);
  });
  it('"If you control a facedown card": a battlefield facedown mezőjéből', () => {
    const c = cs({ bd: U, steps: [{ k: 'card', n: 'Monster Harpoon', pl: 'A', tg: ['b0'] }] });
    expect(run(c).ev('dmg')[0].n).toBe(2);
    c.bf[1] = { ...c.bf[1], fd: 'A' } as any;
    expect(run(c).ev('dmg')[0].n).toBe(4);
  });
  it('"If you can\'t" (Mobilize): a Rune Deck mérete a játékállapotból', () => {
    expect(run(cs({ steps: [{ k: 'card', n: 'Mobilize', pl: 'A' }] })).ev('draw')).toHaveLength(0);
    expect(run({ ...cs({ steps: [{ k: 'card', n: 'Mobilize', pl: 'A' }] }), ps: { A: { runeDeck: 0 } } } as any).ev('draw')).toHaveLength(1);
  });
  it('"If you showed off": a lépés Show Off mezőjéből', () => {
    const bd = [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Long Sword', pl: 'A', loc: 'base' }];
    expect(run(cs({ bd, steps: [{ k: 'card', n: 'Battle Preparations', pl: 'A', tg: ['b0'] }] })).text).toMatch(/nem teljesül \(játékállapotból: nincs Show Off/);
    expect(run(cs({ bd, steps: [{ k: 'card', n: 'Battle Preparations', pl: 'A', tg: ['b0'], so: 'b1' }] })).text).toMatch(/teljesül \(játékállapotból: Show Off: Long Sword/);
  });
  it('[Legion] (Noxian Guillotine): korábbi kijátszás a lépésekből', () => {
    const t = (pre: boolean) => run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: (pre ? [{ k: 'card', n: 'Sun Disc', pl: 'A', loc: 'base' }] : []).concat([{ k: 'card', n: 'Noxian Guillotine', pl: 'A', tg: ['b0'] } as any]) }));
    expect(t(true).zone('b0')).toBe('trash');
    expect(t(false).zone('b0')).toBe('board');
    expect(t(false).r.delayed[0].t).toMatch(/next time it takes damage/);
  });
});
