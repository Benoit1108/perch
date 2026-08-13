# Spike S0

Code **jetable**, hors architecture et hors qualité. Il ne suit aucune des règles de
[../docs/QUALITY.md](../docs/QUALITY.md) et n'entrera pas dans le dépôt tel quel : à S1,
ce dossier est supprimé ou mis en `.gitignore`.

Sa seule raison d'être : répondre à des questions qu'aucun document ne peut trancher.

## Lancer

```bash
npm install
./fix-sandbox.sh        # une fois, demande les droits root

npm run start:debug     # HUD + contours des écrans et fenêtres
npm start               # sprite seul
npm run start:opaque    # diagnostic : fenêtre opaque et bordée
```

⚠️ Toujours passer par les scripts npm : ils contiennent `--ozone-platform=x11`, sans
lequel **rien ne s'affiche** (voir constat n°0).

L'extension GNOME s'installe à part et n'est active qu'après reconnexion de session :

```bash
./install-extension.sh
# puis déconnexion / reconnexion
gnome-extensions enable perch-sensors@perch.local
```

## Outils de diagnostic

| Fichier | Usage |
|---|---|
| `diag-minimal.js` | Fenêtre Electron la plus ordinaire possible. Si elle ne s'affiche pas, le problème est environnemental. |
| `diag-bisect.js` | Chaque option de `BrowserWindow` pilotée par une variable d'environnement, pour bissecter. `CAP=1` capture ce que peint le renderer. |

---

## Constats

### 0. `appendSwitch('ozone-platform')` ne fonctionne pas — le piège le plus coûteux

```js
app.commandLine.appendSwitch('ozone-platform', 'x11'); // SANS AUCUN EFFET
```

Electron choisit sa plateforme d'affichage **avant** d'exécuter `main.js`. L'appel ne lève
aucune erreur, le drapeau n'est jamais propagé aux process enfants, et l'application tourne
en client **Wayland natif** — où `setBounds` et `setAlwaysOnTop` sont ignorés silencieusement.

La panne qui en résulte est parfaitement trompeuse : la fenêtre existe, GNOME la liste dans
le dash, `isVisible()` renvoie `true`, `capturePage()` montre un rendu correct — et **rien
ne s'affiche à l'écran**.

Le drapeau doit être un vrai argument de ligne de commande (voir `package.json`) ou la
variable d'environnement `ELECTRON_OZONE_PLATFORM_HINT`. `main.js` avertit s'il manque.

### 1. `isVisible()` ne prouve rien

Il a renvoyé `true` pendant toute la durée de la panne ci-dessus. À ne jamais utiliser comme
signal de validation en S1. Les seuls signaux fiables observés :

| Question | Outil |
|---|---|
| La fenêtre est-elle réellement à l'écran ? | `xwininfo -id <id>` → `Map State: IsViewable` |
| Le renderer peint-il ? | `webContents.capturePage()` |
| La transparence est-elle négociée ? | `xwininfo` → `Depth: 32` |
| La fenêtre existe-t-elle côté X ? | `xwininfo -root -tree \| grep -i perch` |

État attendu quand tout va bien :

```
0x1000004 "Perch — spike"  3840x2160+0+0
  Map State: IsViewable
  Depth: 32
  Override Redirect State: yes
```

### 2. Mutter écrête la taille à la création

Une fenêtre demandée en 3840×2160 naît en **1919×1079** — un seul écran — quels que soient
`enableLargerThanScreen` et le backend d'affichage. Mais un `setBounds` appelé **après**
l'affichage est accepté et donne bien 3840×2160.

`syncBounds()` compare donc en permanence la géométrie réelle à la géométrie visée et
ré-applique tant qu'elles diffèrent.

### 3. `screen.getAllDisplays()` n'est pas fiable au démarrage

Selon le lancement, Electron ne connaît **qu'un seul écran** au moment de `app.whenReady()`
et émet `display-added` pour les autres ensuite. Deux lancements successifs ont donné
`3840x2160 @ 0,0` puis `1920x1080 @ 1041,1080`.

Une lecture unique au démarrage produit un overlay couvrant un tiers du bureau, **de façon
non déterministe**. Correctif : `syncBounds()` sur `display-added`, `display-removed`,
`display-metrics-changed`, plus une resynchronisation chaque seconde pendant 10 secondes.

### 4. `chrome-sandbox` se répare, ne se contourne pas

Après un `npm install` utilisateur, le helper SUID n'appartient pas à `root` et Chromium
refuse de démarrer. Le réflexe `--no-sandbox` déstabilise le process GPU (`exit_code=139`)
et mène à `GPU process isn't usable. Goodbye.`

`./fix-sandbox.sh` pose `root:root` + mode 4755. Il bascule sur `pkexec` quand aucun
terminal n'est disponible pour `sudo`.

> **L'application packagée n'a pas ce problème** — l'installateur pose les bonnes
> permissions. C'est une friction de développement uniquement. Ne jamais laisser
> `--no-sandbox` fuiter dans le paquet final (cf. section sécurité de la charte qualité).

Note : le bac à sable n'était **pas** la cause de l'écran vide. Fausse piste coûteuse ;
la vraie cause est le constat n°0.

### 5. Un crash GPU intermittent sur grande fenêtre transparente

Bissection sur `diag-bisect.js` : toutes les configurations passent sans crash, sauf
« grande fenêtre + transparente », qui produit un `exit_code=139` occasionnel. Sans
conséquence visible jusqu'ici, mais à surveiller en S2 — matériel Intel Iris Xe,
Mesa d'Ubuntu 26.04.

### 6. Electron coûte 327 Mo, pas 150-200 Mo

Mesure PSS (et non RSS, qui surcompte la mémoire partagée entre process), overlay 3840×2160
affichant un seul sprite animé :

| Process | PSS |
|---|---|
| principal | 158 Mo |
| renderer | 80 Mo |
| gpu-process | 27 Mo |
| zygotes | 31 Mo |
| utility + network | 25 Mo |
| **total** | **327 Mo** |

Le cadrage annonçait 150-200 Mo : c'était optimiste. C'est le plancher de Chromium, pas
quelque chose qu'on optimisera à la marge.

> À arbitrer avant S2. L'architecture en ports rend le remplacement du corps local, mais
> cette propriété s'érode dès que du code s'accumule dans `app`.

### 7. `setBounds` réinitialise la région d'entrée — ré-appliquer les clics traversants

**C'est la vraie cause de l'overlay qui avalait tous les clics du bureau.**

L'ordre suivant est piégeux et paraît pourtant naturel :

```js
overlay.setIgnoreMouseEvents(true);  // pose une région d'entrée de 1x1
overlay.setBounds(fullDesktop);      // ... et la détruit
```

La région d'entrée est attachée à la fenêtre X ; tout redimensionnement la remet à la
taille pleine. Or on redimensionne forcément après affichage (constat n°2). Résultat :
la fenêtre capte 100 % des clics du bureau.

`applyClickThrough()` est donc appelée **après chaque `setBounds`**, plus une fois en
confirmation à 1,2 s.

Vérification, sans avoir à risquer sa souris :

```bash
./check-input-shape.py
#   bounding : 3840x2160  → 8294400 px²
#   input    : 1x1        → 1 px²
#   ✅ les clics TRAVERSENT l'overlay
```

`xwininfo -shape` ne sert à rien ici : il ne rapporte que les formes *bounding* et *clip*,
jamais *input*. Le script appelle `XShapeGetRectangles` en ctypes via `libXext`.

### 7 bis. Régression Electron ≥ 43.2.0 sur les clics traversants

[electron#52456](https://github.com/electron/electron/issues/52456) : `setIgnoreMouseEvents`
ne réduirait plus la région d'entrée X11 à partir de 43.2.0 (cause amont Chromium 148 → 150,
issue ouverte et non assignée). Le paquet est épinglé en `^42.7.0` par prudence.

> ⚠️ **À revérifier en S1** : le correctif du constat n°7 ayant été trouvé *après* le
> passage en 42, on ne sait pas si Electron 43 fonctionnerait aussi avec le bon ordre
> d'appels. Rester épinglé sur une version ancienne a un coût de sécurité — c'est à
> trancher, pas à subir.

### 7 ter. ⛔ Sur Wayland, clics traversants et suivi du curseur s'excluent

**Le constat le plus important du sprint.** Sur GNOME Wayland, XWayland ne connaît la
position du curseur que lorsqu'une de ses surfaces reçoit les événements de pointeur.
Réduire la région d'entrée à 1×1 pour laisser passer les clics coupe cette source.

Mesuré par `check-tracking.sh`, souris en mouvement pendant chaque phase :

| Situation | Positions distinctes en 10 s |
|---|---|
| Sans overlay | **1** |
| Avec overlay, clics traversants | **2** — `(1921,280)` puis `(0,0)` |

Le `(0, 0)` est la signature documentée de Wayland : position globale inconnue faute de
focus pointeur. Et le test sans overlay montre que ça **ne vient pas de notre code**.

Ce qui avait trompé l'observation initiale : avec Electron 43 et sa région d'entrée pleine
(constat 7 bis), l'overlay captait *tous* les événements de pointeur. XWayland avait donc
une source permanente et le sprite suivait parfaitement — au prix de clics entièrement
bloqués, donc dans une configuration inutilisable.

**Conséquences :**

- Sur **Wayland**, l'extension GNOME devient **obligatoire** pour suivre la souris. Elle lit
  `global.get_pointer()` depuis le compositeur, qui connaît toujours la vraie position,
  indépendamment des régions d'entrée.
- Sur **X11** (session non-Wayland), `XQueryPointer` fonctionne normalement — repli valide.
- Sur **Windows**, `GetCursorPos` est global par nature — aucun problème.

Autre voie théorique écartée : le portail XDG `RemoteDesktop` peut fournir les événements
de pointeur, mais il impose une boîte de dialogue de consentement et un flux permanent —
disproportionné pour un compagnon de bureau.

> **L'invariant I7 du cadrage est révisé en conséquence.** Sans extension, sur Wayland, le
> pet vit toujours (déplacements, animations, bulles, XP) mais ne suit ni la souris ni les
> fenêtres. C'est une dégradation réelle, pas cosmétique.

### 8. Ne jamais lancer un overlay sans sortie de secours

Corollaire direct du constat précédent. `installEscapeHatches()` en pose trois,
indépendantes :

| # | Sortie | Remarque |
|---|---|---|
| 1 | Raccourci global `Ctrl+Alt+P` | échoue silencieusement si un autre programme le détient |
| 2 | Arrêt automatique (`PERCH_TIMEOUT`, 180 s par défaut) | le seul qui fonctionne même souris bloquée |
| 3 | PID affiché au démarrage | permet un `kill` depuis un terminal |

La n°2 est la seule qui protège vraiment : si la souris est captée, ni raccourci ni
terminal ne sont forcément accessibles.

**Autre piège, de ma seule responsabilité** : `cursor: none` en CSS sur un overlay plein
écran masque le curseur **partout sur le bureau**, pas seulement au-dessus du sprite.

### 9. Le screenshot D-Bus est refusé

`org.gnome.Shell.Screenshot` renvoie `AccessDenied` sur GNOME 50. Aucune vérification
visuelle automatisée par ce biais — à prendre en compte pour les tests e2e de S1, qui
devront passer par `capturePage()` et `xwininfo`.

---

## Choix de conception à retenir pour S2

Plutôt que de déplacer une petite fenêtre à chaque frame — ce que Wayland interdit et ce
qui saccade même sous X11 — on pose **une seule grande fenêtre transparente couvrant
l'union des écrans**, et on déplace le sprite à l'intérieur en CSS.

Validé par le spike : la fenêtre obtient bien 3840×2160 en profondeur 32, en
override-redirect. C'est plus simple, plus fluide, et ça reste le bon design en production.

## Questions tranchées

- [x] **L'overlay reste au-dessus de toutes les fenêtres**, natives comprises, et ne
      disparaît jamais. Vérifié à l'usage sur PhpStorm, terminal et bureau.
- [x] **Les bulles de dialogue s'affichent correctement** par-dessus les fenêtres.
- [x] **L'overlay obtient bien 3840×2160 en profondeur 32**, en override-redirect.
- [x] **Les clics traversent** l'overlay. Vérifié à la mesure (`check-input-shape.py`,
      région d'entrée 1×1 px) puis confirmé à l'usage : dock, onglets, PhpStorm.
- [x] **Le repli XWayland ne peut PAS suivre le curseur** tout en laissant passer les
      clics. Les deux s'excluent (constat 7 ter). → **L'extension GNOME est obligatoire
      sur Wayland**, pas optionnelle.

## Questions encore ouvertes

- [ ] L'extension GNOME se charge-t-elle et répond-elle sur D-Bus après reconnexion&nbsp;?
      **Désormais bloquant** : c'est le seul chemin viable pour le curseur sur Wayland.
- [ ] Electron 43 fonctionnerait-il avec le bon ordre d'appels&nbsp;? (le pin `^42.7.0` a
      peut-être été posé pour rien — coût de sécurité à trancher, pas à subir)
