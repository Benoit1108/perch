# Perch — Roadmap

Compagnon pixelisé qui vit sur le bureau : il se perche au bord des fenêtres, suit la souris,
et gagne de l'XP selon la façon dont on utilise sa machine. Linux + Windows, dev **et** non-dev.

| Document                                                                                | Contenu                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **ROADMAP.md** (ici)                                                                    | Décisions, invariants, sprints                         |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                                            | Couches, paquets, règles de dépendance vérifiées en CI |
| [docs/QUALITY.md](docs/QUALITY.md)                                                      | Outillage, règles de code, portes de qualité           |
| [Cadrage complet](https://claude.ai/code/artifact/b9b47a0d-cb08-416d-a45b-aea67c26001f) | Schémas, chiffres, analyse détaillée                   |

> Ce fichier est la source de vérité des décisions. Avant de rouvrir un arbitrage,
> vérifier qu'il n'est pas déjà tranché dans « Décisions actées » ou « Invariants ».
> Une décision se change explicitement (on édite la ligne + la date), jamais par dérive.

---

## Invariants

Règles qui ne se rediscutent pas sans décision explicite. Elles existent parce que
les violer casse quelque chose de structurel, pas par goût.

| #   | Invariant                                                                                                                                                                                                                        | Pourquoi                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | **Aucune capture d'entrée.** Ni contenu, ni touches, ni comptage de frappes. Uniquement la durée d'inactivité fournie par l'OS.                                                                                                  | C'est la première objection qu'on nous fera. `org.gnome.Mutter.IdleMonitor` (Linux) et `GetLastInputInfo()` (Windows) suffisent — vérifié sur la machine cible.                                               |
| I2  | **L'extension GNOME reste minimale** : capteurs uniquement, zéro logique de jeu.                                                                                                                                                 | Elle tourne dans le processus du compositeur. Un bug dedans fait tomber la session.                                                                                                                           |
| I3  | **Le cerveau ne connaît pas l'OS.** Aucun import système dans `core` — les capacités passent par des ports.                                                                                                                      | C'est ce qui rend le portage Windows possible et le moteur testable. Vérifié par `dependency-cruiser`.                                                                                                        |
| I4  | **Dev et non-dev progressent à la même vitesse.** Les sources spécialisées remplissent des quêtes, elles n'ajoutent jamais d'XP directement.                                                                                     | Sinon deux populations désynchronisées, et le non-dev se sent en version d'essai.                                                                                                                             |
| I5  | **Aucun sprite committé.** Téléchargement à l'installation.                                                                                                                                                                      | Un DMCA ne peut pas viser un dépôt qui ne contient qu'un script de téléchargement.                                                                                                                            |
| I6  | **Le pet se tait pendant la concentration** et en plein écran.                                                                                                                                                                   | Il n'interrompt pas ce que l'économie d'XP récompense. Une bulle de trop = désinstallation.                                                                                                                   |
| I7  | **Dégradation gracieuse** : sans extension GNOME, le pet vit quand même — déplacements, animations, bulles, XP. **Mais sur Wayland il ne suit ni la souris ni les fenêtres** (révisé le 2026-08-13, cf. constat 7 ter du spike). | L'installation ne doit pas être un mur pour un non-technicien, mais l'extension n'est plus un simple bonus sur Linux : elle est requise pour le suivi du curseur. Sur X11 et Windows, le repli reste complet. |
| I8  | **Strings UI via un fichier de locales.** Jamais de texte en dur.                                                                                                                                                                | Convention héritée de `claude-pokemon`, qui a payé pour l'apprendre.                                                                                                                                          |
| I9  | **Aucun identifiant de créature en dur** dans le code. Tout passe par le manifeste de pack.                                                                                                                                      | Le projet doit survivre au remplacement du pack par défaut.                                                                                                                                                   |
| I10 | **`npm run health` passe à la fin de chaque sprint.** Aucune dette reportée.                                                                                                                                                     | Voir [docs/QUALITY.md](docs/QUALITY.md) — un projet neuf n'a aucune excuse.                                                                                                                                   |

---

## Décisions actées

| Sujet                       | Choix                                                                                | Date       | Raison courte                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nom du projet               | `perch` (sans « pokemon »)                                                           | 2026-08-13 | Cohérent avec le pack interchangeable ; renommer coûte zéro tant que le dépôt n'est pas public                                                                                                                                                    |
| Architecture                | Ports et adaptateurs, monorepo à 3 paquets (`core`, `app`, `shell`)                  | 2026-08-13 | Trois cibles de build réellement différentes. Détail dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                                                                                                                                            |
| Rendu                       | Electron                                                                             | 2026-08-13 | Stack TS existante, sprites animés triviaux, packaging `.exe` / `.deb` / AppImage clé en main. **⚠️ mesuré à 327 Mo en S0, à réarbitrer avant S2**                                                                                                |
| Économie d'XP               | Socle universel ~80 % + quêtes profilées plafonnées ~20 %                            | 2026-08-13 | Voir I4                                                                                                                                                                                                                                           |
| Dépôt                       | Nouveau, autonome                                                                    | 2026-08-13 | Doit fonctionner sans `claude-pokemon` installé                                                                                                                                                                                                   |
| Lien claude-pokemon         | Créatures **distinctes**, échange via boîte de dépôt fichier                         | 2026-08-13 | Aucun couplage de processus ; la métaphore du PC fournit l'abstraction                                                                                                                                                                            |
| Plateformes                 | Linux + Windows                                                                      | 2026-08-13 | macOS hors périmètre initial, mais l'archi ne le ferme pas                                                                                                                                                                                        |
| Sprites                     | Pipeline Showdown repris de `claude-pokemon`, frames PNG couleur, **non committées** | 2026-08-13 | Voir I5                                                                                                                                                                                                                                           |
| Capteur d'activité          | API d'inactivité de l'OS                                                             | 2026-08-13 | Voir I1                                                                                                                                                                                                                                           |
| **Pack de créatures**       | **Interchangeable dès le départ** : manifeste JSON + chargeur validé zod             | 2026-08-13 | Une demi-journée maintenant, des semaines après S6. Voir I9                                                                                                                                                                                       |
| Extension GNOME             | Écrite en **TypeScript** avec `@girs/gnome-shell` v50                                | 2026-08-13 | Aligné sur GNOME Shell 50.1 ; pas de zone non typée dans le projet                                                                                                                                                                                |
| Validation                  | **zod** à toutes les frontières, types inférés depuis les schémas                    | 2026-08-13 | Rend tenable l'interdiction des assertions de type                                                                                                                                                                                                |
| Outillage                   | dependency-cruiser, Knip, Vitest, Playwright, commitlint, Dependabot                 | 2026-08-13 | Équivalences détaillées dans [docs/QUALITY.md](docs/QUALITY.md)                                                                                                                                                                                   |
| `git init`                  | À la fin de S0, une fois le spike validé                                             | 2026-08-13 | Ne pas construire une CI pour un projet dont la faisabilité n'est pas prouvée                                                                                                                                                                     |
| **Version d'Electron**      | **Épinglée `^42.7.0`**                                                               | 2026-08-13 | ⛔ Electron ≥ 43.2.0 casse `setIgnoreMouseEvents` sur Linux/X11 ([electron#52456](https://github.com/electron/electron/issues/52456)) : l'overlay avale **tous** les clics du bureau. Critère bloquant à revérifier avant toute montée de version |
| Drapeau d'affichage         | `--ozone-platform=x11` en **ligne de commande**                                      | 2026-08-13 | `app.commandLine.appendSwitch` est sans effet : Electron choisit sa plateforme avant d'exécuter le script                                                                                                                                         |
| Version de Node             | **24 LTS** (`.nvmrc`)                                                                | 2026-08-13 | La 26 est `latest` mais pas LTS. Pour un projet destiné à être distribué, une base LTS vieillit mieux                                                                                                                                             |
| Version de TypeScript       | Épinglée `~6.0.3`                                                                    | 2026-08-13 | `typescript-eslint` exige `<6.1.0`. TS 7 existe mais désactiverait les règles _type-checked_, c'est-à-dire tout le typage fort. À relever dès que l'amont suit                                                                                    |
| Vérification des garde-fous | Script permanent lancé en CI                                                         | 2026-08-13 | Une règle mal ciblée laisse `health` au vert sans plus rien protéger. `npm run verify:guardrails` introduit 5 violations et exige leur rejet                                                                                                      |

## Décisions ouvertes

| Question                               | Options                                                   | À trancher avant         | Statut                                 |
| -------------------------------------- | --------------------------------------------------------- | ------------------------ | -------------------------------------- |
| Comment on obtient son compagnon       | Choix direct / œuf à éclore / capture aléatoire / combiné | S6                       | ⏳                                     |
| Un seul pet ou plusieurs à l'écran     | Un seul en V1 / multi dès le départ                       | S2 (impacte la physique) | ⏳ recommandé : un seul, archi ouverte |
| Son (cris, bruitages)                  | Aucun / muet par défaut                                   | S5                       | ⏳                                     |
| Dépôt GitHub public ou privé au départ | Public / privé jusqu'à S7                                 | S9                       | ⏳                                     |

---

## Sprints

Chaque sprint a un **objectif** (la question à laquelle il répond), des **livrables**,
et une **définition de fini** vérifiable. Un sprint n'est fini que quand sa DoD passe
**et** que la checklist « 10/10 » de [docs/QUALITY.md](docs/QUALITY.md) est cochée.

### S0 — Spike technique ✅

**Objectif** : prouver que GNOME Shell 50.1 sur Wayland se comporte comme prévu, **avant**
d'investir dans l'outillage et le moteur. C'est le sprint le plus risqué du projet, donc le premier.

**Code jetable, hors dépôt git.** Aucune architecture, aucun test, aucune qualité —
c'est le seul sprint où c'est vrai, et c'est délibéré : on ne construit pas une CI pour
un projet dont la faisabilité n'est pas prouvée.

- Extension GNOME minimale : position du curseur + géométrie des fenêtres sur D-Bus
- Fenêtre Electron transparente, sans bordure, au-dessus des autres, clics traversants
- Un sprite animé qui traverse l'écran et suit le curseur

**Définition de fini** : le sprite suit la souris de façon fluide sur les 3 écrans, y compris
au passage d'un écran à l'autre, et l'extension survit à un verrouillage/déverrouillage de session.

**État au 2026-08-13** — 9 constats consignés dans [spike/README.md](spike/README.md) :

| Vérification                                               | État                                               |
| ---------------------------------------------------------- | -------------------------------------------------- |
| Le sprite suit la souris sur les 3 écrans                  | ✅                                                 |
| Overlay au-dessus de toutes les fenêtres, sans disparaître | ✅ PhpStorm, terminal, bureau                      |
| Bulles de dialogue lisibles par-dessus les fenêtres        | ✅                                                 |
| Overlay 3840×2160, profondeur 32, override-redirect        | ✅ `xwininfo`                                      |
| Clics traversants                                          | ✅ région d'entrée 1×1 px + confirmé à l'usage     |
| Suivi du curseur **sans** l'extension, sur Wayland         | ❌ **impossible** — s'exclut des clics traversants |
| Extension GNOME chargée et répondant sur D-Bus             | ⏳ **exige une reconnexion de session**            |

**Conséquence majeure, et elle corrige une conclusion trop rapide** : sur Wayland, laisser
passer les clics coupe la seule source de position du curseur dont dispose XWayland. Les
deux s'excluent. **L'extension GNOME devient donc obligatoire sur Wayland** pour le suivi
de la souris — sur X11 et Windows le repli reste complet.

Mesure (`check-tracking.sh`, souris en mouvement) : 1 position distincte en 10 s sans
overlay, 2 avec — dont `(0,0)`, signature Wayland d'une position globale inconnue.

### S1 — Fondations ✅

**Objectif** : que tout ce qui devient chronophage plus tard existe avant la première
ligne de logique métier. C'est ici qu'on met en place les conditions du 10/10.

**`git init` a lieu ici**, une fois S0 validé.

- Structure monorepo : `packages/core`, `packages/app`, `packages/shell`
- `tsconfig` strict maximal partagé (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …)
- ESLint + Prettier, avec les interdits : `any`, assertions de type, `max-lines` 200
- **dependency-cruiser** avec les règles A1 à A7 de [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Vitest + seuils de couverture par paquet ; Playwright câblé pour Electron ; Knip
- commitlint, Dependabot, GitHub Actions, hook pre-push Claude Code (**pas husky**)
- `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `LICENSE`
- Squelette des ports : `SensorPort`, `StoragePort`, `ClockPort`
- Un pack de créatures **de test** à deux entrées, pour ne pas dépendre du pack réel dans les tests
- Sécurité Electron : isolation de contexte, sandbox, IPC validé zod

**État au 2026-08-13 — terminé.** `npm run health` passe (code 0) : format, lint, types,
36 modules sans violation d'architecture, knip propre, 44 tests, 96,9 % de statements et
100 % de branches. `npm run verify:guardrails` confirme que les cinq violations types sont
bien rejetées.

Deux imprévus consignés : `typescript-eslint` interdit TypeScript 7, et un binaire natif
tronqué au téléchargement (`@rolldown/binding`) faisait crasher vitest et knip en `SIGBUS`
— piège difficile à diagnostiquer, noté dans `CLAUDE.md`.

**Définition de fini** : `npm run health` passe sur un dépôt encore quasi vide **et**
une violation introduite volontairement (un `import` de `electron` dans `core`, un
fichier de 220 lignes, un `any`) fait bien échouer la CI. Un garde-fou qu'on n'a pas
vu échouer n'est pas un garde-fou.

### S2 — Le corps ✅

**Objectif** : un pet qui se déplace de façon crédible, sans encore rien comprendre au jeu.

- Machine à états (repos, marche, court, escalade, assis, chute, suit la souris, attrapé, sommeil)
- Gravité et collision sur segments horizontaux
- Construction des surfaces marchables depuis les capteurs
- **Géométrie multi-écrans en union de rectangles**, avec les zones vides (voir plus bas)
- Attraper / déplacer / lâcher à la souris
- Branchement à chaud d'un écran → invalidation de la géométrie
- Adaptateurs de capteurs : `gnome`, `null` (dégradé)

**Définition de fini** : le pet ne tombe jamais dans une zone vide, ne se coince jamais hors
écran, et survit au débranchement d'un moniteur.

**Mesure déjà prise en S0** : **327 Mo de PSS** en régime permanent (détail dans
`spike/README.md`), soit nettement au-dessus des 150-200 Mo estimés au cadrage. Si c'est
jugé intenable, S2 est le dernier moment pas trop cher pour changer de corps — `core`
n'existe pas encore et l'architecture en ports rend le remplacement local.

### S3 — Le cerveau ✅

**Objectif** : le pet progresse.

- `state.json` : schéma zod versionné, migrations douces (champs ajoutés en défauts, jamais retirés)
- Socle d'XP sur `ClockPort` : 2 XP/min actif, bonus concentration ×1,5 après 20 min
  dans la même app, rendements décroissants au-delà de 6 h/jour
- Courbe de niveaux : 3 segments (1→16 ratio 1,15 ; 16→36 ratio 1,06 ; 36→100 ratio 1,02)
- IPC `core` ↔ `app`

**Définition de fini** : une journée simulée de 4 h actives donne ~800 XP de socle et
s'exécute en millisecondes ; les écarts entre niveaux sont monotones croissants de 1 à 100 ;
le state survit à un redémarrage et à une montée de version de schéma.

### S4 — Quêtes et profils ✅ (moteur), sources restantes

- Moteur de quêtes quotidiennes, 2-3 par jour, **plafonné** à ~200 XP/jour
- Détection de profil au premier lancement, ajustable ensuite
- Pool universel (concentration, pauses, diversité d'apps)
- Sources : liste de tâches interne, dépôts git déclarés, pont `claude-pokemon` optionnel

**Définition de fini** : ✅ vérifiée à deux niveaux — sur le moteur de quêtes (30 jours
consécutifs, profils nu et tout-branché à l'XP près) et de bout en bout sur `advanceState`
(journée de 4 h simulée). L'équité est garantie **par construction** : même nombre de
quêtes pour tous, plafond réparti à parts égales. Brancher une source ne peut pas faire
gagner davantage, seulement changer ce qu'on fait pour y arriver.

**Reste à faire dans ce sprint** — le moteur est complet et branché, les _sources_
spécialisées ne le sont pas encore :

- source git (commits du jour dans les dépôts déclarés) — le signal existe, personne ne
  l'alimente
- liste de tâches interne — demande une fenêtre de réglages, qui arrive en S5
- pont `claude-pokemon` optionnel

Sans elles, un profil `dev` reçoit ses quêtes de développement mais ne peut pas les
valider. C'est visible et assumé, pas silencieux.

### S5 — Personnalité

- Bulles, plafond d'une toutes les 15 min, file de priorité
- Silence pendant la concentration et en plein écran (I6)
- Quatre registres : événement, humeur, interaction directe, bavardage aléatoire
- Locales FR/EN + test de parité des clés
- Fenêtre de réglages, thème clair/sombre par jetons CSS

### S6 — Créatures et évolutions

- Chargeur de pack, manifeste validé zod, pack par défaut téléchargé à l'installation
- Pipeline sprites : reprise de `extract_animations.py`, sortie frames PNG couleur au lieu d'ANSI
- Choix du compagnon au premier lancement
- Paliers d'évolution à Lv.16 et Lv.36, avec mise en scène

### S7 — Windows

- Adaptateurs Win32 : `GetLastInputInfo`, `EnumWindows`, `GetCursorPos`
- Fenêtre transparente et clics traversants côté Windows
- Packaging `.exe` (NSIS via electron-builder) + `@electron/fuses`
- **Premier test réel avec un utilisateur non-dev** — le vrai juge du projet

### S8 — Boîte d'échange

- Format d'enveloppe JSON versionné, répertoire neutre
- Dépôt / retrait, asynchrone, sans que l'autre app ait besoin de tourner
- Intégration correspondante côté `claude-pokemon`

### S9 — Publication

- Installateurs, écran d'accueil (dont l'étape « reconnecte ta session » pour GNOME)
- README, GIF de démonstration
- CI complète sur les deux OS

---

## Notes de terrain

**Machine de dev cible** : Ubuntu 26.04 LTS, GNOME Shell 50.1, session Wayland, gjs 1.88.

**Disposition des écrans** — la surface totale n'est pas un rectangle :

```
        0        1920      3840
      0 ┌─────────┬─────────┐
        │  DP-3   │  DP-4   │
   1080 ├────┬────┴────┬────┤
        │////│  eDP-1  │////│   //// = le vide, aucun écran
   2160 └────┴─────────┴────┘
            1041     2961
```

Un pet qui marche vers la gauche sur DP-3 et arrive au bord bas ne trouve aucune surface
en dessous. Le moteur doit raisonner sur une union de rectangles, jamais sur une boîte englobante.

**Prior art** : [Shijima-Qt](https://github.com/pixelomer/Shijima-Qt) (archivé) résout le même
problème — son `Platform/Linux/` contient `gnome_script/extension.js` et `kwin_script.js`,
consommés via D-Bus. Ils ne suivent que la fenêtre **active**, pas toutes : compromis de
complexité qu'on peut reprendre en V1.

**Origine** : réel Instagram de `madamet3ch`. Son montage = web app To-Do gamifiée générée avec
Emergent AI exposant `/api/pet-status`, plus un script Python Windows qui poll et affiche.
On garde l'effet visuel, pas l'architecture — notre pet a son cerveau en local.
