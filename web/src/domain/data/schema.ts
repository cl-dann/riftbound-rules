/* A generált adat (web/src/generated) sémái zoddal; a típusok ebből származnak (z.infer). A sémát futásidőben csak a
   tesztek használják (unit/sema.test.ts), az app csak a típusokat importálja, így a bundle nem nő. */
import { z } from 'zod';

const str = z.string();
/** [szabályszámok vesszővel, flag (0 szabály, 1 levezetés, 2 nyitott kérdés), szöveg] */
export const NoteSchema = z.tuple([str, z.union([z.literal(0), z.literal(1), z.literal(2)]), str]);
/** [kérdés, válasz, szabályszámok] */
export const QaSchema = z.tuple([str, str, str]);
/** [kód, set kód, set név, sorszám, ritkaság, kép] */
export const PrintingSchema = z.tuple([str, str, str, str, str, str]);

export const CardSchema = z.strictObject({
  n: str, a: z.array(str), t: str, st: z.array(str), d: z.array(str), tg: z.array(str),
  e: z.number().nullable(), p: z.number().nullable(), m: z.number().nullable(),
  sets: z.array(str), code: str, rar: str, txt: str.nullable(), old: str.nullable(), err: z.number().int().nullable(),
  img: str, pr: z.array(PrintingSchema), fk: str, ch: str.nullable(), banf: str.nullable(),
  /** 0 legális, 1 tiltott Constructedben, 2 tiltott 2v2-ben */
  ban: z.number().int().min(0).max(2),
  /** [téma index a topics-ban, illeszkedő szöveg] */
  tp: z.array(z.tuple([z.number().int(), str])),
  ex: z.array(str), sh: str, nt: z.array(NoteSchema), qa: z.array(QaSchema),
  eff: str.optional(), effsrc: str.optional(),
});
/** [szabályszám, szöveg, példák] */
export const RuleSchema = z.tuple([str, str, z.array(str)]);
export const TopicSchema = z.strictObject({ k: str, title: str, g: str, refs: z.array(str), rel: z.array(str), why: str });
export const GeneralSchema = z.strictObject({ title: str, refs: z.array(str), for: str });
export const TermSchema = z.strictObject({ t: str, m: str, r: str, d: str });
export const ArticleSchema = z.strictObject({ k: str, t: str, u: str });
export const BanFutSchema = z.strictObject({ from: str, published: str, title: str, url: str, cards: z.array(str) });
export const GlossarySchema = z.strictObject({ kw: str, rule: str, kind: str, on: str, short: str, points: z.array(z.tuple([str, str])), stack: str });
export const FlowSchema = z.strictObject({ title: str, rules: str, steps: z.array(z.strictObject({ name: str, rule: str, text: str })) });
export const PatchSchema = z.strictObject({ title: str, url: str, date: str, effective: str, changes: z.array(z.strictObject({ rule: str, text: str })) });
export const GuideSchema = z.strictObject({ title: str, rules: str, paras: z.array(str), steps: z.array(z.tuple([str, str])).optional() });
export const MetaSchema = z.strictObject({
  meta: z.strictObject({ rules_updated: str, ban_updated: str, cards_snapshot: str, articles: z.array(ArticleSchema), ban: z.array(str), ban2: z.array(str), banfut: BanFutSchema }),
  topics: z.array(TopicSchema),
  general: z.array(GeneralSchema),
  extra: z.strictObject({ glossary: z.array(GlossarySchema), flow: z.array(FlowSchema), patchnotes: z.array(PatchSchema), terms: z.array(TermSchema), guide: z.array(GuideSchema) }),
});

/** A cards.json (index, a részletek helyén null) és a cards-detail.json (részletek) sémája, azonos sorrendben. */
export const CardIndexSchema = CardSchema.extend({ nt: z.null(), qa: z.null(), sh: z.null(), pr: z.null() });
export const CardDetailSchema = CardSchema.pick({ nt: true, qa: true, sh: true, pr: true });
export type CardData = z.infer<typeof CardSchema>;
/** A kártya az init() után: keresési mezőkkel és a mai napon érvénybe lépett ban jelzésével. A részletek (nt, qa, sh, pr)
    a loadDetails() után vannak kitöltve (domain/data/load.ts). */
export type Card = CardData & { _n: string; _s: string; _t: string; _kw: string[]; banNew?: 1 };
export type Rule = z.infer<typeof RuleSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type General = z.infer<typeof GeneralSchema>;
export type Term = z.infer<typeof TermSchema>;
export type MetaFile = z.infer<typeof MetaSchema>;
export type Meta = MetaFile['meta'];
export type BanFut = Meta['banfut'];
/** Az init() bemenete és a D objektum: kártyák, szabályok és a meta fájl tartalma. */
export type AppData = { cards: Card[]; rules: Rule[] } & Omit<MetaFile, 'meta'> & { meta: Meta };
