# Architecture

Contrat d'architecture de `perch`. Les règles de dépendance de ce document sont
**vérifiées mécaniquement** par `dependency-cruiser` en CI — ce ne sont pas des intentions.

Voir aussi : [QUALITY.md](QUALITY.md) (outillage et portes de qualité), [../ROADMAP.md](../ROADMAP.md) (décisions et sprints).

---

## Le principe : ports et adaptateurs

Le projet doit tourner sur Wayland, X11 et Windows, avec des capacités système très
inégales. La seule façon de ne pas payer ça en complexité partout est de **concentrer
l'ignorance** : le moteur de jeu ne sait pas sur quel système il tourne, et ne peut
pas le savoir, parce qu'il n'a physiquement pas accès aux modules qui le lui diraient.

Le cœur définit des **ports** (des interfaces). Les plateformes fournissent des
**adaptateurs**. Le cœur ne connaît que les ports.

```
        ┌──────────────────────────────────────────┐
        │  core  —  le cerveau, pur, sans OS       │
        │                                          │
        │   xp/  quests/  creatures/  state/       │
        │                                          │
        │   ports/ ── SensorPort                   │
        │             StoragePort                  │
        │             ClockPort                    │
        └───────────────▲──────────────────────────┘
                        │ implémente
        ┌───────────────┴──────────────────────────┐
        │  app  —  le corps, Electron              │
        │                                          │
        │   main/  renderer/  physics/             │
        │   sensors/ gnome · x11 · win32 · null    │
        └──────────────────────────────────────────┘

        ┌──────────────────────────────────────────┐
        │  shell  —  extension GNOME (TS → GJS)    │
        │  isolée : ne connaît ni core ni app      │
        │  parle uniquement D-Bus                  │
        └──────────────────────────────────────────┘
```

`ClockPort` n'est pas de la coquetterie : l'XP se calcule sur du temps écoulé, et un
moteur qui lit l'horloge système directement n'est pas testable. Une journée simulée
de quatre heures actives doit pouvoir s'exécuter en quelques millisecondes.

---

## Les trois paquets

Monorepo npm workspaces. Trois paquets parce qu'il y a **trois cibles de build
réellement différentes** — pas pour le plaisir de découper.

| Paquet           | Runtime           | Build           | Rôle                                      |
| ---------------- | ----------------- | --------------- | ----------------------------------------- |
| `packages/core`  | Node pur          | `tsc`           | Moteur de jeu. Zéro dépendance système.   |
| `packages/app`   | Electron          | bundler         | Rendu, physique, adaptateurs de capteurs. |
| `packages/shell` | GJS (GNOME Shell) | `tsc` → ESM GJS | Extension GNOME. Capteurs seulement.      |

### `core` — le cerveau

```
core/src/
├── xp/           socle, multiplicateurs, courbe de niveaux
├── quests/       moteur de quêtes quotidiennes, profils
├── creatures/    manifeste de pack, chargeur, règles d'évolution
├── world/        surfaces marchables, zones vides, géométrie multi-écrans
├── motion/       machine à états et pesanteur du compagnon
├── state/        schémas zod, migrations, forme de l'état
└── ports/        SensorPort · StoragePort · ClockPort  (types uniquement)
```

**Interdits d'import** : `electron`, `node:fs`, `node:os`, `node:child_process`,
tout client D-Bus, toute dépendance liée à un OS. Si `core` a besoin d'une capacité
système, elle passe par un port.

### `app` — le corps

```
app/src/
├── main/         process principal Electron, cycle de vie, IPC
├── renderer/     sprite, bulles, fenêtre de réglages
├── overlay/      fenêtre transparente, géométrie, clics traversants
└── sensors/      gnome/ · x11/ · win32/ · null/   (adaptateurs de SensorPort)

La physique vit dans `core`, PAS ici (décision du 2026-08-13). Surfaces, pesanteur et
machine à états sont du calcul pur : les placer dans `app` les aurait rendues testables
uniquement à travers Electron, et les aurait soustraites au seuil de couverture de 90 %.
`app` ne garde que ce qui touche l'écran.
```

`main` et `renderer` ne s'importent **jamais** l'un l'autre — ils communiquent par IPC,
et les types partagés vivent dans `core`. Un import direct compilerait sans erreur et
casserait à l'exécution : c'est exactement le genre de faute que `dependency-cruiser` attrape.

### `shell` — l'extension GNOME

Typée avec `@girs/gnome-shell` (v50, aligné sur GNOME Shell 50.1). **Capteurs uniquement**,
conformément à l'invariant I2 : elle tourne dans le processus du compositeur, donc un bug
dedans fait tomber la session. Aucune logique de jeu n'y entre, jamais.

Elle ne dépend ni de `core` ni de `app`. Son seul contrat avec le reste du monde est
son interface D-Bus, dont le schéma est validé côté `app`.

---

## Les règles vérifiées en CI

Traduites en règles `dependency-cruiser` :

| #   | Règle                                                                                                         | Sévérité      |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------- |
| A1  | `core` n'importe rien de `app` ni de `shell`                                                                  | erreur        |
| A2  | `core` n'importe aucun module système ni `electron`                                                           | erreur        |
| A3  | `shell` n'importe ni `core` ni `app`                                                                          | erreur        |
| A4  | `app/renderer` n'importe pas `app/main`, et réciproquement                                                    | erreur        |
| A5  | Aucun cycle de dépendances, nulle part                                                                        | erreur        |
| A6  | `core/ports` ne dépend de rien (dependency-cruiser) **et** n'y déclare aucune valeur (`no-restricted-syntax`) | erreur        |
| A7  | Aucun module orphelin (non atteignable depuis un point d'entrée)                                              | avertissement |

---

## Validation aux frontières

Le typage statique s'arrête là où les données entrent dans le processus. Or `perch` lit
beaucoup de choses qu'il n'a pas écrites : `state.json` sur le disque, les charges utiles
D-Bus de l'extension, les manifestes de packs de créatures, l'état de `claude-pokemon`.

**Toute donnée franchissant une frontière est validée par un schéma zod**, et les types
TypeScript sont _inférés depuis ces schémas_ plutôt que déclarés en double.

```ts
export const CreatureManifest = z.object({/* … */});
export type CreatureManifest = z.infer<typeof CreatureManifest>;
```

C'est ce qui rend l'interdiction des assertions de type tenable : après un `parse`, le
type est garanti par une vérification à l'exécution, pas par une promesse du développeur.
Un `as` à une frontière est précisément le bug qu'on veut éviter — il affirme sans vérifier.

---

## Le pack de créatures

Décision actée : la couche créature est **interchangeable dès le départ**. Un pack est
un manifeste JSON plus un dossier de sprites, chargé à l'exécution et validé par zod.

```
packs/<id>/
├── manifest.json     identifiant, lignées, stades, niveaux d'évolution, licence
└── sprites/          frames PNG — jamais committées, téléchargées à l'installation
```

Le moteur ne connaît que la forme du manifeste, jamais le contenu du pack par défaut.
Aucun identifiant de créature n'est écrit en dur dans `core`, `app` ou `shell`.

Deux bénéfices, dont un seul est juridique : le projet survit au remplacement du pack
par défaut, et le moteur devient testable avec un pack de test à deux créatures au lieu
de dépendre du jeu réel.
