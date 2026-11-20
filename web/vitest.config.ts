import { defineConfig } from 'vitest/config';

// Unit tesztek: a DOM nélküli chain elemző (chainCore.ts) és a combat kiosztás (combatCore.ts). Futtatás: npm run test:unit
// A golden (karakterizációs) tesztek rögzített dátummal futnak (unit/golden/clock.ts), a kimenetük a unit/golden/__golden__ alatt.
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['unit/*.test.ts'], setupFiles: ['unit/setup.ts'], environment: 'node' } },
      { test: { name: 'golden', include: ['unit/golden/*.test.ts'], benchmark: { include: [] }, setupFiles: ['unit/golden/clock.ts', 'unit/setup.ts'], environment: 'node' } },
    ],
  },
});
