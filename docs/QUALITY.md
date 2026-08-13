# Charte qualité

Tout ce qui devient un chantier quand le projet est gros est mis en place **avant** qu'il
le soit. Ce fichier définit l'outillage, les règles et les portes de qualité de `perch`.

Voir aussi : [ARCHITECTURE.md](ARCHITECTURE.md) (contrat de dépendances), [../ROADMAP.md](../ROADMAP.md) (décisions et sprints).

---

## Outillage

| Rôle                       | Outil                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| Analyse statique           | `tsc --noEmit` en strict maximal + `typescript-eslint` en mode _type-checked_ |
| Formatage                  | Prettier                                                                      |
| Règles de code             | ESLint                                                                        |
| **Couches et dépendances** | **dependency-cruiser**                                                        |
| Tests unitaires            | Vitest                                                                        |
| Couverture                 | Vitest + v8, seuils bloquants                                                 |
| Tests e2e                  | Playwright (support Electron natif)                                           |
| Mises à jour               | Dependabot                                                                    |
| Convention de commit       | commitlint + Conventional Commits                                             |
| Code mort                  | Knip                                                                          |
| Validation à l'exécution   | zod                                                                           |
| Durcissement               | `@electron/fuses`                                                             |

`dependency-cruiser` est l'outil qui compte le plus dans ce tableau : c'est le seul qui
empêche l'architecture de se dissoudre au fil des sprints. Les règles qu'il applique sont
dans [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Règles de code

### Typage

`tsconfig.json` en strict maximal, dès le premier fichier :

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true, // tab[i] est T | undefined
  "exactOptionalPropertyTypes": true, // { a?: string } ≠ { a: string | undefined }
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "noPropertyAccessFromIndexSignature": true,
  "verbatimModuleSyntax": true,
}
```

Ces options se mettent au démarrage ou jamais. `noUncheckedIndexedAccess` activé sur un
projet mûr produit des centaines d'erreurs et finit désactivé ; activé sur un projet vide,
il ne coûte rien et attrape une classe entière de bugs.

### Interdits

| Règle ESLint                                    | Effet                                     |
| ----------------------------------------------- | ----------------------------------------- |
| `@typescript-eslint/no-explicit-any`            | `any` interdit                            |
| `@typescript-eslint/no-unsafe-*`                | interdit de propager une valeur non typée |
| `@typescript-eslint/consistent-type-assertions` | assertions de type interdites             |
| `max-lines` (200, hors blancs et commentaires)  | aucun fichier au-delà de 200 lignes       |
| `max-lines-per-function` (60)                   | corollaire du précédent                   |
| `complexity` (12)                               | garde-fou sur la complexité cyclomatique  |

**Sur l'interdiction de `as`** : `as const` reste légitime et devra probablement être
autorisé explicitement — à confirmer au moment du réglage, le comportement de la règle
dépend de sa version. Pour le reste, l'échappatoire n'est pas de désactiver la règle mais
d'écrire un `// eslint-disable-next-line` **avec une justification en commentaire**. Une
exception visible en revue vaut infiniment mieux qu'une exception invisible : si le projet
en accumule, c'est un signal, pas un détail.

Le vrai moyen de ne pas avoir besoin d'assertions reste la validation zod aux frontières,
décrite dans [ARCHITECTURE.md](ARCHITECTURE.md).

### Découpage

La limite de 200 lignes n'est pas esthétique : c'est ce qui force à séparer les
responsabilités pendant qu'on écrit, plutôt qu'au moment du refactoring. Un fichier qui
la dépasse est un fichier qui fait deux choses.

---

## Couverture

Des seuils bloquants, différenciés par paquet, et **à cliquet** : ils montent, ils ne
redescendent jamais. Baisser un seuil est une décision explicite qui s'inscrit dans
`ROADMAP.md`, pas un ajustement pour faire passer la CI.

| Paquet  | Lignes | Branches | Pourquoi                                                        |
| ------- | ------ | -------- | --------------------------------------------------------------- |
| `core`  | 90 %   | 85 %     | Logique pure, injectée par ports : rien n'empêche de la tester  |
| `app`   | 60 %   | 50 %     | Electron et rendu, couverts surtout par l'e2e                   |
| `shell` | —      | —        | Volontairement trop mince pour mériter des tests (invariant I2) |

---

## Portes de qualité

Une seule commande rassemble tout :

```bash
npm run health
```

Elle enchaîne, dans cet ordre, en s'arrêtant à la première erreur :

1. `format:check` — Prettier
2. `lint` — ESLint, zéro avertissement toléré
3. `typecheck` — `tsc --noEmit` sur les trois paquets
4. `deps` — dependency-cruiser, règles A1 à A7
5. `dead` — Knip, ni fichier ni export ni dépendance inutilisés
6. `test` — Vitest avec les seuils de couverture
7. `e2e` — Playwright (hors `--quick`)

### Hook pre-push

Un hook Claude Code dans `.claude/hooks/pre-push.sh` lance `npm run health` avant tout
push. **Pas de husky** : `claude-pokemon` a appris à ses dépens que son cycle `prepare`
casse `npm ci` dans un workspace en CI.

### Intégration continue

Les mêmes étapes en GitHub Actions, plus : `npm audit`, un build de paquet sur les deux
OS, et Dependabot en hebdomadaire.

---

## Ce que veut dire « 10/10 » à la fin d'un sprint

Un sprint n'est pas fini parce que la fonctionnalité marche. Il est fini quand :

- [ ] `npm run health` passe intégralement
- [ ] la **définition de fini** du sprint dans `ROADMAP.md` est vérifiée
- [ ] l'agent `code-reviewer` a tourné sur le diff et n'a plus de remarque ouverte
- [ ] les seuils de couverture ont été relevés si le sprint les a dépassés
- [ ] `CHANGELOG.md` a son entrée dans `[Unreleased]`
- [ ] toute décision prise en cours de route est inscrite dans `ROADMAP.md`
- [ ] aucun `eslint-disable` ajouté sans justification écrite

Le dernier point est le baromètre de dette technique du projet. Sur un projet neuf, le
compte doit rester proche de zéro ; s'il grimpe, c'est que l'architecture résiste et
qu'il faut la corriger plutôt que la contourner.

---

## Sécurité Electron

Non négociable dès le premier sprint, parce que ce sont des réglages qu'on ne rétro-applique
pas facilement : isolation du contexte activée, intégration Node désactivée dans le
`renderer`, `sandbox` activé, IPC uniquement par canaux nommés et validés zod, aucun
chargement de contenu distant, et `@electron/fuses` au moment du packaging.

---

## Conventions

Héritées de `claude-pokemon`, qui a payé pour les apprendre :

- **Commits** : Conventional Commits, vérifiés par commitlint
- **Pas de `Co-Authored-By`**
- **Pas de push sans validation explicite**
- **Branches de fonctionnalité**, historique linéaire, rebase-merge
- **CHANGELOG** au format Keep a Changelog, une entrée par PR
- **i18n dès le premier texte** : aucune chaîne d'interface en dur (invariant I8)
- **Thème clair et sombre** dès la première fenêtre, par jetons CSS
