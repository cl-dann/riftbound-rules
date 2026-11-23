/* Nehéz példák: minden példa betöltött állapotára az elemzés hibátlanul lefut, a lapok valósak és nincsenek a 2026-11-23-i
   tiltólistán, a hivatkozott szabályszámok léteznek, és a leírásban állított eredmény teljesül (a resolve-ok sorrendje,
   az utasítások állapota, a nem szabályos lépések száma, objektumok végállapota). */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/render/html/chainReport';
import { HARD_CATS, HARD_EXAMPLES, HARD_TIER, hardBadge } from '../src/domain/chain/hardExamples';
import { ruleText } from './util';
import { vsCard } from '../src/domain/data/store';

const BANNED = ['Riven, Broken Blade', "Zhonya's Hourglass", 'Stellacorn Herder', 'Nocturne, Horrifying', 'Rhasa the Sunderer', 'Brynhir Thundersong', 'Dazzling Aurora', 'Baited Hook', "Emperor's Dais", 'Star Spring'];
const namesOf = (cs: any): string[] => [...cs.bd.map((b: any) => b.n), ...cs.steps.filter((s: any) => s.n).map((s: any) => s.n), ...cs.bf.map((b: any) => b.fdn || b.n).filter(Boolean),
  ...['A', 'B'].flatMap((p) => [...((cs.trash || {})[p] || []), ...((cs.hand || {})[p] || []), ...((cs.deck || {})[p] || [])]).map((e: any) => (typeof e === 'string' ? e : e.n))];
const run = (cs: any) => analyze(JSON.parse(JSON.stringify(cs))) as any;

describe('Nehéz példák', () => {
  it('a S és A szintű legendek mind kapnak példát, a kategóriák és jelvények érvényesek', () => {
    const used = new Set(HARD_EXAMPLES.flatMap((e) => e.lg));
    Object.keys(HARD_TIER).forEach((lg) => expect(used.has(lg), lg).toBe(true));
    HARD_EXAMPLES.forEach((e) => { expect(HARD_CATS).toContain(e.cat); e.lg.forEach((l) => expect(hardBadge(l)).toMatch(/ · [SA]$/)); });
    expect(new Set(HARD_EXAMPLES.map((e) => e.id)).size).toBe(HARD_EXAMPLES.length);
    expect(hardBadge('Kennen, Heart of the Tempest')).toBe('Kennen · A');
  });
  it.each(HARD_EXAMPLES.map((e) => [e.id, e] as const))('%s: valós, nem tiltott lapok, létező szabályszámok, forrás, hibátlan elemzés', (_id, e) => {
    const cs = e.cs();
    namesOf(cs).concat([cs.lg.A || '', cs.lg.B || ''].filter(Boolean)).forEach((n) => { const c = vsCard(n); expect(c, n).toBeTruthy(); expect(c!.ban, n).not.toBe(1); expect(BANNED, n).not.toContain(n); });
    (e.refs + ', ' + (e.a.match(/\d{3}(?:\.\w+)+/g) || []).join(', ')).split(/,\s*/).filter(Boolean).forEach((ref) => expect(() => ruleText(ref), ref).not.toThrow());
    expect(e.src.length).toBeGreaterThan(0);
    e.src.forEach((s) => { expect(s.url).toMatch(/^https:\/\//); expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(s.deck).toBeTruthy(); });
    expect(e.flag === 2).toBe(!!e.alt);
    const r = run(cs);
    expect(r.empty).toBe(false);
    expect(r.rows.filter((x: any) => /nincs megadva/.test(x[1]))).toEqual([]);
    expect(r.rows.filter((x: any) => /Nem szabályos/.test(x[1])).length).toBe(e.expect.illegal || 0);
    expect(r.items.map((i: any) => i.name)).toEqual(e.expect.items);
    Object.entries(e.expect.res || {}).forEach(([n, v]) => expect(r.items.find((i: any) => i.name === n)!.res, n).toBe(v));
    Object.entries(e.expect.st || {}).forEach(([n, v]) => expect(r.items.find((i: any) => i.name === n)!.instr.map((x: any) => x.st), n).toEqual(v));
    const text = r.rows.map((x: any) => x.join(' ')).join('\n');
    (e.expect.has || []).forEach((h) => expect(text).toMatch(new RegExp(h)));
    if (e.expect.flag2) expect(r.rows.some((x: any) => x[2] === 2 || /nyitott kérdés/.test(x[1]))).toBe(true);
    Object.entries(e.expect.obj || {}).forEach(([id, f]) => Object.entries(f).forEach(([k, v]) => expect((r.objs[id] || {})[k], id + '.' + k).toEqual(v)));
  });
});
