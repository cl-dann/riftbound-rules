/* Ready belépés: additional cost, saját base, Legion a lépésekből, Renata és token létrehozás. */
import { describe, expect, it } from 'vitest';
import { cs, run } from './util';

const play = (n: string, extra: Record<string, unknown> = {}) => ({ k: 'card', n, pl: 'A', loc: 'base', ...extra });

describe('Ready belépés finomítások', () => {
  it('Crescent Guardian: "If you do, I enter ready" a kifizetett additional costtól függ', () => {
    expect(run(cs({ steps: [play('Crescent Guardian', { addc: true })] })).o('s0').ex).toBe(false);
    const x = run(cs({ steps: [play('Crescent Guardian')] }));
    expect(x.o('s0').ex).toBe(true);
    expect(x.text).toMatch(/additional cost nincs kifizetve/);
  });
  it('Xin Zhao: csak a saját base-ében álló saját unitok számítanak', () => {
    expect(run(cs({ bd: [{ n: 'Recruit', pl: 'A', loc: 'base' }, { n: 'Recruit', pl: 'A', loc: 'base' }], steps: [play('Xin Zhao, Vigilant')] })).o('s0').ex).toBe(false);
    expect(run(cs({ bd: [{ n: 'Recruit', pl: 'A', loc: 'base' }, { n: 'Recruit', pl: 'B', loc: 'base' }, { n: 'Recruit', pl: 'A', loc: 'bf0' }], steps: [play('Xin Zhao, Vigilant')] })).o('s0').ex).toBe(true);
  });
  it('Sun Disc [Legion]: a korábbi lépésből kiszámolva teljesül; előzmény nélkül nem, a kezdőérték (korábban kijátszott lap) a builderben megadható', () => {
    const sd = { n: 'Sun Disc', pl: 'A', loc: 'base' };
    const yes = run(cs({ bd: [sd], steps: [play('Shipyard Skulker'), { k: 'ab', src: 'b0', ai: 0, n: 'Sun Disc', pl: 'A' }] }));
    expect(yes.text).toMatch(/a feltétel \("Legion"\) teljesül \(játékállapotból: korábban kijátszott lap: van/);
    const no = run(cs({ bd: [sd], steps: [{ k: 'ab', src: 'b0', ai: 0, n: 'Sun Disc', pl: 'A' }] }));
    expect(no.text).toMatch(/nem teljesül \(játékállapotból: korábban kijátszott lap: nincs/);
    const st = run({ ...cs({ bd: [sd], steps: [{ k: 'ab', src: 'b0', ai: 0, n: 'Sun Disc', pl: 'A' }] }), ps: { A: { played: 1 } } } as any);
    expect(st.text).toMatch(/teljesül \(játékállapotból: korábban kijátszott lap: van/);
  });
  it('Renata a boardon: a token létrejön és ready lép be (143.4.a); nélküle exhausted (143.4)', () => {
    const x = run(cs({ bd: [{ n: 'Renata Glasc, Industrialist', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: "Desert's Call", pl: 'A' }] }));
    expect(x.ev('token')).toHaveLength(1);
    expect(x.o('k1')).toMatchObject({ name: 'Sand Soldier token', zone: 'board', loc: 'base', ex: false, m: 2 });
    expect(x.text).toMatch(/Renata Glasc, Industrialist: "Your tokens enter ready\.", 143\.4\.a/);
    const y = run(cs({ steps: [{ k: 'card', n: "Desert's Call", pl: 'A' }] }));
    expect(y.o('k1')).toMatchObject({ ex: true, m: 2 });
    expect(y.text).toMatch(/exhausted \(143\.4\)/);
  });
});
