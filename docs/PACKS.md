# Fabriquer un compagnon

Perch ne connaît aucune créature. Le moteur ne sait que lire des **packs** : un dossier
d'images et un manifeste qui décrit les stades d'évolution. Le pack livré, celui qu'on
télécharge en choisissant une espèce, et celui qu'on dessine soi-même remplissent le même
format — il n'y a pas de chemin privilégié.

C'est ce qui permet d'avoir pour compagnon une créature qui n'a jamais existé dans un jeu :
un Poro, une mascotte d'entreprise, un personnage inventé. Avec ses propres évolutions.

## Où poser son pack

Un dossier par pack, dans le dossier de l'utilisateur :

| Système | Emplacement                                  |
| ------- | -------------------------------------------- |
| Linux   | `~/.config/perch/packs/`                     |
| Windows | `%APPDATA%\perch\packs\`                     |
| macOS   | `~/Library/Application Support/perch/packs/` |

```
packs/
└── poro/
    ├── manifest.json
    └── sprites/
        ├── poro-1.png
        ├── poro-2.png
        └── poro-3.png
```

Perch relit ce dossier au démarrage, et à chaque fois qu'une créature est adoptée. Un pack
posé pendant que l'application tourne apparaît donc au prochain lancement.

Un pack invalide est **ignoré en silence** plutôt que fatal : un fichier abîmé ne doit pas
empêcher l'application de démarrer avec les autres. D'où le validateur, plus bas.

## Le manifeste

```json
{
  "schemaVersion": 1,
  "id": "poro",
  "name": "Poro",
  "license": "Fan-art. Riot Games, usage non commercial.",
  "lines": [
    {
      "id": "poro",
      "stages": [
        {
          "id": "poro-1",
          "name": "Poro",
          "sprite": "sprites/poro-1.png",
          "fromLevel": 1,
          "clips": {
            "repos": { "frames": ["sprites/poro-1.png"], "fps": 1 }
          }
        },
        {
          "id": "poro-2",
          "name": "Poro joufflu",
          "sprite": "sprites/poro-2.png",
          "fromLevel": 16
        },
        {
          "id": "poro-3",
          "name": "Poro royal",
          "sprite": "sprites/poro-3.png",
          "fromLevel": 36
        }
      ]
    }
  ]
}
```

### Les champs

| Champ           | Obligatoire | Règle                                                                                                            |
| --------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | oui         | `1`                                                                                                              |
| `id`            | oui         | minuscules, chiffres, tirets. Unique parmi les packs installés                                                   |
| `name`          | oui         | libre                                                                                                            |
| `license`       | oui         | texte libre, mais **non vide** — un pack sans licence explicite est un risque qu'on refuse de prendre en silence |
| `lines`         | oui         | au moins une lignée                                                                                              |

Une **lignée** (`line`) est une créature et toutes ses formes. Un pack peut en contenir
plusieurs : c'est ce que fait le pack livré, qui propose six créatures.

Un **stade** (`stage`) est une forme :

| Champ       | Obligatoire | Règle                                                                                                                                                                                             |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | oui         | minuscules, chiffres, tirets. Unique dans le pack                                                                                                                                                 |
| `name`      | oui         | ce qui s'affiche à l'écran                                                                                                                                                                        |
| `sprite`    | oui         | image fixe, pour la fenêtre de choix                                                                                                                                                              |
| `fromLevel` | oui         | 1 à 100. **Un stade doit valoir 1**, et deux stades ne peuvent pas partager le même niveau                                                                                                        |
| `clips`     | non         | animations, voir plus bas                                                                                                                                                                         |
| `species`   | non         | identifiant d'espèce partagé avec les autres applications compagnon — utile seulement pour la boîte d'échange. Une créature originale n'a personne avec qui échanger, et n'a donc rien à déclarer |

### L'évolution

Elle n'a pas d'autre déclaration que `fromLevel`. Le compagnon gagne de l'expérience en
travaillant ; quand il franchit un palier, Perch joue la mise en scène — halo, changement
de forme, phrase — et le nouveau stade reste.

Trois stades à 1, 16 et 36 donnent le rythme du pack livré. Rien n'oblige à s'y tenir : un
seul stade fait une créature qui ne change jamais, cinq stades font une progression plus
fine. Le seul interdit est de sauter le niveau 1, ce qui laisserait la créature sans
apparence au démarrage.

### Les animations

`clips` peut décrire quatre boucles, toutes facultatives :

| Nom       | Quand          |
| --------- | -------------- |
| `repos`   | immobile       |
| `marche`  | en déplacement |
| `chute`   | en l'air       |
| `sommeil` | endormi        |

```json
"clips": {
  "repos": { "frames": ["sprites/poro-1a.png", "sprites/poro-1b.png"], "fps": 6 },
  "marche": { "frames": ["sprites/poro-marche-0.png", "sprites/poro-marche-1.png"], "fps": 10 }
}
```

Une boucle absente est remplacée par la plus proche disponible — un pack qui ne fournit que
`repos` fonctionne, c'est le cas du pack livré. `fps` va jusqu'à 60. Une seule image dans
`frames` donne un sprite fixe.

Un **GIF animé** est plus simple encore : une seule image dans `frames`, et le rendu joue
l'animation lui-même. C'est ce que fait une créature téléchargée depuis le catalogue.

## Les images

- Formats acceptés : `png`, `gif`, `webp`.
- Chemins **relatifs au dossier du pack**, sans `..` : `sprites/poro-1.png`. Un manifeste
  est une donnée externe, pas du code de confiance ; un chemin qui remonte est refusé.
- **Fond transparent.** Le compagnon vit sur le bureau, pas dans un cadre.
- **Détourées au plus juste, et calées en bas.** Le point d'ancrage est aux pieds de la
  créature : c'est ce qui la pose sur le bord d'une fenêtre plutôt que de la faire flotter.
- Environ **96 pixels de haut**. Les images plus petites sont affichées à leur taille
  native, jamais agrandies — un sprite de 40 pixels étiré à 96 est une bouillie. Les plus
  grandes sont réduites.
- Le rendu est en `pixelated` : le pixel art reste net, mais une illustration lissée aura
  meilleure allure exportée à la taille finale.

## Vérifier son pack

```bash
npm run pack:validate -- ~/.config/perch/packs/poro
```

Le validateur utilise le **schéma que l'application utilisera vraiment**, et vérifie en plus
que chaque image référencée existe sur le disque. Une erreur ici est une créature qui
n'apparaîtrait pas, sans un mot, au prochain lancement.

## Un exemple complet : les poros

`scripts/build-poro-pack.py` fabrique un pack entier — quatre stades, animés, avec son
manifeste — sans télécharger la moindre image : elles sont **dessinées**.

```bash
npm run pack:poro          # → dans le dossier de packs de l'utilisateur
npm run pack:poro -- --out /chemin/de/mon/choix
npm run pack:poro -- --force   # écrase un pack dessiné à la main
```

La commande **refuse d'écraser un pack qu'elle n'a pas produit**. Un pack dessiné à la main
vit dans le même dossier, sous les mêmes noms de fichiers : sans ce garde, une relance
remplacerait le travail d'un illustrateur par des images générées, et le dépôt n'en garde
aucune copie (invariant I5).

La lignée va du poro ordinaire au Roi Poro, en passant par la moustache de Braum et la
grosse monture — quatre paliers, aux niveaux 1, 16, 36 et 60. C'est une **œuvre originale**
et non une image reprise : les références disponibles étaient des captures de jeu et des
rendus 3D, de cinquante à cinq cents pixels, sur des fonds chargés. Détourées, elles
auraient donné une lignée dont le deuxième stade est plus petit et plus flou que le
premier — l'inverse de ce qu'une évolution doit montrer.

À lire comme un modèle : `poro_dessin.py` tient le dessin, `build-poro-pack.py` décline les
poses en animations (`repos`, `marche`, `sommeil`) et écrit le manifeste. La même structure
convient à un pack dessiné à la main, où les poses viennent d'un fichier plutôt que d'un
tracé.

## Ce que le dépôt ne contient pas

Aucun sprite n'est versionné, jamais — c'est l'invariant I5. Le dépôt ne contient que la
recette et les scripts qui vont chercher les images. Un pack fabriqué à la main vit chez son
auteur, ou se distribue à part ; il n'a pas vocation à entrer ici.
