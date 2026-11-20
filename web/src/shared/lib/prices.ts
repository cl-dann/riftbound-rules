/* Az árfájl egyszer töltődik be, minden nézet ugyanazt használja. A séma (zod/mini) a fájllal együtt, lustán töltődik,
   így nem kerül a kezdő bundle-be. */
import type { Prices } from '../../domain/deck/prices';

let cache: Promise<Prices | null> | null = null;
export function loadPrices(): Promise<Prices | null> {
  if (!cache) cache = Promise.all([fetch('./prices.json').then((r) => (r.ok ? r.json() : null)), import('../../domain/deck/prices')])
    .then(([j, m]) => m.parsePrices(j)).catch(() => null);
  return cache;
}
