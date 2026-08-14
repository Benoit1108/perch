# Boîte d'échange

Deux applications compagnon qui ne se connaissent pas se passent des créatures par un
dossier partagé. Aucune n'a besoin que l'autre tourne : **le fichier est le protocole**.

Ce document est la spécification à implémenter des deux côtés. La partie `perch` est faite
(`packages/core/src/exchange/`, `packages/app/src/exchange/`) ; la partie `claude-pokemon`
reste à écrire.

## Où

| Système       | Chemin                                              |
| ------------- | --------------------------------------------------- |
| Linux / macOS | `${XDG_DATA_HOME:-$HOME/.local/share}/creature-box` |
| Windows       | `%APPDATA%\creature-box`                            |

Le nom est **neutre** : la boîte n'appartient à aucune des deux applications. Rangée chez
l'une, elle disparaîtrait en la désinstallant.

Le dossier contient un `LISEZ-MOI.txt` pour qui l'ouvrirait sans savoir ce que c'est, et un
fichier `<id>.json` par créature en attente.

## Quoi

```json
{
  "envelopeVersion": 1,
  "id": "fantominus",
  "depositedAt": "2026-08-14T12:00:00Z",
  "origin": { "app": "claude-pokemon", "version": "1.0.0-beta.7" },
  "creature": {
    "species": "gastly",
    "name": "Fantominus",
    "level": 20,
    "xp": 16079810,
    "shiny": false
  },
  "note": "Il vient de la statusline."
}
```

| Champ     | Obligatoire | Règle                                                      |
| --------- | ----------- | ---------------------------------------------------------- |
| `id`      | oui         | `[a-z0-9-]+`, 64 max. Il sert de nom de fichier.           |
| `species` | oui         | `[a-z0-9-]+`. **L'identifiant Showdown**, voir ci-dessous. |
| `name`    | oui         | Le nom tel que l'expéditeur l'affiche.                     |
| `level`   | oui         | Entier de 1 à 100.                                         |
| `xp`      | non         | **Informatif seulement.**                                  |
| `shiny`   | non         | `false` par défaut.                                        |
| `note`    | non         | 280 caractères, un mot laissé à qui retirera.              |

### L'espèce est le seul vocabulaire partagé

`claude-pokemon` porte déjà un `showdown_id` sur chacun de ses stades ; le manifeste de
pack de `perch` porte un champ `species` de même nature, renseigné à la fabrication. C'est
la seule chose que les deux projets nomment pareil, et donc la seule qui puisse voyager.

Une application qui ne sait pas loger l'espèce reçue doit le **dire**, pas faire semblant.

### Le niveau voyage, l'expérience non

Les courbes n'ont rien de comparable : seize millions de points valent le niveau 20 d'un
côté, quelques milliers de l'autre. Transporter l'expérience telle quelle donnerait un
compagnon niveau 100 ou niveau 1 selon le sens du voyage.

Celui qui reçoit **recalcule sa propre expérience** à partir du niveau. `xp` n'est joint
que pour l'affichage et la curiosité.

## Comment

**Déposer** — écrire `<id>.json` de façon atomique : fichier temporaire, puis renommage.
Un lecteur ne doit jamais tomber sur un JSON à moitié écrit.

**Lister** — lire tous les `*.json`. Un fichier illisible ou d'une autre version est
**ignoré**, jamais fatal : le dossier est partagé, n'importe quoi peut y atterrir, et un
intrus ne doit pas cacher les créatures qui l'entourent.

**Retirer** — commencer par **renommer** le fichier vers un nom privé, puis le lire, puis
le supprimer. Le renommage est la seule opération que le système garantit atomique : deux
applications qui retirent en même temps ne peuvent pas obtenir la même créature, la
seconde voit son renommage échouer. Lire d'abord et supprimer ensuite dupliquerait la
créature.

```bash
# Retrait, côté shell
reserve="$boite/.$$-$RANDOM.retrait"
if mv "$boite/$id.json" "$reserve" 2>/dev/null; then
  enveloppe=$(cat "$reserve")
  rm -f "$reserve"
else
  echo "Trop tard : quelqu'un l'a prise avant."
fi
```

## Ce que `perch` en fait

- **Déposer** envoie une COPIE : le compagnon reste ici. Rien ne se perd.
- **Adopter** échange : le compagnon d'ici part dans la boîte avant que l'autre n'arrive,
  donc il reste toujours récupérable.

Aucun des deux gestes n'est destructif — un clic ne doit jamais faire disparaître des
semaines de progression.
