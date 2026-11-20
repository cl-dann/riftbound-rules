/* Függőségi szabályok a web/src-re (dependency-cruiser). Irány: domain -> semmi (csak domain és a generált adat),
   render -> domain, shared -> domain és render, features -> shared, render, domain (másik feature nem), app -> bármi.
   A mai sértések a known-violations.json-ban (npm run lint:deps:baseline), új sértés hiba. */
const LAYER = (name, from, to, comment) => ({ name, severity: 'error', comment, from: { path: from }, to: { path: to } });
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', comment: 'Körkörös import', from: {}, to: { circular: true } },
    LAYER('domain-only-domain', '^src/domain/', '^src/(app|features|shared|render|styles)/', 'A domain csak domaint és a generált adatot importál'),
    { name: 'domain-no-react', severity: 'error', comment: 'A domain React nélküli', from: { path: '^src/domain/' }, to: { path: '(^|/)node_modules/(react|react-dom|lucide-react|@radix-ui)/' } },
    LAYER('render-no-ui', '^src/render/', '^src/(app|features|shared)/', 'A render (HTML string) csak domaint importál'),
    LAYER('shared-no-feature', '^src/shared/', '^src/(app|features)/', 'A shared nem importál feature-t vagy appot'),
    { name: 'feature-no-other-feature', severity: 'error', comment: 'Egy feature nem importál másik feature-t (közös rész a shared alá)',
      from: { path: '^src/features/([^/]+)/' }, to: { path: '^src/features/', pathNot: '^src/features/$1/' } },
    LAYER('feature-no-app', '^src/features/', '^src/app/', 'Feature nem importál az app rétegből'),
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/generated/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.json'] },
  },
};
