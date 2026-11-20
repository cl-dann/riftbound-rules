/* A generált adat (cards.json, cards-detail.json, rules.json, meta.json) betöltése, ugyanúgy, mint a böngészőben a
   domain/data/load.ts (a részletek a kártyákba olvadnak, mint a loadDetails() után). */
import { init, mergeDetails } from '../src/domain/data/store';
import cards from '../src/generated/cards.json';
import details from '../src/generated/cards-detail.json';
import rules from '../src/generated/rules.json';
import meta from '../src/generated/meta.json';

init({ cards, rules, ...(meta as Record<string, unknown>) });
mergeDetails(details as never[]);
