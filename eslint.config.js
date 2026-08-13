import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/**', '**/coverage/**', '**/node_modules/**', 'spike/**']),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // Les fichiers de configuration de la racine n'appartiennent à aucun paquet, donc
        // à aucun tsconfig. On les rattache au projet implicite plutôt que de les exclure
        // du lint : un `vitest.config.ts` non linté est exactement le fichier où une faute
        // passe inaperçue.
        //
        // `tsconfigRootDir` est volontairement omis. Sa valeur par défaut est le répertoire
        // courant, ce qui est correct puisque le lint passe toujours par `npm run lint`
        // depuis la racine. Le renseigner obligerait à lire `import.meta.dirname`, non typé
        // dans le projet implicite — donc à écrire une assertion, que la charte interdit.
        projectService: {
          allowDefaultProject: ['*.ts', '*.js', '*.cjs'],
        },
      },
    },

    rules: {
      // ── Typage fort ────────────────────────────────────────────────────────────
      // `any` et les assertions de type sont les deux façons de mentir au compilateur.
      // La validation zod aux frontières rend cette interdiction tenable : après un
      // `parse`, le type est garanti à l'exécution, pas promis par le développeur.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],

      // ── Découpage ──────────────────────────────────────────────────────────────
      // 200 lignes n'est pas une règle esthétique : c'est ce qui force à séparer les
      // responsabilités pendant qu'on écrit, plutôt qu'au moment du refactoring.
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 12],

      // ── Divers ─────────────────────────────────────────────────────────────────
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
    },
  },

  // L'extension GNOME tourne sous GJS : les méthodes exposées sur D-Bus sont appelées
  // par le runtime du compositeur, pas par notre code.
  {
    files: ['packages/shell/**/*.ts'],
    rules: {
      '@typescript-eslint/class-methods-use-this': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },

  // Les tests décrivent des cas, pas des responsabilités : les limites de taille y
  // seraient contre-productives et pousseraient à en écrire moins.
  {
    files: ['**/*.test.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },

  // `.dependency-cruiser.cjs` est en CommonJS : `module` et `require` y sont légitimes.
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    extends: [tseslint.configs.disableTypeChecked],
  },
]);
