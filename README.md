# perch

Un compagnon pixelisé qui vit sur votre bureau. Il se perche au bord des fenêtres, suit la
souris, lâche une réflexion de temps en temps, et grandit avec la façon dont vous utilisez
votre machine.

![Perch en action](https://github.com/Benoit1108/perch/releases/download/demo/demo.gif)

> Le GIF n'est pas versionné ici : il contient des sprites, et ce dépôt n'en héberge aucun
> (invariant I5). Il vit dans une ressource de release, régénérable par `npm run demo` —
> rien n'y est mimé, c'est le vrai moteur qui joue le scénario.

> **Statut : en construction.** Linux et Windows fonctionnent, l'installeur aussi. Reste la
> publication. Voir [ROADMAP.md](ROADMAP.md).

## Ce qu'il fait

**Il vous suit.** Quand la souris bouge, il vole vers elle. Quand elle s'arrête deux
secondes et demie, il rejoint la surface la plus proche et s'y pose.

**Il vit sa vie.** Posé, il arpente le bord d'une fenêtre, change de perchoir de sa propre
initiative, souffle quand il a beaucoup bougé, et finit par s'endormir si vous partez.

**Il remarque ce que vous faites.** Une fenêtre réduite, un alt-tab, un changement de
bureau, une longue absence : chacun lui inspire une phrase. Il se tait pendant les périodes
de concentration et en plein écran — une bulle de trop suffit à faire désinstaller un
compagnon.

**Il grandit.** L'expérience vient du temps actif ; les paliers d'évolution sont déclarés
par le pack de créatures, jamais écrits en dur. La lignée de la démonstration passe de
Brindibou à Efflèche au niveau 16, puis à Archéduc au niveau 36.

**C'est vous qui le choisissez.** Un champ de recherche dans la fenêtre de choix : tapez
« Fantominus », « Magicarpe » ou « Zekrom », et sa lignée entière est téléchargée chez vous.
Ou fabriquez la vôtre — le format de pack est documenté dans [docs/PACKS.md](docs/PACKS.md),
et une créature inventée y a droit aux mêmes évolutions. `npm run pack:poro` en dessine une
de bout en bout, en guise d'exemple : quatre stades animés, du poro au Roi Poro.

## L'idée

La plupart des compagnons de bureau sont décoratifs. Celui-ci progresse — niveaux,
évolutions — et cette progression repose sur deux principes :

**Elle est équitable.** Quatre cinquièmes de l'expérience viennent du temps réellement
actif et de la concentration, identiques pour tout le monde. Le reste vient de quêtes
quotidiennes plafonnées dont seul le _contenu_ change selon le profil : « trois commits »
pour un développeur, « deux heures de concentration » pour quelqu'un d'autre, même valeur.
Personne ne joue une version bridée.

**Elle ne vous espionne pas.** L'activité est mesurée par l'API d'inactivité du système —
`org.gnome.Mutter.IdleMonitor` sur Linux, `GetLastInputInfo` sur Windows. Ces interfaces
répondent à une seule question : depuis combien de temps l'utilisateur n'a rien fait.
**Aucune frappe n'est lue, jamais.** Tout reste local, sans compte ni serveur.

## Prise en main

```bash
nvm use              # Node 24 LTS
npm install
npm run pack:fetch   # fabrique le pack de créatures (Python 3 + Pillow)
npm run health       # format, lint, types, architecture, code mort, tests
```

**Aucune image n'est versionnée ici.** Le dépôt contient la liste des espèces
(`scripts/pack-source.json`) et le script qui va chercher leurs sprites ; `pack:fetch` les
télécharge, les découpe en frames et écrit le manifeste. Sans cette étape l'application
démarre quand même : le compagnon s'affiche alors sous la forme d'un marqueur sans nom.

## Développement

| Commande                    | Effet                                              |
| --------------------------- | -------------------------------------------------- |
| `npm run health`            | Toutes les portes de qualité, dans l'ordre         |
| `npm run typecheck`         | `tsc --build` sur les trois paquets                |
| `npm run deps`              | Règles d'architecture (dependency-cruiser)         |
| `npm run dead`              | Fichiers, exports et dépendances inutilisés (knip) |
| `npm test`                  | Vitest avec seuils de couverture                   |
| `npm run verify:guardrails` | Vérifie que les garde-fous rejettent encore        |
| `npm start`                 | Lance le compagnon                                 |
| `npm run stop`              | L'arrête (fichier PID — ne dépend pas du clavier)  |
| `npm run setup:sandbox`     | Corrige les permissions d'Electron, une seule fois |
| `npm run pack:fetch`        | Fabrique le pack de créatures par défaut           |
| `npm run visual`            | Capture le compagnon aux bords et aux coins        |
| `npm run demo`              | Rejoue la démonstration et en fait un GIF          |
| `npm run audit`             | Vulnérabilités, exceptions nommées et justifiées   |
| `npm run dist:linux`        | Construit l'AppImage                               |
| `npm run dist:win`          | Construit l'installeur Windows                     |

## Structure

```
packages/core     le cerveau — Node pur, aucune dépendance système
packages/app      le corps — Electron : rendu, physique, capteurs
packages/shell    l'extension GNOME — capteurs exposés sur D-Bus
packs/            packs de créatures interchangeables
```

Le cœur définit des interfaces, les plateformes fournissent les implémentations. Il ne sait
pas sur quel système il tourne — et n'a pas accès aux modules qui le lui diraient.
Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Plateformes

| Plateforme                   | Suivi du curseur | Perchage sur les fenêtres |
| ---------------------------- | ---------------- | ------------------------- |
| Windows                      | ✅ natif         | ✅ natif                  |
| Linux X11                    | ✅               | ✅                        |
| Linux Wayland + extension    | ✅               | ✅                        |
| Linux Wayland sans extension | ❌               | ❌                        |

Sur Wayland, laisser passer les clics coupe la seule source de position du curseur dont
dispose XWayland : les deux s'excluent. L'extension GNOME lit la position depuis le
compositeur lui-même, ce qui lève la contrainte. Sans elle, le compagnon vit quand même —
il se déplace, s'anime, parle et progresse — mais il ignore votre souris.

## Licence

MIT. Les packs de créatures ont leur propre licence, déclarée dans leur manifeste, et
**aucun sprite n'est distribué avec ce dépôt**.
