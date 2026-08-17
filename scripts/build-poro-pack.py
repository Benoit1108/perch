#!/usr/bin/env python3
"""
Fabrique le pack « poro » : quatre stades, animes, et son manifeste.

Le pack atterrit chez l'utilisateur, PAS dans le depot (invariant I5) : ici on ne
versionne que la recette. C'est exactement le meme geste que `pack:fetch` pour les
Pokemon, a ceci pres que les images ne sont pas telechargees mais dessinees.

Usage : python3 scripts/build-poro-pack.py [--out DOSSIER]
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from poro_dessin import dessiner
except ImportError:
    sys.exit("Pillow manquant. Installer avec : pip install Pillow")

# Les paliers. Quatre stades demandent une marche de plus que les lignees a trois : le
# royaume se merite.
STADES = [
    {"id": "poro-1", "nom": "Poro", "niveau": 1},
    {"id": "poro-2", "nom": "Poro moustachu", "niveau": 16},
    {"id": "poro-3", "nom": "Gros Poro", "niveau": 36},
    {"id": "poro-4", "nom": "Roi Poro", "niveau": 60},
]

LICENCE = (
    "Oeuvre originale de ce depot, inspiree de l'univers de League of Legends "
    "(Riot Games). Fan-art, usage non commercial."
)

# Les animations. `repos` respire, `marche` fait aussi bouger les pattes, `sommeil` ferme
# les yeux. `chute` est absente : le moteur retombe alors sur `repos`, ce qui vaut mieux
# qu'une pose inventee pour un etat qui dure une demi-seconde.
CLIPS = {
    "repos": {"fps": 4, "poses": [(0.0, False, 0.0), (0.5, False, 0.0), (1.0, False, 0.0), (0.5, False, 0.0)]},
    "marche": {
        "fps": 8,
        "poses": [(0.2, False, 0.0), (0.5, False, 0.25), (0.2, False, 0.5), (0.5, False, 0.75)],
    },
    "sommeil": {"fps": 2, "poses": [(0.0, True, 0.0), (1.0, True, 0.0)]},
}


def dossier_utilisateur() -> Path:
    """L'emplacement des packs, par systeme — le meme que celui de `docs/PACKS.md`."""
    maison = Path.home()
    if platform.system() == "Windows":
        return Path(os.environ.get("APPDATA", maison)) / "perch" / "packs"
    if platform.system() == "Darwin":
        return maison / "Library" / "Application Support" / "perch" / "packs"
    return maison / ".config" / "perch" / "packs"


def ecrire_stade(dossier: Path, stade: dict) -> dict:
    """Ecrit les images d'un stade, et renvoie sa description pour le manifeste."""
    rang = int(stade["id"].rsplit("-", 1)[1])
    sprites = dossier / "sprites"
    sprites.mkdir(parents=True, exist_ok=True)

    clips = {}
    for nom, clip in CLIPS.items():
        images = []
        for i, (souffle, dodo, pas) in enumerate(clip["poses"]):
            chemin = f"sprites/{stade['id']}-{nom}-{i}.png"
            dessiner(rang, souffle, dodo, pas).save(dossier / chemin)
            images.append(chemin)
        clips[nom] = {"frames": images, "fps": clip["fps"]}

    return {
        "id": stade["id"],
        "name": stade["nom"],
        # Pas de `species` : cette creature n'existe dans aucune autre application, elle
        # n'a donc rien a declarer au vocabulaire d'echange.
        "sprite": clips["repos"]["frames"][0],
        "fromLevel": stade["niveau"],
        "clips": clips,
    }


def fabriquer(sortie: Path) -> int:
    stades = [ecrire_stade(sortie, stade) for stade in STADES]

    manifeste = {
        "schemaVersion": 1,
        "id": "poro",
        "name": "Poros",
        "license": LICENCE,
        "lines": [{"id": "poro", "stages": stades}],
    }
    (sortie / "manifest.json").write_text(
        json.dumps(manifeste, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
    )

    images = sum(len(clip["frames"]) for stade in stades for clip in stade["clips"].values())
    print(f"{sortie} : {len(stades)} stades, {images} images.")
    print(f"Verifier avec : npm run pack:validate -- {sortie}")
    return 0


def main() -> int:
    parseur = argparse.ArgumentParser(description="Fabrique le pack poro.")
    parseur.add_argument(
        "--out",
        type=Path,
        default=dossier_utilisateur() / "poro",
        help="dossier du pack (defaut : le dossier de packs de l'utilisateur)",
    )
    return fabriquer(parseur.parse_args().out)


if __name__ == "__main__":
    sys.exit(main())
