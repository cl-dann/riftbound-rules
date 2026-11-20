/* Függőségi szabályok a web/src-re (dependency-cruiser). A mai sértések a known-violations.json-ban vannak
   (baseline: npm run lint:deps:baseline), új sértés hiba. A célirány: domain -> semmi, render -> domain,
   shared -> domain és render, features -> shared, render, domain (másik feature nem), app -> bármi. */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', comment: 'Körkörös import', from: {}, to: { circular: true } },
    {
      name: 'logic-no-ui', severity: 'error', comment: 'A DOM és React nélküli logika (chainCore, combatCore, practiceEngine, chainBuild) nem importál nézetet vagy komponenst',
      from: { path: '^src/(legacy/chainCore|components/(combatCore|practiceEngine|chainBuild))\\.ts$' },
      to: { path: '^src/(views|components)/.+\\.tsx$' },
    },
    {
      name: 'logic-no-dom-module', severity: 'error', comment: 'A DOM nélküli logika nem függ a DOM-os legacy chain.ts-től',
      from: { path: '^src/(legacy/chainCore|components/(combatCore|practiceEngine|chainBuild))\\.ts$' },
      to: { path: '^src/legacy/chain\\.ts$' },
    },
    {
      name: 'legacy-no-react', severity: 'error', comment: 'A legacy modulok nem importálnak React nézetet vagy komponenst',
      from: { path: '^src/legacy/' },
      to: { path: '^src/(views|components)/' },
    },
    {
      name: 'view-no-other-view', severity: 'error', comment: 'Egy nézet nem importál másik nézetet (közös rész a components alá)',
      from: { path: '^src/views/([^/]+)\\.tsx?$' },
      to: { path: '^src/views/[A-Za-z]+View\\.tsx$', pathNot: '^src/views/$1\\.tsx?$' },
    },
    {
      name: 'component-no-view', severity: 'error', comment: 'Komponens nem importál nézetet',
      from: { path: '^src/components/' },
      to: { path: '^src/views/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/generated/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.json'] },
  },
};
