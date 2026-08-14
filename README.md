# perch

Un compagnon pixelisé qui vit sur votre bureau. Il se perche au bord des fenêtres, suit la
souris, lâche une réflexion de temps en temps, et grandit avec la façon dont vous utilisez
votre machine.

> **Statut : en construction.** Le sprint fondations (S1) est posé ; le compagnon ne bouge
> pas encore. Voir [ROADMAP.md](ROADMAP.md).

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
