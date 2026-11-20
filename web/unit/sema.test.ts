/* A generált JSON megfelel-e a domain/data/schema.ts sémáinak (build-idejű ellenőrzés: a pipeline kimenete és a
   frontend típusai nem csúszhatnak el egymástól). */
import { describe, expect, it } from 'vitest';
import { CardSchema, MetaSchema, RuleSchema } from '../src/domain/data/schema';
import { z } from 'zod';
import { readFileSync } from 'node:fs';

// Közvetlenül a fájlból: a setup.ts init()-je a modulként importált kártyákat már kiegészítette (_n, _s stb.).
const load = (f: string) => JSON.parse(readFileSync('src/generated/' + f, 'utf8'));
const cards = load('cards.json'), rules = load('rules.json'), meta = load('meta.json'), formats = load('formats.json'), learn = load('learn.json');

const check = (s: z.ZodType, v: unknown) => { const r = s.safeParse(v); if (!r.success) throw new Error(z.prettifyError(r.error).slice(0, 2000)); };

describe('generált adat sémája', () => {
  it('cards.json: 1101 lap, mind a CardSchema szerint', () => { expect(cards).toHaveLength(1101); check(z.array(CardSchema), cards); });
  it('rules.json', () => { check(z.array(RuleSchema), rules); });
  it('meta.json', () => { check(MetaSchema, meta); });
  it('meta: a kártyák téma indexei léteznek', () => { const n = meta.topics.length; expect(cards.every((c: { tp: [number, string][] }) => c.tp.every((p: [number, string]) => p[0] >= 0 && p[0] < n))).toBe(true); });
  it('formats.json és learn.json szerkezete', () => {
    check(z.object({ intro: z.string(), formats: z.array(z.object({ id: z.string() }).loose()) }).loose(), formats);
    check(z.object({ chapters: z.array(z.object({ id: z.string(), title: z.string(), blocks: z.array(z.object({ type: z.string() }).loose()) }).loose()), scenarios: z.array(z.object({ id: z.string() }).loose()) }), learn);
  });
});
