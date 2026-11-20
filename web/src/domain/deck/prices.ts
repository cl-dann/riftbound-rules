/* A Cardmarket árfájl (public/prices.json) sémája zod/mini-vel. Hibás vagy hiányos fájl esetén nincs ár (a korábbi
   viselkedés, mintha a fájl nem töltődött volna be). */
import * as z from 'zod/mini';

const num = z.nullable(z.number());
/** Egy nyomat ára: a1 és a7 a normál, f1 és f7 a foil 1 és 7 napos átlaga, s a változat jelölése. */
export const PriceRowSchema = z.looseObject({ a1: num, a7: num, f1: z.optional(num), f7: z.optional(num), id: z.number(), s: z.optional(z.nullable(z.string())) });
export const PricesSchema = z.looseObject({
  updated: z.string(),
  /** Névenként a legolcsóbb nyomat (normalizált név szerint). */
  cards: z.record(z.string(), z.looseObject({ a1: num, a7: num, id: z.number() })),
  /** Nyomatonként, kártyakód szerint. */
  pr: z.optional(z.record(z.string(), PriceRowSchema)),
  /** Különleges változatok névenként. */
  ex: z.optional(z.record(z.string(), z.array(PriceRowSchema))),
});
export type Prices = z.infer<typeof PricesSchema>;
export type PriceRow = z.infer<typeof PriceRowSchema>;

export function parsePrices(json: unknown): Prices | null {
  const r = PricesSchema.safeParse(json);
  return r.success ? (json as Prices) : null;
}
