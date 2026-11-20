import type { Card } from '../data/schema';

/** Egy decklista sor: darabszám, a beírt név, a felismert lap (vagy null) és javaslatok elgépelésnél. */
export type DeckRow = { qty: number; name: string; card: Card | null; sug: Card[] };
export type DeckSection = { name: string; rows: DeckRow[] };
/** Felismert lappal rendelkező sor (a legalitás ezekkel számol). */
export type CardRow = DeckRow & { card: Card };
/** [rendben? (false hiba, null tájékoztatás, egyébként igaz értékű), szabályszám, szöveg] */
export type DeckCheck = [unknown, string, string];
