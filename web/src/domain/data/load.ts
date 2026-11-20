import { init } from './store';

/** Az adat külön chunkokban töltődik (cards, rules, meta), így az app héja azonnal megjelenik. */
export async function loadData() {
  const [cards, rules, meta] = await Promise.all([
    import('../../generated/cards.json').then((m) => m.default),
    import('../../generated/rules.json').then((m) => m.default),
    import('../../generated/meta.json').then((m) => m.default),
  ]);
  const D = { cards, rules, ...(meta as Record<string, unknown>) };
  init(D);
  return D;
}

/** A Tanulás modul tartalma csak a nézet megnyitásakor töltődik be. */
export const loadLearn = () => import('../../generated/learn.json').then((m) => m.default as any);

/** A PDF fontjai csak a PDF készítésekor töltődnek be. */
export const loadFonts = () => import('../../generated/fonts.json').then((m) => m.default);
