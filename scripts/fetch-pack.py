#!/usr/bin/env python3
"""
Fabrique le pack de creatures par defaut.

INVARIANT I5 — aucun sprite n'est committe. Ce depot ne contient qu'une RECETTE
(`scripts/pack-source.json`) et ce script : les images sont telechargees chez un tiers,
converties en frames PNG, et deposees dans un dossier ignore par git.

Le manifeste est GENERE plutot qu'ecrit a la main. Il decrit les fichiers reellement
produits — une espece absente de la source ne laisse pas une entree qui pointe vers rien.

Prerequis : Python 3.10+, Pillow, curl.
Usage     : python3 scripts/fetch-pack.py [--out <dossier>] [--frames <n>]
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow manquant. Installer avec : pip install Pillow")

# La console Windows repond en cp1252 : le moindre caractere hors de cette table fait
# echouer un simple `print`, et la construction s'arrete sur une fleche.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

RACINE = Path(__file__).resolve().parent.parent


def durees(gif: Image.Image) -> list[int]:
    """Duree de chaque image du GIF, en millisecondes."""
    valeurs: list[int] = []
    index = 0
    while True:
        try:
            gif.seek(index)
        except EOFError:
            break
        # 100 ms : valeur par defaut des navigateurs quand un GIF ne declare rien.
        valeurs.append(int(gif.info.get("duration", 100)) or 100)
        index += 1
    return valeurs


def echantillon(total: int, voulu: int) -> list[int]:
    """
    Indices repartis sur TOUTE la boucle.

    Prendre les n premieres images couperait l'animation en plein milieu : au bouclage,
    le sprite sauterait brutalement de son point d'arret a son point de depart.
    """
    if total <= voulu:
        return list(range(total))
    return [round(i * total / voulu) for i in range(voulu)]


def cadre_utile(images: list[Image.Image]) -> tuple[int, int, int, int]:
    """
    Union des zones non transparentes de toute la sequence.

    Recadrer chaque image sur SON contenu detruirait l'animation : le balancement du
    sprite disparaitrait, chaque image etant recollee au meme endroit. On recadre donc
    toute la sequence sur la MEME boite — le vide constant du GIF d'origine s'en va, le
    mouvement reste.
    """
    boites = [boite for boite in (image.getbbox() for image in images) if boite is not None]
    if not boites:
        return (0, 0, images[0].width, images[0].height)

    return (
        min(boite[0] for boite in boites),
        min(boite[1] for boite in boites),
        max(boite[2] for boite in boites),
        max(boite[3] for boite in boites),
    )


def extraire(gif_path: Path, sortie: Path, voulu: int, cote: int) -> tuple[int, float]:
    """Ecrit les frames PNG. Renvoie (nombre de frames, images par seconde)."""
    with Image.open(gif_path) as gif:
        toutes = durees(gif)
        indices = echantillon(len(toutes), voulu)
        images = []
        for index in indices:
            gif.seek(index)
            images.append(gif.convert("RGBA"))

    boite = cadre_utile(images)
    sortie.mkdir(parents=True, exist_ok=True)

    for rang, image in enumerate(images):
        utile = image.crop(boite)

        # Reduction seulement : agrandir un sprite de 60 px pour remplir la boite le
        # rendrait flou sans rien apporter.
        if utile.width > cote or utile.height > cote:
            utile.thumbnail((cote, cote), Image.LANCZOS)

        # Alignement en BAS et au centre : le moteur ancre le compagnon par les PIEDS, et
        # un sprite centre verticalement flotterait au-dessus de sa surface.
        toile = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
        toile.paste(utile, ((cote - utile.width) // 2, cote - utile.height), utile)
        toile.save(sortie / f"frame_{rang:02d}.png")

    duree_totale = sum(toutes) / 1000 or 1.0
    # Borne BASSE indispensable : un GIF de plusieurs secondes echantillonne en huit
    # images donne une cadence qui s'arrondit a 0.0, que le schema refuse. Le manifeste
    # serait alors ignore en silence au demarrage, sans le moindre diagnostic.
    fps = min(60.0, max(0.5, round(len(indices) / duree_totale, 2)))
    return len(indices), fps


def telecharger(url: str, cible: Path) -> bool:
    return subprocess.run(["curl", "-sf", "-o", str(cible), url], check=False).returncode == 0


def construire(recette: dict, racine_sortie: Path, voulu: int) -> dict:
    cote = int(recette.get("canvas", 96))
    lignes = []
    manques: list[str] = []

    for ligne in recette["lines"]:
        stades = []
        for stade in ligne["stages"]:
            espece = stade["source"]
            url = f"{recette['source']}/{espece}.gif"
            print(f"  {stade['id']:<14} {espece}")

            with tempfile.NamedTemporaryFile(suffix=".gif", delete=False) as tampon:
                gif_path = Path(tampon.name)
            try:
                if not telecharger(url, gif_path):
                    manques.append(f"{stade['id']} ({url})")
                    continue
                dossier = racine_sortie / "sprites" / stade["id"]
                nombre, fps = extraire(gif_path, dossier, voulu, cote)
            finally:
                gif_path.unlink(missing_ok=True)

            frames = [f"sprites/{stade['id']}/frame_{i:02d}.png" for i in range(nombre)]
            stades.append(
                {
                    "id": stade["id"],
                    "name": stade["name"],
                    "sprite": frames[0],
                    "fromLevel": stade["fromLevel"],
                    "clips": {"repos": {"frames": frames, "fps": fps}},
                }
            )

        # Une lignee amputee de son premier stade serait refusee par le chargeur : mieux
        # vaut ne pas l'ecrire que produire un manifeste invalide.
        if stades and stades[0]["fromLevel"] == 1:
            lignes.append({"id": ligne["id"], "stages": stades})
        else:
            manques.append(f"lignee {ligne['id']} (aucun stade de depart)")

    if manques:
        print("\nAbsents :", ", ".join(manques), file=sys.stderr)

    return {
        "schemaVersion": 1,
        "id": recette["id"],
        "name": recette["name"],
        "license": recette["license"],
        "lines": lignes,
    }


def main() -> int:
    parseur = argparse.ArgumentParser(description="Telecharge et fabrique le pack par defaut.")
    parseur.add_argument("--out", type=Path, default=RACINE / "packs")
    parseur.add_argument("--frames", type=int, default=None)
    options = parseur.parse_args()

    recette = json.loads((RACINE / "scripts" / "pack-source.json").read_text(encoding="utf8"))
    voulu = options.frames or int(recette.get("frames", 8))
    racine_sortie = options.out / recette["id"]

    # Reconstruction complete : garder d'anciennes frames laisserait des images d'une
    # espece retiree de la recette, invisibles et jamais nettoyees.
    if racine_sortie.exists():
        shutil.rmtree(racine_sortie)
    racine_sortie.mkdir(parents=True)

    print(f"Pack {recette['name']} -> {racine_sortie}")
    manifeste = construire(recette, racine_sortie, voulu)

    if not manifeste["lines"]:
        print("Aucune lignee produite : rien n'a pu etre telecharge.", file=sys.stderr)
        return 1

    chemin = racine_sortie / "manifest.json"
    chemin.write_text(json.dumps(manifeste, ensure_ascii=False, indent=2) + "\n", encoding="utf8")

    stades = sum(len(ligne["stages"]) for ligne in manifeste["lines"])
    print(f"\n{len(manifeste['lines'])} lignees, {stades} stades, {voulu} frames chacun.")
    print("Validation par le schema reel : npm run pack:fetch s'en charge.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
