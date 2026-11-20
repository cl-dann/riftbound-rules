/* Típusos eseménybusz a window CustomEvent-jei fölött. A nevek és a detail ugyanazok, mint korábban,
   így a még közvetlenül figyelő kód (és a tesztek) változatlanul működik. */
export type RbEvents = {
  /** Kártyalap megnyitása a modálban, detail: kártyanév. */
  'rb:open-card': string;
  /** Kártyakeresés indítása a Kártyák fülön (a lapszövegben is), detail: keresőszó. */
  'rb:card-search': string;
  /** A fogalom-tooltip elrejtése. */
  'rb:hide-tip': undefined;
};
type Args<K extends keyof RbEvents> = RbEvents[K] extends undefined ? [] : [detail: RbEvents[K]];

export function emit<K extends keyof RbEvents>(name: K, ...a: Args<K>): void {
  window.dispatchEvent(a.length ? new CustomEvent(name, { detail: a[0] }) : new Event(name));
}

/** Feliratkozás; a visszaadott függvény leiratkoztat (effect cleanup). */
export function on<K extends keyof RbEvents>(name: K, fn: (detail: RbEvents[K]) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent).detail as RbEvents[K]);
  window.addEventListener(name, h);
  return () => window.removeEventListener(name, h);
}

export const openCard = (n: string) => emit('rb:open-card', n);
