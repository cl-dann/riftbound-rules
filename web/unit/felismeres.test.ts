/* Műveletfelismerés és utasításokra bontás: a gyakori minták, valódi lapszövegekkel. */
import { describe, expect, it } from 'vitest';
import { actOf, allScope, classOf } from '../src/domain/chain/actions';
import { splitInstr, phrasesTxt, DIRECT_RE, LINK_RE, instrSources } from '../src/domain/chain/parser';
import { vsCard } from '../src/domain/data/store';
import { cs, run } from './util';

const k = (t: string) => actOf(t).k;
describe('actOf: gyakori minták', () => {
  it('give ... +N [S] (Might módosítás), minimummal', () => {
    expect(actOf('Give a unit -2 [S] this turn, to a minimum of 1 [S].')).toMatchObject({ k: 'might', n: -2, min: 1 });
    expect(actOf('Give me +2 [S] this turn.')).toMatchObject({ k: 'might', n: 2, self: true });
  });
  it('give ... [Keyword]', () => expect(actOf('Give a unit [Assault 2] this turn.')).toMatchObject({ k: 'kw', kw: 'Assault', n: 2 }));
  it('deal N to all (hatókör)', () => {
    expect(actOf('Deal 3 to all units in bases.')).toMatchObject({ k: 'dmg', n: 3 });
    expect(allScope('Deal 3 to all units in bases.')).toMatchObject({ type: 'unit', inbase: true });
  });
  it("return ... to its owner's hand", () => expect(k("Return a unit at a battlefield to its owner's hand.")).toBe('hand'));
  it('draw N, channel N, discard N', () => {
    expect(actOf('Draw 2.')).toMatchObject({ k: 'draw', n: 2 });
    expect(actOf('channel 1 rune exhausted.')).toMatchObject({ k: 'channel', n: 1 });
    expect(actOf('Discard 2')).toMatchObject({ k: 'discard', n: 2 });
  });
  it('ready és exhaust', () => {
    expect(k('Ready it.')).toBe('ready'); expect(k('ready me.')).toBe('ready');
    expect(k('Exhaust a unit.')).toBe('exhaust');
    expect(k('ready up to 4 friendly runes.')).toBe('runes');
  });
  it('play a ... token', () => expect(k('play a 1 [S] Recruit unit token in your base.')).toBe('token'));
  it('move ... to base, move ... (cél választható), helycsere', () => {
    expect(k('Move up to 2 friendly units to base.')).toBe('base');
    expect(k('Move a unit from a battlefield to its base.')).toBe('base');
    expect(k('Move a friendly unit')).toBe('move');
    expect(k('Move me to its location and it to my original location.')).toBe('swap');
  });
  it('kill all, banish', () => {
    expect(k('Kill all units.')).toBe('kill'); expect(allScope('Kill all units.')).toMatchObject({ type: 'unit' });
    expect(k('Banish a friendly unit')).toBe('banish');
  });
  it('gain control of, "You control it until I leave the board", "Lose control ... at end of turn"', () => {
    expect(k('Take control of an enemy unit at a battlefield.')).toBe('control');
    expect(actOf('You control it until I leave the board.')).toMatchObject({ k: 'ctrlUntil', until: 'src' });
    expect(actOf('Lose control of that unit and recall it at end of turn.')).toMatchObject({ k: 'delayed' });
  });
  it('counter ... unless', () => expect(actOf('Counter a spell unless its controller pays [2].')).toMatchObject({ k: 'counter', unless: true }));
  it('for each: a boardról számolható szorzó felismerve, a nem követett adat bizonytalan és megnevezi a hiányt', () => {
    expect(actOf('Give a friendly unit at a battlefield +2 [S] this turn for each enemy unit there.').each.cnt).toMatchObject({ rel: 'enemy', where: 'there', type: 'unit' });
    expect(actOf('This deals 1 Bonus Damage for each card with this name in your trash.').unsure).toMatch(/hiányzó adat: a trash tartalma/);
  });
  it('instead: feltételes változat (alt), feltétel nélküli replacement bizonytalan', () => {
    expect(actOf('If you paid the additional cost, deal 5 to it instead.')).toMatchObject({ k: 'dmg', n: 5, alt: true });
    expect(actOf('Return it to its owner\'s hand instead of putting it in their trash.').unsure).toMatch(/replacement/);
  });
  it('feltételek: boardról, játékállapotból, rejtett adatból (mező), ismert', () => {
    expect(actOf('If you control 4 or fewer runes, draw 1.').cond).toMatchObject({ how: 'state', key: 'runes' });
    expect(classOf('If you control 4 or fewer runes, draw 1.')).toBe('known');
    expect(actOf('If you have 7 or more cards in hand, draw 1.').cond).toMatchObject({ how: 'hidden', why: 'a kéz mérete (rejtett)' });
    expect(classOf('If you have 7 or more cards in hand, draw 1.')).toBe('hidden');
    expect(actOf('if you control two or more gear, ready me.').cond).toMatchObject({ how: 'board' });
    expect(actOf('If you played this from your hand, draw 1.').cond).toMatchObject({ how: 'known' });
  });
  it('Choose one: módválasztás, a builderben választható', () => { expect(k('Choose one \u2014')).toBe('modal'); expect(classOf('Choose one \u2014')).toBe('known'); });
  it('"Then do this:" reflexív trigger, "Prevent", "Double all damage", "The next time it would die"', () => {
    expect(actOf('Then do this: Choose another enemy unit at its destination.')).toMatchObject({ k: 'reflex', inner: 'choose' });
    expect(actOf('Prevent the next 7 damage that would be dealt to it this turn.')).toMatchObject({ k: 'prevent', n: 7 });
    expect(actOf('The next time that unit would be dealt damage this turn, prevent it.')).toMatchObject({ k: 'prevent', n: 99, next: true });
    expect(k('Double all damage that would be dealt to it this turn.')).toBe('dbldmg');
    expect(k('The next time it would die this turn, heal it, exhaust it, and recall it instead.')).toBe('saveNext');
  });
  it('kijátszás hatásból és újrakijátszás', () => {
    expect(actOf('play it, ignoring its cost.')).toMatchObject({ k: 'playcard', free: true });
    expect(actOf('its owner plays it to the same location, ignoring its cost.')).toMatchObject({ k: 'replay', to: 'same' });
  });
  it('"They deal damage equal to their Mights to each other"', () => expect(k('They deal damage equal to their Mights to each other.')).toBe('fight'));
  it('ismeretlen szöveg: other (nem találgat)', () => expect(k('Gutter Palace wins the game.')).toBe('other'));
});

describe('Utasításokra bontás és linked felismerés', () => {
  it('"if you do" közvetlen hivatkozás', () => expect(DIRECT_RE.test('If you do, buff me.')).toBe(true));
  it('", then" és " and ready" mentén bont', () => {
    expect(splitInstr('Discard 2, then draw 2.')).toEqual(['Discard 2', 'draw 2.']);
    expect(splitInstr('Move a friendly unit and ready it.')).toEqual(['Move a friendly unit', 'ready it.']);
  });
  it('a delayed mondatot nem bontja szét', () => expect(splitInstr('Ready it. Lose control of that unit and recall it at end of turn.')).toEqual(['Ready it.', 'Lose control of that unit and recall it at end of turn.']));
  it('névmás és "the friendly unit" linked', () => {
    expect(LINK_RE.test('Its controller draws 2.')).toBe(true);
    expect(LINK_RE.test('give the friendly unit +2 [S] this turn.')).toBe(true);
  });
});

describe('Célpont-kifejezések', () => {
  it('"each of up to two units": két nem kötelező célpont', () => expect(phrasesTxt('Deal 6 to each of up to two units.').map((p: any) => p.opt)).toEqual([true, true]));
  it('"a unit you control at another location": friendly, szabad location', () => expect(phrasesTxt('you may choose a unit you control at another location.')[0]).toMatchObject({ rel: 'friendly', free: true }));
  it('"an Equipment" feltételként nem célpont, a kijátszás nem célpont', () => {
    expect(phrasesTxt("If it's an Equipment, attach it to me.")).toHaveLength(0);
    expect(phrasesTxt('play a 1 [S] Recruit unit token in your base.')).toHaveLength(0);
    expect(phrasesTxt('Then detach an Equipment from it.')).toHaveLength(0);
  });
  it('"a friendly [Mighty] unit", "an equipped friendly unit", "an enemy unit here"', () => {
    expect(phrasesTxt('kill a friendly [Mighty] unit')[0]).toMatchObject({ rel: 'friendly', mighty: true });
    expect(phrasesTxt('Choose an equipped friendly unit.')[0]).toMatchObject({ eq: true, rel: 'friendly' });
    expect(phrasesTxt('deal damage equal to my Might to an enemy unit here.')[0]).toMatchObject({ rel: 'enemy', here: true });
  });
});

describe('Forrásfelismerés lapokon', () => {
  it('Deathknell em-dash után is felismerve, költségsor külön', () => {
    expect(instrSources(vsCard('Watchful Sentry'))).toEqual([{ k: 'trig', e: 'Draw 1.', why: 'Deathknell' }]);
    expect(instrSources(vsCard('Sacrifice')).map((x: any) => x.k)).toEqual(['cost', 'spell']);
  });
  it('Rampage: a fizetett additional cost után a friendly unit +2-t kap, majd kölcsönösen sebeznek', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Vanguard Sergeant', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Rampage', pl: 'A', addc: true, tg: ['b0', 'b1'] }] }));
    expect(x.ev('might')).toEqual([{ k: 'might', id: 'b0', name: 'Shipyard Skulker', from: 3, to: 5 }]);
    expect(x.ev('dmg').map((e: any) => [e.id, e.n])).toEqual([['b0', 4], ['b1', 5]]);
    expect(x.zone('b1')).toBe('trash');
  });
});
