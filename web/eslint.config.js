// ESLint a web/src-re: typescript-eslint recommended, react-hooks (rules-of-hooks hiba, exhaustive-deps figyelmeztetés).
// A csomagok a lint/ alatt vannak (a typescript-eslint a TypeScript 6 JS API-ját kéri, a build TypeScript 7). Futtatás: npm run lint
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const req = createRequire(new URL('./lint/package.json', import.meta.url));
const load = async (m) => (await import(pathToFileURL(req.resolve(m)).href)).default;
const js = await load('@eslint/js');
const tseslint = await load('typescript-eslint');
const reactHooks = await load('eslint-plugin-react-hooks');
const globals = await load('globals');

export default tseslint.config(
  { ignores: ['dist/**', 'dist-single/**', 'src/generated/**', 'lint/**', 'node_modules/**', 'test-results/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
