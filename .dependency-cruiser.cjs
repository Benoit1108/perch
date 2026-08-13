/**
 * Contrat d'architecture, vérifié mécaniquement.
 *
 * Les règles A1 à A7 sont décrites dans docs/ARCHITECTURE.md. Elles existent parce que
 * les conventions non vérifiées se dissolvent : au bout de quelques sprints, `core`
 * importe Electron « juste pour ce cas-là » et le portage Windows devient impossible.
 */
module.exports = {
  forbidden: [
    {
      name: 'a1-core-ignore-le-reste',
      severity: 'error',
      comment:
        'A1 — `core` ne connaît ni le corps ni le compositeur. Les DEUX écritures sont ' +
        'couvertes : le chemin relatif et le nom de paquet (`@perch/app`), qui se résout ' +
        'via un lien symbolique dans node_modules et échappait au motif de chemin.',
      from: { path: '^packages/core/' },
      to: { path: '(^packages/(app|shell)/|^@perch/(app|shell)$)' },
    },
    {
      name: 'a2-core-sans-plateforme',
      severity: 'error',
      comment:
        'A2 — `core` est pur : aucun module Node, aucun Electron. Les capacités système ' +
        'passent par un port. Les tests en sont exemptés, eux peuvent lire un manifeste.',
      from: { path: '^packages/core/', pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'a2-core-sans-electron',
      severity: 'error',
      comment: 'A2 — `core` ne dépend jamais d’Electron.',
      from: { path: '^packages/core/' },
      to: { path: '(^|/)electron(/|$)' },
    },
    {
      name: 'a3-shell-isole',
      severity: 'error',
      comment:
        "A3 — l'extension GNOME tourne dans le compositeur et ne partage aucun code : " +
        'son seul contrat avec le reste du monde est son interface D-Bus.',
      from: { path: '^packages/shell/' },
      to: { path: '(^packages/(core|app)/|^@perch/(core|app)$)' },
    },
    {
      name: 'a4-renderer-et-main-separes',
      severity: 'error',
      comment:
        'A4 — `main` et `renderer` communiquent par IPC. Un import direct compilerait ' +
        "sans erreur et casserait à l'exécution.",
      from: { path: '^packages/app/src/renderer/' },
      to: { path: '^packages/app/src/main/' },
    },
    {
      name: 'a4-main-sans-renderer',
      severity: 'error',
      comment: 'A4 — réciproque.',
      from: { path: '^packages/app/src/main/' },
      to: { path: '^packages/app/src/renderer/' },
    },
    {
      name: 'a5-aucun-cycle',
      severity: 'error',
      comment: 'A5 — aucun cycle de dépendances, nulle part.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'a6-ports-sans-dependance',
      severity: 'error',
      comment:
        'A6 (moitié sortante) — `core/ports` ne dépend de rien, pas même de zod. ' +
        "ATTENTION : cette règle n'interdit PAS d'y déposer une implémentation — " +
        'dependency-cruiser ne raisonne que sur les dépendances. Le versant « types ' +
        'seulement » est tenu par `no-restricted-syntax` dans eslint.config.js.',
      from: { path: '^packages/core/src/ports/' },
      to: { pathNot: '^packages/core/src/ports/' },
    },
    {
      name: 'a7-aucun-orphelin',
      severity: 'warn',
      comment: 'A7 — un module que rien n’atteint est du code mort en devenir.',
      from: { orphan: true, pathNot: '\\.d\\.ts$' },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage|spike)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.js', '.json'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
