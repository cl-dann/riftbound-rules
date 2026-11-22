/* Az árfájl egyszer töltődik be, minden nézet ugyanazt használja. A séma (zod/mini) a fájllal együtt, lustán töltődik,
   így nem kerül a kezdő bundle-be. */
import type { Prices } from '../../domain/deck/prices';
import type { PriceHistory } from '../../domain/deck/historyData';

let cache: Promise<Prices | null> | null = null;
export function loadPrices(): Promise<Prices | null> {
  if (!cache) cache = Promise.all([fetch('./prices.json').then((r) => (r.ok ? r.json() : null)), import('../../domain/deck/prices')])
    .then(([j, m]) => m.parsePrices(j)).catch(() => null);
  return cache;
}

let hcache: Promise<PriceHistory | null> | null = null;
/** Az ártörténet csak a kártya-ablakban kell, ezért külön, első használatkor töltődik. */
export function loadHistory(): Promise<PriceHistory | null> {
  if (!hcache) hcache = Promise.all([fetch('./price-history.json').then((r) => (r.ok ? r.json() : null)), import('../../domain/deck/history')])
    .then(([j, m]) => m.parseHistory(j)).catch(() => null);
  return hcache;
}
