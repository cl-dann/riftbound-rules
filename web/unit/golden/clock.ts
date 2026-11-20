/* A golden tesztek rögzített dátummal futnak: a core.ts betöltéskor olvassa a mai napot (TODAY), és ettől függ
   a jövőbeli ban (banf) érvénybe lépése. Ez a fájl a unit/setup.ts előtt fut. */
import { vi } from 'vitest';

vi.useFakeTimers({ now: new Date('2026-11-20T12:00:00Z'), toFake: ['Date'] });
