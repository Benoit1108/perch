import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],

    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        // Barils de réexport : aucune logique à couvrir.
        'packages/core/src/index.ts',
        'packages/core/src/ports/**',
        // Point d'entrée Electron : couvert par les tests e2e, pas unitairement.
        'packages/app/src/main/index.ts',
        // L'extension GNOME est volontairement trop mince pour mériter des tests (I2),
        // et ne peut de toute façon tourner que dans le compositeur.
        'packages/shell/**',
      ],

      // Seuils À CLIQUET : ils montent, ils ne redescendent jamais. Les baisser est une
      // décision explicite qui s'inscrit dans ROADMAP.md, pas un ajustement pour faire
      // passer la CI.
      thresholds: {
        'packages/core/src/**': {
          lines: 90,
          branches: 85,
          functions: 90,
          statements: 90,
        },
        'packages/app/src/**': {
          lines: 60,
          branches: 50,
          functions: 60,
          statements: 60,
        },
      },
    },
  },
});
