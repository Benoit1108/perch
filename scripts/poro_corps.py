"""
Le corps commun des poros : ce que les quatre stades partagent.

Le trace se fait en GRAND puis se reduit : Pillow ne lisse aucune forme, et un cercle
trace directement a quarante-huit pixels a des bords en escalier. On reduit depuis quatre
fois la taille pour des bords propres, et le pack remonte ensuite en NEAREST pour garder
le grain de pixel que le rendu attend (`image-rendering: pixelated`).

Le dessin est le fruit de trois corrections successives, toutes faites en COMPARANT a
l'image de reference plutot qu'en raisonnant :

  1. de gros yeux ronds a reflet blanc et des cornes dressees donnaient une peluche
     generique — ce sont des yeux SOMBRES sans reflet et des oreilles TOMBANTES ;
  2. un corps en oeuf, plus haut que large, donnait un fantome — le poro est un pain
     ROND, nettement plus large que haut, et son visage occupe le tiers superieur ;
  3. la fourrure dessinee en touffes pointues se lisait comme une rangee de dents — elle
     ne se dessine pas, elle BOSSELLE le contour, et l'ombre qui donne le volume doit
     etre floutee, sans quoi elle barre le visage comme un masque.
"""

from __future__ import annotations

import math

from PIL import Image, ImageDraw, ImageFilter

E = 4        # echelle de trace
T = 48       # taille logique du sprite
FINAL = 96   # taille livree, celle qu'attend le rendu

BLANC = (250, 252, 255)
OMBRE = (208, 226, 241)
BLEU = (176, 203, 227)
GIVRE = (206, 231, 247)
GIVRE_O = (156, 194, 224)
BARBE = (212, 226, 242)
OREILLE = (166, 136, 102)
OREILLE_S = (122, 96, 70)
PATTE = (176, 152, 124)
TRAIT = (52, 56, 78)
OEIL = (30, 34, 62)
OEIL_C = (96, 116, 164)
LANGUE = (230, 124, 138)
POIL = (44, 40, 52)
OR = (232, 190, 84)
OR_S = (186, 142, 52)
RUBIS = (206, 62, 48)
CAPE = (176, 44, 44)


def toile() -> Image.Image:
    return Image.new("RGBA", (T * E, T * E), (0, 0, 0, 0))


def cerner(im: Image.Image, epaisseur: int = E) -> Image.Image:
    """Un trait sombre autour de la silhouette.

    Sans lui, une creature blanche disparait sur un fond clair — et l'overlay est pose sur
    le bureau de quelqu'un, dont on ne connait ni le fond d'ecran ni le theme.
    """
    alpha = im.split()[3]
    contour = Image.new("RGBA", im.size, TRAIT)
    contour.putalpha(alpha.filter(ImageFilter.MaxFilter(epaisseur * 2 + 1)))
    contour.alpha_composite(im)
    return contour


def bosses(d, boite: list[int], couleur, nombre: int = 9) -> None:
    """La fourrure du bas : de simples cercles poses sur le bord, qui rendent la
    silhouette irreguliere."""
    largeur = boite[2] - boite[0]
    for i in range(nombre):
        t = (i + 0.5) / nombre
        x = boite[0] + largeur * t
        y = boite[3] - 2 * E - abs(math.cos(t * math.pi)) * 3 * E
        r = (2.5 + 1.5 * math.sin(t * math.pi)) * E
        d.ellipse([x - r, y - r, x + r, y + r], fill=couleur)


def corps(im: Image.Image, boite: list[int], clair, ombre, bas) -> None:
    """La boule et son volume. L'ombre est FLOUTEE puis masquee par le corps."""
    d = ImageDraw.Draw(im)
    d.ellipse(boite, fill=clair)
    bosses(d, boite, clair)

    hauteur = boite[3] - boite[1]
    couche = Image.new("RGBA", im.size, (0, 0, 0, 0))
    dessin = ImageDraw.Draw(couche)
    dessin.ellipse(
        [boite[0] - 2 * E, boite[1] + hauteur * 46 // 100, boite[2] + 2 * E, boite[3] + 6 * E], fill=ombre
    )
    dessin.ellipse(
        [boite[0] + 3 * E, boite[1] + hauteur * 70 // 100, boite[2] - 3 * E, boite[3] + 6 * E], fill=bas
    )
    couche = couche.filter(ImageFilter.GaussianBlur(3 * E))

    masque = Image.new("L", im.size, 0)
    dessin_masque = ImageDraw.Draw(masque)
    dessin_masque.ellipse(boite, fill=255)
    bosses(dessin_masque, boite, 255)
    im.paste(couche, (0, 0), Image.composite(couche.split()[3], Image.new("L", im.size, 0), masque))


def oreilles(d, cx: int, y: float, ecart: int, longueur: int = 7) -> None:
    """PETITES, tout en haut, tombantes vers l'exterieur. Dressees, elles faisaient des
    antennes de faon ; dessinees avant le corps, elles disparaissaient dessous."""
    for sens in (-1, 1):
        x = cx + sens * ecart * E
        bout = x + sens * longueur * E
        d.polygon(
            [(x, y - 3 * E), (bout, y + 2 * E), (bout - sens * 2 * E, y + 6 * E), (x, y + 3 * E)], fill=OREILLE
        )
        d.polygon([(x + sens * 2 * E, y + 2 * E), (bout, y + 2 * E), (bout - sens * 2 * E, y + 6 * E)], fill=OREILLE_S)


def meche(d, cx: int, haut: float, clair) -> None:
    """La petite meche pointue sur le crane."""
    d.polygon([(cx - 3 * E, haut + 4 * E), (cx + E, haut - 4 * E), (cx + 4 * E, haut + 4 * E)], fill=clair)


def pattes(d, cx: int, bas: int, ecart: int, pas: float = 0.0) -> None:
    """Elles AFFLEURENT sous le ventre : deux touches, pas deux piliers. `pas` les decale
    en opposition, ce qui fait toute l'animation de marche."""
    for i, sens in enumerate((-1, 1)):
        saut = round(1.5 * E * math.sin(pas * 2 * math.pi + i * math.pi))
        x = cx + sens * ecart * E
        d.rounded_rectangle([x - 4 * E, bas - E - saut, x + 4 * E, bas + 4 * E - saut], radius=2 * E, fill=PATTE)


def yeux(d, cx: int, y: float, ecart: int = 9, taille: float = 1.0, dodo: bool = False) -> None:
    """Des ovales sombres, hauts et tres ecartes, eclaircis par le bas."""
    for sens in (-1, 1):
        ox = cx + sens * ecart * E
        rx, ry = 2.6 * E * taille, 3.5 * E * taille
        if dodo:
            # Endormi : deux arcs. Des yeux fermes se lisent instantanement, la ou un
            # sprite assombri ne dit rien.
            d.arc([ox - rx, y - ry, ox + rx, y + ry], start=200, end=340, fill=OEIL, width=E)
            continue
        d.ellipse([ox - rx, y - ry, ox + rx, y + ry], fill=OEIL)
        d.ellipse([ox - rx * 0.55, y + ry * 0.25, ox + rx * 0.55, y + ry], fill=OEIL_C)


def bouche(d, cx: int, y: float, couleur=BLEU) -> None:
    d.arc([cx - 3 * E, y, cx + 3 * E, y + 4 * E], start=25, end=155, fill=couleur, width=E)


def finir(im: Image.Image) -> Image.Image:
    return im.resize((T, T), Image.LANCZOS).resize((FINAL, FINAL), Image.NEAREST)
