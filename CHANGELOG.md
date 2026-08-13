# Changelog

Toutes les évolutions notables de ce projet sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et le projet
adhère au [versionnage sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Added

- **Sprint S3 — Le cerveau.** La créature progresse. Courbe de niveaux à trois segments
  (ratios 1,15 / 1,06 / 1,02 appliqués aux **écarts**, pas au cumul), socle d'expérience
  fondé sur le temps réellement actif, et persistance à chaque minute.
- Socle d'XP : 3 XP/minute active, ×1,5 après 20 minutes continues dans la même
  application, rendements décroissants au-delà de 6 h actives par jour. Une journée de
  4 h dont 2 h de concentration rapporte ~870 XP, soit le niveau 16 en une quinzaine de
  jours et le niveau 36 en quatre mois.
- `org.gnome.Mutter.IdleMonitor` comme source d'activité — interface de GNOME, pas de
  notre extension : **la progression fonctionne même en mode dégradé**.
- `GetFocusedApp` dans l'extension : classe WM uniquement, jamais un titre de fenêtre —
  un titre exposerait le contenu consulté (invariant I1).
- Le temps écoulé est borné à deux ticks : sans cela, une machine réveillée après huit
  heures de veille encaisserait une nuit entière d'expérience.
- **Sprint S2 — Le corps.** Surfaces marchables, pesanteur, machine à états, overlay
  transparent et capteurs GNOME.

- **Sprint S1 — Fondations.** Monorepo à trois paquets (`core`, `app`, `shell`) en ports
  et adaptateurs, avec tout l'outillage de qualité posé avant la première ligne de logique
  métier.
- Ports `SensorPort`, `ActivityPort`, `ClockPort` et `StoragePort`. `SensorPort.pointer()`
  renvoie `Point | null` : sur Wayland, la position du curseur peut être légitimement
  inconnue, et le type force à traiter ce cas.
- Schéma zod des packs de créatures, chargeur et règles d'évolution ; pack de test à deux
  lignées pour que le moteur soit testable sans dépendre du pack réel.
- Schéma d'état versionné, relecture tolérante aux fichiers corrompus.
- Adaptateurs `systemClock` et `createFileStorage` (écriture atomique), backend de capteurs
  `nullSensors` pour le mode dégradé.
- Extension GNOME réécrite en TypeScript, typée contre `@girs/gnome-shell` v50.
- `npm run verify:guardrails` : introduit délibérément cinq violations et exige qu'elles
  soient rejetées. Un garde-fou qu'on n'a pas vu échouer n'est pas un garde-fou.
- Intégration continue : portes de qualité, vérification des garde-fous, audit de
  vulnérabilités. Dependabot hebdomadaire.

### Changed

- Node cible porté de 22 à **24 LTS**.
- TypeScript épinglé en `~6.0.3` : `typescript-eslint` exige `<6.1.0`, et TS 7 désactiverait
  les règles _type-checked_ dont dépend tout le typage fort.
- Electron épinglé en `^42.7.0` : à partir de 43.2.0, `setIgnoreMouseEvents` ne réduit plus
  la région d'entrée X11 et l'overlay avale tous les clics du bureau
  ([electron#52456](https://github.com/electron/electron/issues/52456)).

### Fixed

- **Sprint S0 — Spike.** Neuf pièges identifiés sur du code jetable plutôt que sur
  l'architecture finale. Détail dans [spike/README.md](spike/README.md).
