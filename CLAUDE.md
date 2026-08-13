# CLAUDE.md

Instructions pour Claude Code sur **perch**.

## Vue d'ensemble

Un compagnon pixelisé qui vit sur le bureau : il se perche au bord des fenêtres, suit la
souris, et gagne de l'expérience selon la façon dont on utilise sa machine.
Linux + Windows, **pour les développeurs comme pour ceux qui n'ouvrent jamais un terminal**.

| Document                                     | Contenu                                               |
| -------------------------------------------- | ----------------------------------------------------- |
| [ROADMAP.md](ROADMAP.md)                     | Décisions, invariants, sprints — **source de vérité** |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Couches et règles de dépendance vérifiées en CI       |
| [docs/QUALITY.md](docs/QUALITY.md)           | Outillage, règles de code, portes de qualité          |
| [spike/README.md](spike/README.md)           | Les 9 pièges trouvés en S0 — à relire avant S2        |

**Avant de rouvrir un arbitrage, vérifier qu'il n'est pas déjà tranché** dans les
« Invariants » ou « Décisions actées » de `ROADMAP.md`. Une décision se change
explicitement — on édite la ligne et la date — jamais par dérive.

## Architecture

```
packages/
├── core/     LE CERVEAU — Node pur, zéro dépendance système, testable sans OS
│   └── src/{creatures,state,ports}/
├── app/      LE CORPS — Electron : rendu, physique, adaptateurs de capteurs
│   └── src/{main,renderer,physics,sensors,adapters}/
└── shell/    L'EXTENSION GNOME — TypeScript compilé en ESM GJS, capteurs uniquement
packs/        Packs de créatures : manifeste JSON + sprites (jamais committés)
spike/        Code jetable de S0, conservé pour ses constats
```

Le cœur définit des **ports** (interfaces), les plateformes fournissent des
**adaptateurs**. `core` ne sait pas sur quel système il tourne et ne peut pas le savoir :
il n'a pas accès aux modules qui le lui diraient. C'est vérifié mécaniquement.

## Ce qui est vérifié automatiquement

```bash
npm run health              # format → lint → types → archi → code mort → tests
npm run verify:guardrails   # les garde-fous rejettent-ils encore ?
```

`npm run health` doit passer **à la fin de chaque sprint**, sans dette reportée.

Un hook Claude Code (`.claude/hooks/pre-push.sh`) l'exécute avant tout `git push`.
Contournement : `--no-verify`. **Ne pas contourner sans demande explicite.**

## Règles non négociables

Les invariants complets sont dans `ROADMAP.md`. Les plus faciles à violer sans le vouloir :

- **`core` n'importe aucun module système ni Electron** (I3). Les capacités passent par
  un port. Vérifié par `dependency-cruiser`, règle A2.
- **Aucune capture d'entrée** (I1). L'activité se mesure via l'API d'inactivité de l'OS —
  `org.gnome.Mutter.IdleMonitor`, `GetLastInputInfo`. Ni contenu, ni touches, ni comptage.
- **L'extension GNOME reste minimale** (I2) : capteurs seulement, zéro logique de jeu.
  Elle tourne dans le processus du compositeur — un bug dedans fait tomber la session.
- **Aucun sprite committé** (I5), aucun identifiant de créature en dur (I9).
- **Aucun fichier au-delà de 200 lignes**, pas de `any`, pas d'assertion de type.
  L'échappatoire n'est pas de désactiver la règle mais d'écrire un `eslint-disable` **avec
  une justification**. Le compte de ces exceptions est le baromètre de dette du projet.

## Validation aux frontières

Toute donnée qui entre dans le processus — `state.json`, charges utiles D-Bus, manifestes
de packs — est validée par un **schéma zod**, et les types TypeScript sont _inférés depuis
ces schémas_, jamais déclarés en double. C'est ce qui rend l'interdiction des assertions
tenable : après un `parse`, le type est garanti à l'exécution.

## Pièges connus

### Electron sur Linux

- **`app.commandLine.appendSwitch('ozone-platform', 'x11')` NE FONCTIONNE PAS.** Electron
  choisit sa plateforme avant d'exécuter le script. Le drapeau doit être un vrai argument
  de ligne de commande. Sans lui, l'application tourne en Wayland natif où `setBounds` et
  `setAlwaysOnTop` sont ignorés **en silence** : la fenêtre existe, `isVisible()` renvoie
  `true`, et rien ne s'affiche.
- **`setBounds` réinitialise la région d'entrée X11.** Ré-appliquer `setIgnoreMouseEvents`
  après chaque changement de géométrie, sinon l'overlay avale tous les clics du bureau.
- **Mutter écrête la taille à la création** : demander 3840×2160 donne un seul écran. Seul
  un `setBounds` après affichage est honoré.
- **`isVisible()` ne prouve rien.** Les signaux fiables sont `xwininfo` (`Map State`) et
  `webContents.capturePage()`.
- **Electron est épinglé en `^42.7.0`** : à partir de 43.2.0, `setIgnoreMouseEvents` ne
  réduit plus la région d'entrée (electron#52456).
- **`globalShortcut.register()` renvoie `true` sous Wayland et ne fonctionne PAS.** Le
  compositeur route le clavier ; une application XWayland ne peut pas capter de raccourci
  global. Même famille de mensonge qu'`isVisible()`. La sortie de secours fiable est le
  fichier PID + `npm run stop`, qui ne dépend ni du clavier, ni de la souris, ni du
  compositeur.
- **Un overlay plein écran naît avec ses sorties de secours.** L'arrêt automatique est
  actif par défaut en `PERCH_DEBUG=1` : si les clics traversants cassent, c'est le seul
  recours qui ne dépende de rien.

### Outillage

- **TypeScript est épinglé en `~6.0.3`** : `typescript-eslint` exige `<6.1.0`. TS 7 existe
  mais casserait les règles _type-checked_, c'est-à-dire tout notre typage fort.
- **Node 24 LTS** (`.nvmrc`). La 26 n'est pas LTS.
- Un `SIGBUS` sur `vitest` ou `knip` signale un binaire natif tronqué au téléchargement
  (`@rolldown/binding-*`). Comparer sa taille à `npm view <pkg> dist.unpackedSize`.

## Conventions

- **Commits** : Conventional Commits, vérifiés par commitlint
- **Pas de `Co-Authored-By`**
- **Pas de push sans validation explicite**
- **Branches de fonctionnalité**, historique linéaire, rebase-merge
- **CHANGELOG** au format Keep a Changelog, une entrée par PR
- **i18n dès le premier texte** : aucune chaîne d'interface en dur
- **Thème clair et sombre** dès la première fenêtre, par jetons CSS
