import { defineConfig } from 'vitest/config';

// Unit tesztek: a DOM nélküli chain elemző (chainCore.ts) és a combat kiosztás (combatCore.ts). Futtatás: npm run test:unit
export default defineConfig({
  test: { include: ['unit/**/*.test.ts'], setupFiles: ['unit/setup.ts'], environment: 'node' },
});
