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
  it('Sun Disc [Legion]: a korábbi lépésből kiszámolva teljesül; előzmény nélkül nem követett, a builderben felülírható', () => {
    const sd = { n: 'Sun Disc', pl: 'A', loc: 'base' };
    const yes = run(cs({ bd: [sd], steps: [play('Shipyard Skulker'), { k: 'ab', src: 'b0', ai: 0, n: 'Sun Disc', pl: 'A' }] }));
    expect(yes.text).toMatch(/korábbi lépésekből/);
    const no = run(cs({ bd: [sd], steps: [{ k: 'ab', src: 'b0', ai: 0, n: 'Sun Disc', pl: 'A' }] }));
    expect(no.text).toMatch(/nem követett adattól függ/);
    const ov = run(cs({ bd: [sd], steps: [play('Shipyard Skulker'), { k: 'ab', src: 'b0', ai: 0, n: 'Sun Disc', pl: 'A', cnd: { 0: '0' } }] }));
    expect(ov.text).toMatch(/nem teljesül \(a builderben így állítva\)/);
  });
  it('Renata a boardon és token létrehozás: a felület jelzi, hogy nem követett', () => {
    const x = run(cs({ bd: [{ n: 'Renata Glasc, Industrialist', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: "Desert's Call", pl: 'A' }] }));
    expect(x.text).toMatch(/nem követett: token létrehozás Renata Glasc, Industrialist a boardon van/);
    const y = run(cs({ steps: [{ k: 'card', n: "Desert's Call", pl: 'A' }] }));
    expect(y.text).not.toMatch(/nem követett: token létrehozás/);
  });
});
