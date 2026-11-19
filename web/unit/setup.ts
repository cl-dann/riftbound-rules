/* A generált adat (cards.json, rules.json, meta.json) betöltése, ugyanúgy, mint a böngészőben a data.ts. */
import { init } from '../src/legacy/core';
import cards from '../src/generated/cards.json';
import rules from '../src/generated/rules.json';
import meta from '../src/generated/meta.json';

init({ cards, rules, ...(meta as Record<string, unknown>) });
