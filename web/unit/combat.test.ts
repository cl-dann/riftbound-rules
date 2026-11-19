/* Combat damage kiosztás: a Core Rules 467.2.c hivatalos példái (combatCore.ts). */
import { describe, expect, it } from 'vitest';
import { DEF_OPT, ALL, need, exempt, check, suggest, type CU, type Opt } from '../src/components/combatCore';
import { exampleOf } from './util';

const u = (id: string, m: number, o: Partial<Opt> = {}, dmg = 0): CU => ({ id, uid: id, n: id, side: 'opp', m, dmg, stun: false, opt: { ...DEF_OPT, ...o }, sugs: [] });

describe('467.2.c: combat damage kiosztás', () => {
  it('467.2.c.5: 2 Might, "prevent the first 3 damage": 5 kell a lethalhoz', () => {
    exampleOf('467.2.c.5', 'prevent the first 3 damage');
    expect(need(u('a', 2, { prev: 3 }))).toBe(5);
  });
  it('467.2.c.8: Caitlyn Tank és Backline, a kiosztó előre vagy hátra teheti, középre nem', () => {
    exampleOf('467.2.c.8', 'Caitlyn, Patrolling');
    const C = u('C', 3, { tank: true, back: true }), X = u('X', 3), Y = u('Y', 3);
    const R = [C, X, Y];
    expect(check(R, { C: 3, X: 1, Y: 0 }, 4)).toEqual([]);           // Tankként előre
    expect(check(R, { C: 1, X: 3, Y: 3 }, 7)).toEqual([]);           // Backline-ként hátra
    expect(check(R, { C: 1, X: 3, Y: 0 }, 4).length).toBeGreaterThan(0); // középre nem
  });
  it('467.2.c.9: két Caitlyn Tankként mindkettő a sima unit előtt kaphat', () => {
    exampleOf('467.2.c.9', 'Two copies of Caitlyn');
    const R = [u('C1', 3, { tank: true, back: true }), u('C2', 3, { tank: true, back: true }), u('X', 3)];
    expect(check(R, { C1: 3, C2: 3, X: 1 }, 7)).toEqual([]);
    expect(suggest(R, 7)).toEqual({ C1: 3, C2: 3, X: 1 });
  });
  it('467.2.c.10: a nem sebezhető unit mentes, a megelőzés (Counter Strike) nem ad mentességet', () => {
    exampleOf('467.2.c.10', 'Kayn, Unleashed');
    exampleOf('467.2.c.10', 'Counter Strike');
    const K = u('K', 6, { nodmg: true }), X = u('X', 3);
    expect(exempt(K)).toBe(true);
    expect(check([K, X], { K: 0, X: 5 }, 5)).toEqual([]);
    expect(check([K, X], { K: 2, X: 1 }, 3).length).toBeGreaterThan(0); // amíg X nem kapott lethalt, K nem kaphat
    expect(check([K, X], { K: 2, X: 3 }, 5)).toEqual([]); // a lethal után a maradék szabadon
    const P = u('P', 2, { prev: ALL });
    expect(exempt(P)).toBe(false);
    expect(check([P, X], { P: 0, X: 5 }, 5).length).toBeGreaterThan(0); // P nem hagyható ki a kötelező kiosztásból
    expect(check([P, X], { P: 2, X: 3 }, 5)).toEqual([]);
  });
  it('815, 826: Tank előbb, Backline utoljára', () => {
    const T = u('T', 2, { tank: true }), B = u('B', 2, { back: true }), X = u('X', 2);
    expect(suggest([B, X, T], 5)).toEqual({ T: 2, X: 2, B: 1 });
    expect(check([B, X, T], { T: 0, X: 2, B: 2 }, 4).map((e) => e.r)).toContain('815.1.b, 815.1.c.2');
  });
});
