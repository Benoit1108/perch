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
          // Pas de `**` ici : typescript-eslint le refuse, pour éviter qu'un glob trop
          // large rattache tout le dépôt au projet implicite.
          allowDefaultProject: ['*.ts', '*.js', '*.cjs', 'packages/shell/scripts/*.mjs'],
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

  // ── Invariant I3 : `core` ne doit rien savoir du système ────────────────────────
  // `dependency-cruiser` ne voit que les IMPORTS. Or les globales de Node ne s'importent
  // pas : `process.platform` dans `core` passait toutes les portes sans être détecté.
  // Ces règles ferment ce trou. Les tests en sont exemptés — ils lisent légitimement un
  // manifeste sur disque.
  {
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'core ignore le système : passer par un port (voir docs/ARCHITECTURE.md).',
        },
        { name: 'Buffer', message: 'core ignore le système : passer par un port.' },
        { name: '__dirname', message: 'core ignore le système de fichiers.' },
        { name: '__filename', message: 'core ignore le système de fichiers.' },
        { name: 'global', message: 'core ignore son environnement d’exécution.' },
      ],
    },
  },

  // ── Règle A6 : `core/ports` ne contient QUE des types ───────────────────────────
  // `dependency-cruiser` ne sait interdire que des dépendances sortantes, pas la présence
  // d'une implémentation. Une classe déposée dans `ports/` n'y déclenchait qu'un
  // avertissement d'orphelin — sans effet sur le code de sortie.
  {
    files: ['packages/core/src/ports/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration',
          message: 'ports/ ne contient que des types : pas de classe.',
        },
        {
          selector: 'FunctionDeclaration',
          message: 'ports/ ne contient que des types : pas de fonction.',
        },
        {
          selector: 'VariableDeclaration',
          message: 'ports/ ne contient que des types : pas de valeur.',
        },
        {
          selector: 'TSEnumDeclaration',
          message: 'ports/ ne contient que des types : une enum génère du code.',
        },
      ],
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

  // Scripts de build en ESM Node. Ils n'appartiennent à aucun tsconfig — les analyser en
  // mode typé n'apporterait rien, faute de types Node dans le projet implicite.
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
    extends: [tseslint.configs.disableTypeChecked],
  },
]);
