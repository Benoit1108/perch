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

### Extension GNOME

- **`disable-user-extensions` peut tout neutraliser en silence.** Ce réglage global
  désactive TOUTES les extensions du dossier utilisateur quel que soit leur état
  individuel, et `gnome-extensions enable` ne signale rien. Les extensions système
  continuent de fonctionner, ce qui rend le diagnostic trompeur.
  `gsettings get org.gnome.shell disable-user-extensions` — doit valoir `false`.
- **Rien ne recharge le code d'une extension à chaud** (GNOME 50, Wayland). `disable`
  puis `enable` ne relit pas le fichier : depuis GNOME 45 les extensions sont des modules
  ESM et le module reste en cache. `org.gnome.Shell.Extensions.ReloadExtension` est
  déclarée sur D-Bus mais répond « not implemented ». **Toute modification de
  `packages/shell` exige une reconnexion de session** — en tenir compte dans le rythme de
  travail, pas seulement dans la doc.
- `npm run install:extension` copie et active, et signale ces deux pièges.

### Rendu et fluidité

- **Ne jamais attendre un appel D-Bus dans la boucle d'animation** : la cadence dépendrait
  d'un aller-retour inter-processus et la gigue serait visible. Relever en tâche de fond,
  simuler avec la dernière valeur connue.
- **Pas de `setInterval` avec un corps asynchrone** : les exécutions s'empilent dès qu'une
  frame dépasse son budget. Se replanifier après chaque passage.
- **Le rendu interpole vers la position simulée.** Le moteur reste autoritaire ; l'affichage
  la rejoint progressivement. Sans ça, la moindre irrégularité de cadence se voit.
- **Les trois attributs d'overlay se ré-appliquent ENSEMBLE et RÉGULIÈREMENT** : invisible
  aux clics, au-dessus de tout, présent sur tous les bureaux. Un redimensionnement remet la
  région d'entrée à zéro (constat S0 n°7) et le gestionnaire de fenêtres perd le rang
  « au-dessus » au fil des ouvertures — le compagnon finit alors derrière le terminal.
- **`showInactive()` et non `show()`** : une fenêtre qui s'ouvre au premier plan reçoit les
  clics tant qu'elle garde le focus, quels que soient les réglages de transparence. Au
  lancement, il fallait passer sur une autre application pour rendre la souris au bureau.
- **Les images passent par IPC, encodées en `data:`.** La page du compagnon n'a aucun accès
  au disque — sa politique de sécurité n'autorise que `img-src data:` — et elle est
  toujours au premier plan. Elles voyagent par ÉVÉNEMENT (démarrage, choix, évolution),
  jamais dans la boucle : quelques dizaines de kilo-octets soixante fois par seconde
  saturent le canal pour retransmettre la même chose.
- **Borner le delta de `requestAnimationFrame`.** Au réveil après une veille, il vaut
  plusieurs minutes : l'animation défile d'un coup jusqu'à une image au hasard.
- **Les pages de rendu se découpent en trois** : `x.html`, `x.css`, `x.js`. Le script
  inséré dans le HTML échappait à ESLint, à `max-lines` et à toute revue — une page avait
  atteint 361 lignes en mélangeant balisage, style et logique. La politique de sécurité
  n'autorise donc plus aucune source en ligne : `script-src 'self'` fonctionne en `file://`
  (vérifié), et un module ES n'y fonctionnerait PAS — origine opaque, garder des scripts
  classiques.
- **Ce qui vient d'un manifeste ou de l'utilisateur se pose avec `textContent`**, jamais en
  assemblant du HTML. Les noms de créatures et les libellés de tâches sont des données
  qu'on n'a pas écrites.
- **Deux façons d'envoyer au rendu.** `send` pour ce qui se répète (les frames) : une perte
  est réparée seize millisecondes plus tard. `retain` pour ce qui est rare (l'apparence) :
  conservé et rejoué à chaque chargement, sans quoi le message part avant que la page
  n'ait branché ses écouteurs.
- **Sprites alignés par le BAS, recadrés sur l'UNION des zones utiles.** Le moteur ancre le
  compagnon par les pieds. Recadrer image par image collerait chaque frame au même endroit
  et supprimerait le balancement ; ne pas recadrer du tout laisserait le sprite flotter
  au-dessus de sa surface, du vide transparent sous les pattes.

### Windows et portabilité

- **Deux appels Win32 ne sont pas à écrire.** `screen.getCursorScreenPoint()` et
  `powerMonitor.getSystemIdleTime()` remplacent `GetCursorPos` et `GetLastInputInfo` sur
  Windows, macOS et vraie session X11. Ils MENTENT sous XWayland — curseur figé, inactivité
  toujours nulle (mesuré) — d'où `electronSeesDesktop`, qui préfère avouer l'ignorance.
- **Aucune interface d'Electron ne donne la géométrie des fenêtres.** C'est ce qui limite
  Windows aux bords d'écran, et ce que l'extension GNOME apporte sur Linux.
- **`--ozone-platform=x11` se choisit à l'exécution**, pas dans le script npm : il est
  indispensable sur Linux et dépourvu de sens ailleurs.
- **Une application lancée depuis un menu n'a personne au bout de sa sortie standard.**
  Le terminal parent se referme, le tube meurt, et le premier `console.log` lève `EPIPE` —
  qui, non attrapé, affiche la boîte « A JavaScript error occurred in the main process » et
  fige l'application dessus indéfiniment. `survivePipeClosure` s'installe AVANT le premier
  message. Ce défaut ne se voit pas en développement, où quelqu'un lit toujours.
- **Les chemins relatifs au dépôt ne survivent pas à l'empaquetage.** Les packs se cherchent
  dans le dossier de l'utilisateur, puis dans `process.resourcesPath`, puis dans le dépôt.
  L'AppImage démarrait sans visage alors que ses images étaient deux dossiers plus loin.

- **Le silence se règle PAR REGISTRE.** Un seuil unique ne peut pas convenir : assez haut
  pour que le bavardage reste discret, il retient aussi les réactions, qui périment en file
  avant d'être dites. Le compagnon paraît alors muet alors que tout fonctionne.

### Outillage

- **TypeScript est épinglé en `~6.0.3`** : `typescript-eslint` exige `<6.1.0`. TS 7 existe
  mais casserait les règles _type-checked_, c'est-à-dire tout notre typage fort.
- **Node 24 LTS** (`.nvmrc`). La 26 n'est pas LTS.
- Un `SIGBUS` sur `vitest` ou `knip` signale un binaire natif tronqué au téléchargement
  (`@rolldown/binding-*`). Comparer sa taille à `npm view <pkg> dist.unpackedSize`.
- **Un fichier de configuration knip remplace la détection automatique**, il ne la
  complète pas : en ajouter un a fait disparaître les tests de l'analyse et transformé des
  exports utilisés en faux positifs. Si `knip.json` doit bouger, redéclarer TOUTES les
  zones — points d'entrée par espace de travail, tests compris.
- **Une porte toujours rouge n'est plus une porte.** `npm audit` échouait en permanence sur
  des avis sans correctif amont ; `npm run audit` accepte désormais une liste NOMMÉE avec
  raison et date de réexamen, et refuse tout le reste — y compris une exception devenue
  inutile.
- **Ancrer les motifs `.gitignore` avec un `/` initial.** `packs/*` a fait disparaître
  `packages/app/src/packs/` aux yeux de knip — pas à ceux de git, qui ancre déjà les motifs
  contenant une barre. Résultat : knip déclarait morts des exports parfaitement utilisés.
  Devant un verdict d'outil qui contredit une lecture du code, vérifier d'abord ce que
  l'outil voit (`npx knip --trace-export <nom>`).

## Conventions

- **Commits** : Conventional Commits, vérifiés par commitlint
- **Pas de `Co-Authored-By`**
- **Pas de push sans validation explicite**
- **Branches de fonctionnalité**, historique linéaire, rebase-merge
- **CHANGELOG** au format Keep a Changelog, une entrée par PR
- **i18n dès le premier texte** : aucune chaîne d'interface en dur
- **Thème clair et sombre** dès la première fenêtre, par jetons CSS
