/* Cardmarket ártörténet (public/price-history.json, a tools/prices/history.py írja): nyomatonként a normál (n) és a foil (f)
   ár euró centben, delta kódolva. Hibás vagy hiányos fájl esetén nincs diagram. */
import * as z from 'zod/mini';
import type { PriceHistory } from './historyData';

const ser = z.array(z.nullable(z.number()));
export const HistorySchema = z.looseObject({ v: z.number(), d: z.array(z.string()), s: z.record(z.string(), z.looseObject({ n: ser, f: ser })) });

export function parseHistory(json: unknown): PriceHistory | null {
  return HistorySchema.safeParse(json).success ? (json as PriceHistory) : null;
}
