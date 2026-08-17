"""
Dessine un poro, stade par stade.

ŒUVRE ORIGINALE, et c'est un choix. Les images de reference disponibles etaient des
captures de jeu et des rendus 3D : fonds charges, styles differents, resolutions allant
de cinquante a cinq cents pixels. Detourees, elles auraient donne une lignee dont le
deuxieme stade serait plus PETIT et plus flou que le premier — l'inverse de ce qu'une
evolution doit montrer. Un dessin vectorise donne quatre stades coherents, animables, et
sans question de licence sur une image reprise telle quelle.

Le trace se fait en GRAND puis se reduit : Pillow ne lisse aucune forme, et un cercle
trace directement a quarante-huit pixels a des bords en escalier. On reduit depuis quatre
fois la taille pour des bords propres, et le pack remonte ensuite en NEAREST pour garder
le grain de pixel que le rendu attend (`image-rendering: pixelated`).
"""

from __future__ import annotations

import math

from PIL import Image, ImageDraw, ImageFilter

E = 4        # echelle de trace
T = 48       # taille logique du sprite
FINAL = 96   # taille livree, celle qu'attend le rendu

BLANC = (250, 252, 255)
OMBRE = (203, 222, 238)
GIVRE = (196, 226, 244)
GIVRE_O = (150, 190, 220)
BARBE = (214, 226, 240)
CORNE = (172, 142, 108)
CORNE_S = (126, 100, 74)
TRAIT = (58, 62, 84)
OEIL = (36, 38, 54)
LANGUE = (232, 126, 140)
POIL = (44, 40, 52)
OR = (232, 190, 84)
OR_S = (186, 142, 52)
RUBIS = (206, 62, 48)
CAPE = (176, 44, 44)


def _toile() -> Image.Image:
    return Image.new("RGBA", (T * E, T * E), (0, 0, 0, 0))


def _cerner(im: Image.Image, epaisseur: int = E) -> Image.Image:
    """Un trait sombre autour de la silhouette.

    Sans lui, une creature blanche disparait sur un fond clair — et l'overlay est pose sur
    le bureau de quelqu'un, dont on ne connait ni le fond d'ecran ni le theme.
    """
    alpha = im.split()[3]
    contour = Image.new("RGBA", im.size, TRAIT)
    contour.putalpha(alpha.filter(ImageFilter.MaxFilter(epaisseur * 2 + 1)))
    contour.alpha_composite(im)
    return contour


def _cornes(d: ImageDraw.ImageDraw, cx: int, haut: float, ecart: int, taille: float = 1.0) -> None:
    """Courtes, epaisses, ecartees. Fines et verticales, elles faisaient des antennes."""
    for sens in (-1, 1):
        x = cx + sens * ecart * E
        t = taille
        d.polygon(
            [
                (x - sens * 3 * E * t, haut + 5 * E * t),
                (x + sens * 2 * E * t, haut - 7 * E * t),
                (x + sens * 6 * E * t, haut - 5 * E * t),
                (x + sens * 3 * E * t, haut + 5 * E * t),
            ],
            fill=CORNE,
        )
        d.polygon(
            [
                (x + sens * 2 * E * t, haut - 7 * E * t),
                (x + sens * 6 * E * t, haut - 5 * E * t),
                (x + sens * 4 * E * t, haut + E * t),
            ],
            fill=CORNE_S,
        )


def _corps(d, cx: int, bas: int, larg: int, haut: int, clair, sombre) -> list[int]:
    """Le volume ne vient pas d'un degrade mais de trois passes : la boule, son ombre
    basse, puis la reprise de clair en haut. Un degrade se serait etale a la reduction."""
    boite = [cx - larg * E // 2, bas - haut * E, cx + larg * E // 2, bas]
    d.ellipse(boite, fill=clair)
    d.ellipse(
        [boite[0] + E, boite[1] + (boite[3] - boite[1]) * 55 // 100, boite[2] - E, boite[3]],
        fill=sombre,
    )
    d.ellipse([boite[0], boite[1], boite[2], boite[3] - 9 * E], fill=clair)

    # La frange de fourrure du bas, qui fait la silhouette du poro.
    pas = 6 * E
    for x in range(boite[0], boite[2], pas):
        d.ellipse([x, boite[3] - 5 * E, x + pas, boite[3] + 2 * E], fill=clair)
    return boite


def _yeux(d, cx: int, y: int, ecart: int = 8, taille: float = 1.0, dodo: bool = False) -> None:
    for dx in (-ecart, ecart):
        ox = cx + dx * E
        r = 3 * E * taille
        if dodo:
            # Endormi : deux arcs. Des yeux fermes se lisent instantanement, la ou un
            # sprite assombri ne dit rien.
            d.arc([ox - r, y - r, ox + r, y + r], start=200, end=340, fill=OEIL, width=E)
            continue
        d.ellipse([ox - r, y - r, ox + r, y + r * 4 // 3], fill=OEIL)
        d.ellipse([ox - r * 2 // 3, y - r * 2 // 3, ox, y], fill=(255, 255, 255))


def _pattes(d, cx: int, bas: int, ecart: int, couleur, pas: float = 0.0) -> None:
    """`pas` decale les pattes en opposition : c'est toute l'animation de marche."""
    for i, dx in enumerate((-ecart, ecart)):
        saut = round(2 * E * math.sin(pas * 2 * math.pi + i * math.pi))
        d.rounded_rectangle(
            [cx + dx * E - 4 * E, bas - 2 * E - saut, cx + dx * E + 4 * E, bas + 4 * E - saut],
            radius=2 * E,
            fill=couleur,
        )


def _stade_1(d, cx, bas, dil, dodo, pas):
    _pattes(d, cx, bas, 8, OMBRE, pas)
    _cornes(d, cx, (bas - 30 * E - dil) + 3 * E, 10)
    b = _corps(d, cx, bas, 34 + dil // E, 30 - dil // E, BLANC, OMBRE)
    _yeux(d, cx, b[1] + 12 * E, dodo=dodo)
    d.ellipse([cx - 2 * E, b[1] + 19 * E, cx + 2 * E, b[1] + 22 * E], fill=LANGUE)
    d.polygon([(cx - 2 * E, b[1] + 3 * E), (cx + E, b[1] - 5 * E), (cx + 3 * E, b[1] + 3 * E)], fill=BLANC)


def _stade_2(d, cx, bas, dil, dodo, pas):
    """La moustache de Braum : large, basse, les bouts retrousses vers le haut."""
    _pattes(d, cx, bas, 8, OMBRE, pas)
    _cornes(d, cx, (bas - 30 * E - dil) + 3 * E, 10)
    b = _corps(d, cx, bas, 34 + dil // E, 30 - dil // E, BLANC, OMBRE)
    _yeux(d, cx, b[1] + 11 * E, dodo=dodo)
    for sens in (-1, 1):
        d.rounded_rectangle(
            [cx + sens * 8 * E - 4 * E, b[1] + 4 * E, cx + sens * 8 * E + 4 * E, b[1] + 6 * E],
            radius=E,
            fill=POIL,
        )
    d.ellipse([cx - 9 * E, b[1] + 16 * E, cx + 9 * E, b[1] + 21 * E], fill=POIL)
    for sens in (-1, 1):
        d.ellipse(
            [cx + sens * 9 * E - 3 * E, b[1] + 13 * E, cx + sens * 9 * E + 3 * E, b[1] + 20 * E],
            fill=POIL,
        )
    d.ellipse([cx - 3 * E, b[1] + 15 * E, cx + 3 * E, b[1] + 18 * E], fill=BLANC)


def _stade_3(d, cx, bas, dil, dodo, pas):
    """La monture : plus grosse, givree, et une criniere DERRIERE le corps — devant, elle
    faisait une buche posee sur le ventre."""
    _pattes(d, cx, bas, 11, GIVRE_O, pas)
    _cornes(d, cx, (bas - 36 * E - dil) + 4 * E, 13, 1.25)

    milieu = bas - (33 - dil // E) * E // 2
    for angle in range(0, 360, 24):
        mx = cx + math.cos(math.radians(angle)) * 18 * E
        my = milieu + math.sin(math.radians(angle)) * 16 * E
        d.ellipse([mx - 4 * E, my - 4 * E, mx + 4 * E, my + 4 * E], fill=GIVRE_O)

    b = _corps(d, cx, bas, 36 + dil // E, 33 - dil // E, GIVRE, GIVRE_O)
    _yeux(d, cx, b[1] + 12 * E, 8, 1.05, dodo)
    d.ellipse([cx - 3 * E, b[1] + 20 * E, cx + 3 * E, b[1] + 26 * E], fill=LANGUE)
    d.polygon([(cx - 2 * E, b[1] + 2 * E), (cx + E, b[1] - 7 * E), (cx + 4 * E, b[1] + 2 * E)], fill=GIVRE)


def _stade_4(d, cx, bas, dil, dodo, pas):
    """Le roi : couronne, barbe, cape."""
    haut = bas - (36 - dil // E) * E
    for sens in (-1, 1):
        d.polygon(
            [(cx + sens * 15 * E, haut + 6 * E), (cx + sens * 23 * E, bas + 4 * E), (cx + sens * 3 * E, bas + 2 * E)],
            fill=CAPE,
        )
    _pattes(d, cx, bas, 10, OMBRE, pas)
    _cornes(d, cx, haut + 4 * E, 14, 1.2)
    b = _corps(d, cx, bas, 38 + dil // E, 36 - dil // E, BLANC, OMBRE)
    _yeux(d, cx, b[1] + 13 * E, 7, dodo=dodo)

    # La barbe : une MASSE en U sous le visage. En trois boules elle faisait un nuage, et
    # dans le blanc du corps elle disparaissait — d'où le gris.
    barbe = [cx - 15 * E, b[1] + 16 * E, cx + 15 * E, b[3] + 2 * E]
    d.ellipse(barbe, fill=BARBE)
    d.rectangle([barbe[0], b[1] + 16 * E, barbe[2], b[1] + 22 * E], fill=BARBE)
    for x in range(barbe[0], barbe[2], 6 * E):
        d.ellipse([x, barbe[3] - 6 * E, x + 6 * E, barbe[3] + 2 * E], fill=BARBE)
    for sens in (-1, 1):
        d.ellipse(
            [cx + sens * 15 * E - 4 * E, b[1] + 14 * E, cx + sens * 15 * E + 4 * E, b[1] + 22 * E],
            fill=BARBE,
        )
    d.ellipse([cx - 4 * E, b[1] + 17 * E, cx + 4 * E, b[1] + 21 * E], fill=(255, 255, 255))

    base = b[1] + 2 * E
    d.rectangle([cx - 13 * E, base - 3 * E, cx + 13 * E, base + 2 * E], fill=OR)
    for dx in (-11, 0, 11):
        d.polygon(
            [(cx + dx * E - 4 * E, base - 3 * E), (cx + dx * E, base - 11 * E), (cx + dx * E + 4 * E, base - 3 * E)],
            fill=OR,
        )
    d.rectangle([cx - 13 * E, base + E, cx + 13 * E, base + 2 * E], fill=OR_S)
    d.ellipse([cx - 3 * E, base - 3 * E, cx + 3 * E, base + 2 * E], fill=RUBIS)


STADES = (_stade_1, _stade_2, _stade_3, _stade_4)


def dessiner(stade: int, souffle: float = 0.0, dodo: bool = False, pas: float = 0.0) -> Image.Image:
    """Un stade, dans une pose. `souffle` va de 0 a 1 : le corps s'aplatit et se regonfle."""
    im = _toile()
    d = ImageDraw.Draw(im)
    bas = 42 * E if stade >= 3 else 40 * E
    STADES[stade - 1](d, T * E // 2, bas, round(2 * E * souffle), dodo, pas)
    return _cerner(im).resize((T, T), Image.LANCZOS).resize((FINAL, FINAL), Image.NEAREST)
