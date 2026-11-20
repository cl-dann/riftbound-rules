/* Tulajdonság-alapú invariánsok (fast-check, 100 futás tesztenként). A seed a teszt nevében és a konzolon látszik;
   egy hiba reprodukálása: FC_SEED=<seed> npx vitest run unit/invariansok.test.ts */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/render/html/chainReport';
import { EXAMPLES, normZones, reorderSteps } from '../src/features/chain/legacyForm';
import { TEMPLATES } from '../src/domain/chain/templates';
import { insertAt } from '../src/features/chain/chainBuild';
import { CARDS } from '../src/domain/data/store';
import { b64d, b64e } from '../src/domain/text/b64';
import CASES from './golden/cases.json';

const seed = process.env.FC_SEED ? +process.env.FC_SEED : (Date.now() ^ (Math.random() * 0x7fffffff)) | 0;
console.log('fast-check seed:', seed);
const OPT = { numRuns: 100, seed };
const clone = (x: any) => JSON.parse(JSON.stringify(x));
const STATES: any[] = [...TEMPLATES.map((t) => t.cs()), ...Object.values(EXAMPLES).map((f: any) => f()), ...(CASES as any[])];
const anyState = fc.constantFrom(...STATES).map(clone);
const withSteps = fc.constantFrom(...STATES.filter((s) => s.steps.length > 1)).map(clone);

/** A lépések közti hivatkozások (célpont, költség, forrás) mind visszafelé mutatnak-e, a reorderSteps szabálya szerint. */
const refsOk = (cs: any) => cs.steps.every((s: any, j: number) => [...(s.tg || []), s.costTg, s.src, s.so].every((v: any) => { const m = /^s(\d+)$/.exec(v || ''); return !m || +m[1] <= j; }));
const ident = (cs: any) => { const c = clone(cs); reorderSteps(c, [...c.steps.keys()]); return c; };

describe('invariánsok, seed=' + seed, () => {
  it('analyze determinisztikus és nem módosítja a bemenetét', () => {
    fc.assert(fc.property(anyState, (cs) => {
      const before = JSON.stringify(cs);
      const a = JSON.stringify(analyze(cs));
      expect(JSON.stringify(cs)).toBe(before);
      expect(JSON.stringify(analyze(clone(cs)))).toBe(a);
    }), OPT);
  });

  it('reorderSteps, majd az inverze: identitás (ha a sorrend a hivatkozásokat nem fordítja meg)', () => {
    const refs = (st: any) => [...(st.tg || []), st.costTg, st.src, st.so].map((v: any) => /^s(\d+)$/.exec(v || '')).filter(Boolean).map((m: any) => +m[1]);
    fc.assert(fc.property(withSteps.chain((cs) => fc.tuple(fc.constant(cs), fc.shuffledSubarray([...cs.steps.keys()], { minLength: cs.steps.length, maxLength: cs.steps.length }))), ([cs, perm]) => {
      const base = ident(cs);
      const newOf: number[] = []; perm.forEach((o, ni) => { newOf[o] = ni; });
      // csak az a sorrend számít, amelyben minden hivatkozott lépés a hivatkozó előtt marad (különben a reorderSteps törli a hivatkozást)
      fc.pre(refsOk(base) && base.steps.every((st: any, j: number) => refs(st).every((t) => newOf[t] <= newOf[j])));
      const c = clone(base); reorderSteps(c, perm);
      reorderSteps(c, newOf);
      expect(c).toEqual(base);
    }), OPT);
  });

  it('insertAt, majd a beszúrt lépés törlése: identitás', () => {
    fc.assert(fc.property(anyState.chain((cs) => fc.tuple(fc.constant(cs), fc.nat({ max: cs.steps.length }))), ([cs, k]) => {
      const base = ident(cs);
      const c = clone(base);
      insertAt(c, k, { k: 'card', n: 'Flash', pl: 'A', from: 'hand', tg: [], ext: {} });
      expect(c.steps[k].n).toBe('Flash');
      reorderSteps(c, [...c.steps.keys()].filter((x) => x !== k));
      expect(c).toEqual(base);
    }), OPT);
  });

  it('normZones idempotens', () => {
    fc.assert(fc.property(anyState, (cs) => {
      const once = normZones(clone(cs));
      expect(normZones(clone(once))).toEqual(once);
    }), OPT);
  });

  it('b64e és b64d: oda-vissza azonos, unicode szövegre is', () => {
    fc.assert(fc.property(fc.string({ unit: 'grapheme', maxLength: 200 }), (s) => { expect(b64d(b64e(s))).toBe(s); }), OPT);
  });

  it('frame-enként egyedi unit azonosító (data-uid)', () => {
    fc.assert(fc.property(anyState, (cs) => {
      for (const f of analyze(cs).frames as any[]) {
        const b = f.board;
        const ids = [b.me.base, b.opp.base, ...b.bfs.flatMap((x: any) => [x.me, x.opp])].flatMap((l: any) => (l || []).map((u: any) => u.id)).filter(Boolean);
        expect(new Set(ids).size, f.label).toBe(ids.length);
      }
    }), OPT);
  });

  it('mutált sablon helyzeten az elemzés nem dob kivételt', () => {
    const names = (CARDS as any[]).filter((c) => ['Unit', 'Spell', 'Gear'].includes(c.t)).map((c) => c.n);
    const REF = ['', 'b0', 'b1', 'b2', 'b9', 's0', 's1', 's5', 'x', 'bf0', 'zhA0', 'ztB_3'];
    const mut = fc.oneof(
      fc.record({ op: fc.constant('drop'), i: fc.nat(9) }),
      fc.record({ op: fc.constant('tg'), i: fc.nat(9), ti: fc.nat(3), v: fc.constantFrom(...REF) }),
      fc.record({ op: fc.constant('pl'), i: fc.nat(9), v: fc.constantFrom('A', 'B', '') }),
      fc.record({ op: fc.constant('loc'), i: fc.nat(9), v: fc.constantFrom('base', 'bf0', 'bf1', 'bf7', '') }),
      fc.record({ op: fc.constant('card'), i: fc.nat(9), v: fc.constantFrom(...names) }),
      fc.record({ op: fc.constant('res'), i: fc.nat(9) }),
      fc.record({ op: fc.constant('turn'), v: fc.constantFrom('A', 'B', '') }),
      fc.record({ op: fc.constant('bdname'), i: fc.nat(9), v: fc.constantFrom(...names) }),
    );
    const tpl = fc.constantFrom(...TEMPLATES, ...Object.values(EXAMPLES).map((f: any) => ({ cs: f })));
    fc.assert(fc.property(tpl, fc.array(mut, { minLength: 1, maxLength: 6 }), (t: any, ms: any[]) => {
      const cs = clone(t.cs());
      for (const m of ms) {
        const st = cs.steps.length ? cs.steps[m.i % cs.steps.length] : null; const bd = cs.bd.length ? cs.bd[m.i % cs.bd.length] : null;
        if (m.op === 'drop' && st) reorderSteps(cs, [...cs.steps.keys()].filter((x) => x !== m.i % cs.steps.length));
        else if (m.op === 'tg' && st) { st.tg = [...(st.tg || [])]; st.tg[m.ti] = m.v; }
        else if (m.op === 'pl' && st) st.pl = m.v;
        else if (m.op === 'loc' && bd) bd.loc = m.v;
        else if (m.op === 'card') cs.steps.push({ k: 'card', n: m.v, pl: m.i % 2 ? 'B' : 'A', from: 'hand', tg: [], ext: {} });
        else if (m.op === 'res') cs.steps.push({ k: 'res' });
        else if (m.op === 'turn') cs.turn = m.v;
        else if (m.op === 'bdname' && bd) bd.n = m.v;
      }
      expect(() => analyze(cs)).not.toThrow();
    }), OPT);
  });
});
