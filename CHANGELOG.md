# Changelog

Toutes les évolutions notables de ce projet sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et le projet
adhère au [versionnage sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Added

- **Boîte d'échange** avec les autres applications compagnon : un dossier neutre, une
  enveloppe JSON versionnée, et un retrait atomique qui interdit qu'une créature soit prise
  deux fois. Voir [docs/EXCHANGE.md](docs/EXCHANGE.md).

- **Windows et macOS deviennent atteignables** : le curseur et l'inactivité passent par les
  interfaces d'Electron, sans une ligne de code natif.
- Installeurs `.exe` (NSIS) et AppImage, fusibles Electron verrouillés, créatures embarquées
  dans le paquet. L'intégration continue construit le `.exe` **et le lance** : elle exige
  qu'il démarre et trouve ses créatures avant de le publier comme artefact.
- Les packs sont cherchés à trois endroits : dossier de l'utilisateur, ressources livrées,
  puis dépôt. Sans le deuxième, l'application installée démarrait sans visage alors que ses
  images étaient bien là.

- **De vraies créatures, animées.** Six lignées, quatorze stades, sur le thème de ce qui
  se perche. Les images sont téléchargées puis converties par `npm run pack:fetch` — le
  dépôt n'en contient aucune.
- Choix du compagnon au premier lancement, et à tout moment depuis les réglages.
  L'expérience acquise est conservée : seule l'apparence change.
- Évolutions à Lv.16 et Lv.36, mises en scène par un halo et un bond d'échelle. Elles
  éclipsent l'annonce de montée de niveau plutôt que de s'y ajouter.
- Animations décrites par le manifeste : plusieurs séquences par stade, chacune jouée à sa
  cadence, ralentie pendant le sommeil et accélérée en vol.

- **Deux modes de comportement.** Le compagnon vole librement vers le curseur quand la
  souris bouge, et se pose sur une surface quand elle s'arrête. La bascule entre les deux
  fait sa personnalité.
- Vie autonome rythmée en mode posé : trajets de longueur variable, changements de
  perchoir de sa propre initiative, petits sauts, et vraies pauses dont la durée dépend de
  la fatigue accumulée.
- Escalade progressive et descente volontaire : il rejoint le bord d'une fenêtre
  maximisée, et sait en redescendre.

- **Sprint S5 — Personnalité.** Le compagnon parle, et surtout il sait se taire : une
  bulle par quart d'heure au maximum, silence total pendant la concentration et en plein
  écran, demandes périmées abandonnées.
- File de priorité à quatre registres qui **écarte** les demandes les moins importantes
  plutôt que de les empiler.
- Détection du plein écran déduite de la géométrie déjà observée — le compagnon se cache
  entièrement, il ne se contente pas de se taire.
- Localisation FR/EN, catalogues embarqués en TypeScript et parité vérifiée.
- Fenêtre de réglages : langue, mode privé, dépôts surveillés, liste de tâches. Ouverte
  par `npm run settings`, un second lancement demandant au premier de l'afficher.
- Mode privé qui **suspend** la mesure plutôt que de l'atténuer.

- **Sprint S4 — Quêtes et profils.** Équité garantie par construction : même nombre de
  quêtes pour tous, plafond quotidien réparti à parts égales. Brancher une source ne peut
  pas faire gagner davantage, seulement changer ce qu'on fait pour y arriver.
- Source git via `npm run watch`, lancé depuis l'intérieur d'un dépôt. Aucune racine
  devinée, aucun scan du système de fichiers.
- Comptage honnête des commits : hachages uniquement — jamais un message, qui dirait _sur
  quoi_ on travaille là où le hachage dit seulement _que_ l'on a travaillé —, filtré sur
  l'adresse git du dépôt, et dédoublonné pour qu'un `rebase` ne fasse pas recompter la
  matinée.
- Profils déduits des preuves plutôt que cochés : une quête qu'aucune source ne sait
  mesurer n'est jamais proposée.

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

- **Sprint S0 — Spike.** Neuf pièges identifiés sur du code jetable plutôt que sur
  l'architecture finale. Détail dans [spike/README.md](spike/README.md).

### Changed

- Node cible porté de 22 à **24 LTS**.
- TypeScript épinglé en `~6.0.3` : `typescript-eslint` exige `<6.1.0`, et TS 7 désactiverait
  les règles _type-checked_ dont dépend tout le typage fort.
- Electron épinglé en `^42.7.0` : à partir de 43.2.0, `setIgnoreMouseEvents` ne réduit plus
  la région d'entrée X11 et l'overlay avale tous les clics du bureau
  ([electron#52456](https://github.com/electron/electron/issues/52456)).
- Les pages de rendu sont découpées en trois : balisage, style, script. Leurs scripts sont
  désormais lus par ESLint et soumis aux mêmes limites que le reste — ils y échappaient
  entièrement.
- La politique de sécurité des pages n'autorise plus aucune source en ligne. Un
  gestionnaire d'événement glissé dans un libellé de tâche ne s'exécute plus.
- Les libellés passent par le catalogue et suivent la langue sans redémarrer :
  la fenêtre de réglages, celle du choix, et les bulles du compagnon.

### Fixed

- **L'intégration continue était rouge depuis le 13 août** et personne ne l'avait vu : le
  fichier de verrouillage avait divergé après une réinstallation. Trois des quatre travaux
  échouaient avant même de commencer.
- La porte de vulnérabilités échouait en permanence sur des avis sans correctif amont — une
  porte toujours rouge n'est plus une porte. Les exceptions sont désormais nommées,
  justifiées, et périment d'elles-mêmes.

- **Le compagnon ne pouvait pas dormir.** La boucle transmettait une inactivité toujours
  nulle au moteur : l'état de sommeil, son animation ralentie et son bâillement étaient
  inatteignables depuis leur écriture.
- **L'apparence se perdait au démarrage** une fois sur deux : elle était envoyée avant que
  la page n'ait branché ses écouteurs, et le compagnon restait un marqueur sans nom
  jusqu'à sa prochaine évolution. Les messages rares sont désormais conservés et rejoués.
- Le pack de test apparaissait dans la fenêtre de choix, à côté des vraies créatures : le
  choisir donnait un compagnon sans sprite, définitivement.
- Les écritures d'état se chevauchaient : un choix de compagnon pouvait être effacé par la
  minute de progression partie avant lui.
- Sans pack téléchargé, l'application refusait de démarrer alors qu'elle sait très bien
  fonctionner avec un marqueur.
- Un motif `.gitignore` non ancré masquait tout `packages/app/src/packs/` à knip, qui
  signalait alors comme morts des exports parfaitement utilisés.

### Removed

- Code inatteignable : la saisie à la souris qui n'a jamais été branchée, et une poignée
  d'exports que seul leur propre test maintenait en vie.
