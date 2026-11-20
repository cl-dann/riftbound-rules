/* A régi és mai hash linkek nézete (router.ts viewOf). */
import { expect, it } from 'vitest';
import { viewOf } from '../../src/app/router';

const TABLE: [string, string][] = [
  ['', 'kartyak'], ['#', 'kartyak'], ['#kartyak', 'kartyak'], ['#ismeretlen', 'kartyak'], ['#deck', 'deck'], ['#d=TGVnZW5kOg', 'deck'],
  ['#szabalyok', 'szabalyok'], ['#r-103.2', 'szabalyok'], ['#r-359.3.e.6', 'szabalyok'], ['#fmt-duel', 'szabalyok'], ['#fmt-ffa4', 'szabalyok'],
  ['#chain', 'chain'], ['#c=eyJsZyI6e319', 'chain'], ['#hogyan', 'hogyan'], ['#hogyan/3', 'hogyan'], ['#tud-guide', 'hogyan'], ['#tud-guide-2', 'hogyan'],
  ['#tanulas', 'tanulas'], ['#tanulas/lecke', 'tanulas'], ['#tanulas/lecke/2', 'tanulas'], ['#kezikonyv', 'kezikonyv'], ['#tudastar', 'kezikonyv'],
  ['#tud-kw', 'kezikonyv'], ['#tud-errata', 'kezikonyv'],
];

it.each(TABLE)('viewOf(%j) = %s', (h, v) => { expect(viewOf(h)).toBe(v); });
