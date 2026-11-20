/* A Chain helyzet (CS) sémája zod/mini-vel: ez a #c= link és a builder állapota. A kulcsok fagyasztottak
   (lg, bf, bd, steps, k, tg, ext, zp, hv, mp, ps, hand, ch, zseq), az ismeretlen kulcsok megmaradnak (loose),
   így a régi linkek és a későbbi mezők is átmennek. A típusok ebből származnak. */
import * as z from 'zod/mini';

const str = z.string();
/** Kéz, trash vagy deck lapja: állandó azonosítóval, vagy a régi, névlistás formában (normZones alakítja át). */
export const ZoneEntrySchema = z.union([str, z.looseObject({ id: z.optional(str), n: str })]);
export const ZonesSchema = z.looseObject({ A: z.optional(z.array(ZoneEntrySchema)), B: z.optional(z.array(ZoneEntrySchema)) });
/** Egy lépés: k = card (kijátszás), ab (ability), tg (trigger), tr (combat utáni trigger), res (Resolve), end (Kör vége). */
export const StepSchema = z.looseObject({
  k: str, n: z.optional(str), pl: z.optional(z.enum(['A', 'B'])), from: z.optional(str), loc: z.optional(str),
  tg: z.optional(z.array(str)), ext: z.optional(z.record(str, z.unknown())), zp: z.optional(z.record(str, z.array(str))),
  src: z.optional(str), so: z.optional(str), costTg: z.optional(str), ti: z.optional(z.number()),
});
/** A kiinduló pálya egy lapja (unit, gear): n név, pl játékos, loc hely (base, bf0, bf1), on felszerelve erre (bd index),
    m kézzel megadott Might, atk combat jelölés (a attacker, d defender). */
export const BoardEntrySchema = z.looseObject({ n: str, pl: z.enum(['A', 'B']), loc: str, d: z.optional(z.number()), on: z.optional(z.nullable(z.number())), m: z.optional(z.nullable(z.number())), atk: z.optional(str) });
/** Battlefield: n név, c kontroll (A, B vagy üres), fd és fdn a facedown lap gazdája és neve. */
export const BattlefieldSchema = z.looseObject({ n: str, c: z.optional(str), fd: z.optional(str), fdn: z.optional(z.nullable(str)) });
export const ChainStateSchema = z.looseObject({
  lg: z.looseObject({ A: z.optional(str), B: z.optional(str) }),
  bf: z.array(BattlefieldSchema),
  bd: z.array(BoardEntrySchema),
  steps: z.array(StepSchema),
  turn: z.optional(str),
  hand: z.optional(ZonesSchema), trash: z.optional(ZonesSchema), deck: z.optional(ZonesSchema),
  ch: z.optional(z.looseObject({ A: z.optional(str), B: z.optional(str) })),
  zseq: z.optional(z.number()),
});
export type ZoneEntry = z.infer<typeof ZoneEntrySchema>;
export type Step = z.infer<typeof StepSchema>;
export type BoardEntry = z.infer<typeof BoardEntrySchema>;
export type ChainState = z.infer<typeof ChainStateSchema>;
