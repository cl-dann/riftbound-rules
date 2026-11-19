/* Teszt segédek: helyzet (CS) építése és az elemzés eredményének lekérdezése. */
import { analyze } from '../src/legacy/chainCore';
import RULES from '../src/generated/rules.json';

export type Step = Record<string, unknown>;
export const cs = (o: { lg?: { A?: string; B?: string }; bf?: { n: string; c?: string }[]; bd?: Record<string, unknown>[]; steps: Step[]; turn?: string }) => ({
  turn: o.turn || '',
  lg: { A: '', B: '', ...(o.lg || {}) },
  bf: [...(o.bf || []), { n: '', c: '' }, { n: '', c: '' }].slice(0, 2).map((b) => ({ n: b.n, c: b.c || '' })),
  bd: (o.bd || []).map((b) => ({ d: 0, ...b })),
  steps: o.steps.map((s) => ({ tg: [], ext: {}, ...s })),
});
export const run = (x: ReturnType<typeof cs>) => {
  const r = analyze(JSON.parse(JSON.stringify(x)));
  const item = (re: RegExp) => r.items.find((i: any) => re.test(i.name));
  const zone = (id: string) => r.objs[id]?.zone;
  const ev = (k: string, f: (e: any) => boolean = () => true) => r.ev.filter((e: any) => e.k === k && f(e));
  const text = r.rows.map((x) => x.join(' ')).join('\n');
  const changes = r.frames.flatMap((f: any) => f.changes.map((c: any) => c.join(' '))).join('\n');
  return { r, item, zone, ev, text, changes, o: (id: string) => r.objs[id] };
};
/** A hivatkozott szabály és példája létezik a rules.json-ban (a teszt a hivatalos szöveghez van kötve). */
const R = new Map((RULES as any[]).map((x) => [x[0], x]));
export const exampleOf = (id: string, needle: string) => {
  const r = R.get(id);
  if (!r) throw new Error('nincs ilyen szabály: ' + id);
  const ex = (r[2] as string[]).find((e) => e.includes(needle));
  if (!ex) throw new Error(id + ': nincs "' + needle + '" példa');
  return ex;
};
export const ruleText = (id: string) => { const r = R.get(id); if (!r) throw new Error('nincs ilyen szabály: ' + id); return r[1] as string; };
