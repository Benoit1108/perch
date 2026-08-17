"""
Les quatre stades de la lignee des poros.

OEUVRE ORIGINALE, et c'est un choix contraint. Les images de reference disponibles etaient
des captures de jeu et des rendus 3D : fonds charges, styles differents, resolutions de
cinquante a cinq cents pixels. Detourees, elles auraient donne une lignee dont le deuxieme
stade serait plus PETIT et plus flou que le premier — l'inverse de ce qu'une evolution doit
montrer.

Les jeux de pixel art qui circulent ne conviennent pas davantage : le plus proche est
distribue en CC BY-NC-ND, dont le « ND » interdit les oeuvres derivees — or redimensionner,
detourer et recaler en bas pour notre format EST une adaptation.

Reste a dessiner. La silhouette vit dans `poro_corps.py`, ou sont consignees les trois
corrections qui l'ont amenee a ressembler vraiment a un poro ; ce fichier ne fait
qu'habiller ce corps.
"""

from __future__ import annotations

import math

from PIL import Image, ImageDraw

from poro_corps import (
    BARBE,
    BLANC,
    BLEU,
    CAPE,
    E,
    GIVRE,
    GIVRE_O,
    LANGUE,
    OMBRE,
    OR,
    OR_S,
    POIL,
    RUBIS,
    T,
    cerner,
    corps,
    crete,
    finir,
    museau,
    oreilles,
    pattes,
    toile,
    yeux,
)


def _base(im, cx, bas, dil, dodo, pas, larg, haut, clair, ombre, fond, museau_ombre=None):
    """Le poro nu. Les stades ajoutent par-dessus.

    L'ordre compte : pattes et oreilles AVANT le corps pour qu'elles passent derriere,
    museau et yeux APRES pour qu'ils s'y posent.
    """
    boite = [cx - (larg * E + dil) // 2, bas - (haut * E - dil), cx + (larg * E + dil) // 2, bas]
    d = ImageDraw.Draw(im)

    pattes(d, cx, bas, larg * 22 // 100, pas)
    crete(d, cx, boite[1], clair)
    corps(im, boite, clair, ombre, fond)

    # Les oreilles APRES le corps : dessinees avant, elles disparaissaient dessous. Sur le
    # modele elles se posent bien devant, au niveau des tempes.
    d = ImageDraw.Draw(im)
    hauteur = boite[3] - boite[1]
    oreilles(d, cx, boite[1] + hauteur * 17 // 100, larg * 28 // 100, 7)
    yeux(d, cx, boite[1] + hauteur * 38 // 100, larg * 19 // 100, larg / 36, dodo)
    museau(d, cx, boite[1] + hauteur * 55 // 100, (boite[2] - boite[0]) * 68 // 100,
           clair, museau_ombre or fond)
    return d, boite


def _stade_1(im, cx, bas, dil, dodo, pas):
    _base(im, cx, bas, dil, dodo, pas, 36, 32, BLANC, OMBRE, BLEU)


def _stade_2(im, cx, bas, dil, dodo, pas):
    """La moustache de Braum : large, basse, les bouts retrousses vers le haut."""
    d, boite = _base(im, cx, bas, dil, dodo, pas, 36, 32, BLANC, OMBRE, BLEU)
    haut = boite[1]

    for sens in (-1, 1):
        d.rounded_rectangle(
            [cx + sens * 9 * E - 4 * E, haut + 5 * E, cx + sens * 9 * E + 4 * E, haut + 7 * E],
            radius=E,
            fill=POIL,
        )
    d.ellipse([cx - 10 * E, haut + 17 * E, cx + 10 * E, haut + 22 * E], fill=POIL)
    for sens in (-1, 1):
        d.ellipse(
            [cx + sens * 10 * E - 3 * E, haut + 13 * E, cx + sens * 10 * E + 3 * E, haut + 20 * E], fill=POIL
        )
    d.ellipse([cx - 3 * E, haut + 16 * E, cx + 3 * E, haut + 19 * E], fill=BLANC)


def _stade_3(im, cx, bas, dil, dodo, pas):
    """La monture : plus grosse, givree, et une criniere DERRIERE le corps — devant, elle
    faisait une buche posee sur le ventre."""
    milieu = bas - (32 * E - dil) // 2
    d = ImageDraw.Draw(im)
    for angle in range(0, 360, 22):
        mx = cx + math.cos(math.radians(angle)) * 21 * E
        my = milieu + math.sin(math.radians(angle)) * 15 * E
        d.ellipse([mx - 4 * E, my - 4 * E, mx + 4 * E, my + 4 * E], fill=GIVRE_O)

    d, boite = _base(im, cx, bas, dil, dodo, pas, 40, 35, GIVRE, GIVRE_O, GIVRE_O)
    # La langue qui pend, comme sur la monture du jeu.
    d.ellipse([cx - 3 * E, boite[1] + 18 * E, cx + 3 * E, boite[1] + 25 * E], fill=LANGUE)


def _stade_4(im, cx, bas, dil, dodo, pas):
    """Le roi : couronne, barbe, cape."""
    d = ImageDraw.Draw(im)
    haut = bas - (33 * E - dil)
    for sens in (-1, 1):
        d.polygon(
            [(cx + sens * 16 * E, haut + 6 * E), (cx + sens * 24 * E, bas + 4 * E), (cx + sens * 4 * E, bas + 2 * E)],
            fill=CAPE,
        )

    d, boite = _base(im, cx, bas, dil, dodo, pas, 40, 35, BLANC, OMBRE, BLEU)

    # La barbe : une masse claire sur le bas du visage, en plus GRIS que le corps. Dans le
    # meme blanc, elle s'y fondait et on ne voyait plus rien.
    hauteur = boite[3] - boite[1]
    museau(d, cx, boite[1] + hauteur * 58 // 100, (boite[2] - boite[0]) * 80 // 100, BARBE, BLEU)
    museau(d, cx, boite[1] + hauteur * 76 // 100, (boite[2] - boite[0]) * 56 // 100, BARBE, BLEU)

    base = boite[1] + 3 * E
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
    im = toile()
    bas = 41 * E if stade >= 3 else 40 * E
    STADES[stade - 1](im, T * E // 2, bas, round(1.5 * E * souffle), dodo, pas)
    return finir(cerner(im))
