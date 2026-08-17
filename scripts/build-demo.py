#!/usr/bin/env python3
"""
Assemble la demonstration en GIF anime.

Les images capturees ne contiennent QUE le compagnon : l'overlay est transparent, et rien
ne permet a une application de photographier le bureau. On compose donc un bureau de
substitution — sobre, avec les memes fenetres que celles fournies au moteur, pour qu'on
voie le compagnon se percher sur leurs bords.

C'est aussi plus honnete qu'une vraie capture d'ecran : personne ne veut publier le
contenu de ses fenetres dans un README.

Prerequis : Python 3.10+, Pillow.
Usage     : python3 scripts/build-demo.py [--out assets/demo.gif]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow manquant. Installer avec : pip install Pillow")

RACINE = Path(__file__).resolve().parent.parent
CAPTURES = RACINE / "release" / "demo"

# La camera suit le compagnon : cadree sur tout l'ecran il ferait quarante pixels de haut
# et ne montrerait rien. On decoupe une fenetre autour de lui, qu'on agrandit ensuite.
CADRE = (880, 495)
LARGEUR = 800
# Lissage de la camera : elle rattrape le compagnon sans copier ses saccades.
SUIVI = 0.12

FOND = (24, 22, 36)
BARRE = (16, 15, 26)
FENETRE = (38, 35, 56)
BORD = (92, 84, 130)
LEGENDE = (238, 235, 247)


def police(taille: int) -> ImageFont.FreeTypeFont:
    """Une police lisible, ou celle par defaut si le systeme n'en propose aucune."""
    for chemin in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if Path(chemin).exists():
            return ImageFont.truetype(chemin, taille)
    return ImageFont.load_default()


def bureau(taille: tuple[int, int], fenetres: list[dict]) -> Image.Image:
    """
    Un bureau de substitution.

    Les memes rectangles que ceux donnes au moteur : le compagnon se perche sur leurs
    bords hauts, et sans eux le GIF montrerait quelqu'un marchant sur du vide.
    """
    fond = Image.new("RGBA", taille, (*FOND, 255))
    dessin = ImageDraw.Draw(fond)

    # La barre systeme, qui explique pourquoi il ne monte jamais tout en haut.
    dessin.rectangle([0, 0, taille[0], 32], fill=(*BARRE, 255))

    for f in fenetres:
        boite = [f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"]]
        dessin.rounded_rectangle(boite, radius=10, fill=(*FENETRE, 255), outline=(*BORD, 255))
        dessin.line([boite[0] + 10, f["y"], boite[2] - 10, f["y"]], fill=(*BORD, 255), width=3)

    return fond


def legender(image: Image.Image, texte: str, fonte: ImageFont.FreeTypeFont) -> None:
    """La legende va EN HAUT : en bas elle recouvrirait le compagnon, qui vit au sol."""
    dessin = ImageDraw.Draw(image)
    boite = dessin.textbbox((0, 0), texte, font=fonte)
    largeur, hauteur = boite[2] - boite[0], boite[3] - boite[1]
    x = (image.width - largeur) // 2
    y = 22

    dessin.rounded_rectangle(
        [x - 20, y - 12, x + largeur + 20, y + hauteur + 14], radius=8, fill=(12, 11, 20, 220)
    )
    dessin.text((x, y), texte, font=fonte, fill=(*LEGENDE, 255))


def cadrer(centre: tuple[float, float], taille: tuple[int, int]) -> tuple[int, int, int, int]:
    """Le decoupage autour du compagnon, ramene de force dans l'ecran."""
    x = min(max(round(centre[0]) - CADRE[0] // 2, 0), taille[0] - CADRE[0])
    y = min(max(round(centre[1]) - CADRE[1] // 2, 0), taille[1] - CADRE[1])
    return (x, y, x + CADRE[0], y + CADRE[1])


def assembler(sortie: Path) -> int:
    scenario_path = CAPTURES / "scenario.json"
    if not scenario_path.exists():
        print(f"Aucune capture dans {CAPTURES}. Lancer d'abord `npm run demo:record`.", file=sys.stderr)
        return 1

    scenario = json.loads(scenario_path.read_text(encoding="utf8"))
    captures = sorted(p for p in CAPTURES.glob("*.png"))
    if not captures:
        print("Aucune image capturee.", file=sys.stderr)
        return 1

    with Image.open(captures[0]) as premiere:
        taille = premiere.size

    decor = bureau(taille, scenario["fenetres"])
    fonte = police(round(20 * LARGEUR / CADRE[0]) + 6)

    # Chaque acte porte sa legende sur toutes ses images.
    titres: list[str] = []
    for acte in scenario["actes"]:
        titres.extend([acte["titre"]] * acte["images"])

    positions = scenario.get("positions", [])
    camera: list[float] | None = None
    images = []

    for rang, capture in enumerate(captures):
        # Le compagnon est ancre par les PIEDS : on vise un peu au-dessus pour le cadrer.
        vu = positions[rang] if rang < len(positions) else None
        cible = [vu["x"], vu["y"] - 90] if vu else [taille[0] / 2, taille[1] / 2]

        if camera is None:
            camera = cible
        else:
            camera = [c + (v - c) * SUIVI for c, v in zip(camera, cible)]

        with Image.open(capture) as brute:
            scene = decor.copy()
            scene.alpha_composite(brute.convert("RGBA"))

        scene = scene.crop(cadrer((camera[0], camera[1]), taille))
        scene = scene.resize((LARGEUR, round(LARGEUR * CADRE[1] / CADRE[0])), Image.LANCZOS)

        if rang < len(titres):
            legender(scene, titres[rang], fonte)

        images.append(scene.convert("P", palette=Image.ADAPTIVE, colors=128))

    sortie.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(
        sortie,
        save_all=True,
        append_images=images[1:],
        duration=round(1000 / scenario["fps"]),
        loop=0,
        optimize=True,
    )

    poids = sortie.stat().st_size / 1024 / 1024
    print(f"{sortie} : {len(images)} images, {poids:.1f} Mo")
    return 0


def main() -> int:
    parseur = argparse.ArgumentParser(description="Assemble la demonstration en GIF.")
    parseur.add_argument("--out", type=Path, default=RACINE / "assets" / "demo.gif")
    return assembler(parseur.parse_args().out)


if __name__ == "__main__":
    sys.exit(main())
