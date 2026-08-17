"""
Le corps commun des poros : ce que les quatre stades partagent.

Le trace se fait en GRAND puis se reduit : Pillow ne lisse aucune forme, et un cercle
trace directement a quarante-huit pixels a des bords en escalier. On reduit depuis quatre
fois la taille pour des bords propres, et le pack remonte ensuite en NEAREST pour garder
le grain de pixel que le rendu attend (`image-rendering: pixelated`).

Le dessin est le fruit de corrections successives, toutes faites en COMPARANT a une image
plutot qu'en raisonnant sur le code :

  1. de gros yeux ronds a reflet blanc et des cornes dressees donnaient une peluche
     generique — ce sont des yeux SOMBRES en amandes et des oreilles TOMBANTES ;
  2. le museau doit etre une masse de touffes POINTUES en travers du bas du visage. C'est
     le trait le plus reconnaissable de la bete, et le supprimer a coute une version
     entiere : la silhouette lisse qui restait ne ressemblait plus a rien ;
  3. ATTENTION AUX REFERENCES DE BIAIS. Les jeux de pixel art qui circulent sont en vue
     trois-quarts : corps ovale penche, une oreille plus proche que l'autre. En les
     prenant pour modele d'un sprite de FACE, on aplatit la bete en galette. La seule
     reference valable ici est le rendu de face du modele 3D ;
  4. l'ombre qui donne le volume est floutee puis masquee. Nette, elle barrait le visage
     comme un masque chirurgical.
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
GIVRE = (204, 230, 246)
GIVRE_O = (154, 192, 222)
BARBE = (216, 229, 243)
CORNE = (176, 146, 108)
CORNE_S = (122, 96, 70)
CORNE_C = (206, 180, 142)
PATTE = (178, 154, 126)
TRAIT = (52, 56, 78)
OEIL = (28, 32, 66)
OEIL_C = (92, 112, 168)
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


def pattes(d, cx: int, bas: int, ecart: int, pas: float = 0.0) -> None:
    """DEUX pattes, et pas quatre.

    Le premier jet ajoutait deux pattes arriere plus sombres. A quatre-vingt-seize pixels
    elles ne se lisaient pas comme des pattes : ca faisait deux paquets fonces sous le
    ventre, et le bas de la bete devenait illisible.

    `pas` les decale en opposition, ce qui fait toute l'animation de marche.
    """
    for i, sens in enumerate((-1, 1)):
        saut = round(2 * E * math.sin(pas * 2 * math.pi + i * math.pi))
        x = cx + sens * ecart * E
        d.rounded_rectangle([x - 4 * E, bas - 3 * E - saut, x + 4 * E, bas + 3 * E - saut], radius=3 * E, fill=PATTE)


def cornes(d, cx: int, y: float, ecart: int, longueur: int = 6) -> None:
    """Des CORNES, pas des oreilles — le code se trompait de mot, et le dessin avec.

    PETITES et HAUTES : elles poussent sur le sommet du crane, de part et d'autre de la
    crete, et pointent vers le haut et l'exterieur. Longues et rabattues, elles arrivaient
    au niveau des yeux et se lisaient comme des sourcils fronces — la bete avait l'air en
    colere.
    """
    for sens in (-1, 1):
        base = cx + sens * ecart * E
        bout_x = base + sens * longueur * E
        bout_y = y - longueur * 0.8 * E

        d.polygon(
            [
                (base, y + 3 * E),
                (base + sens * 5 * E, y + 5 * E),
                (bout_x + sens * 3 * E, bout_y + 4 * E),
                (bout_x, bout_y - 3 * E),
            ],
            fill=CORNE,
        )
        # La face inferieure, plus sombre : c'est elle qui donne le relief.
        d.polygon(
            [(base + sens * E, y + 5 * E), (base + sens * 5 * E, y + 5 * E), (bout_x + sens * 3 * E, bout_y + 4 * E)],
            fill=CORNE_S,
        )
        d.ellipse([bout_x - 2.5 * E, bout_y - 3 * E, bout_x + 2.5 * E, bout_y + 2 * E], fill=CORNE_C)


def corps(im: Image.Image, boite: list[int], clair, ombre, bas) -> None:
    """La boule et son volume : ronde, a peine plus large que haute.

    L'ombre est FLOUTEE puis masquee par le corps. Nette, elle faisait une bande en
    travers du ventre.
    """
    d = ImageDraw.Draw(im)
    d.ellipse(boite, fill=clair)

    hauteur = boite[3] - boite[1]
    couche = Image.new("RGBA", im.size, (0, 0, 0, 0))
    dessin = ImageDraw.Draw(couche)
    dessin.ellipse(
        [boite[0] - 2 * E, boite[1] + hauteur * 52 // 100, boite[2] + 2 * E, boite[3] + 6 * E], fill=ombre
    )
    dessin.ellipse(
        [boite[0] + 3 * E, boite[1] + hauteur * 76 // 100, boite[2] - 3 * E, boite[3] + 6 * E], fill=bas
    )
    couche = couche.filter(ImageFilter.GaussianBlur(3 * E))

    masque = Image.new("L", im.size, 0)
    ImageDraw.Draw(masque).ellipse(boite, fill=255)
    im.paste(couche, (0, 0), Image.composite(couche.split()[3], Image.new("L", im.size, 0), masque))


def museau(d, cx: int, y: float, largeur: int, clair, ombre) -> None:
    """La fourrure du museau : une grappe de touffes POINTUES sous les yeux.

    C'est LE trait du poro. Ni bande pleine largeur ni festons ronds : la premiere donnait
    un masque chirurgical, les seconds une meringue. Les touffes du centre pendent plus
    bas, celles du bord s'evasent en debordant la silhouette — c'est ce qui rend le
    contour ebouriffe plutot que lisse.

    Une tentative d'ombre PORTEE floutee a suivi, pour adoucir les pointes : elle debordait
    la silhouette du corps, que le cerne suivait ensuite, et la bete devenait une tache.
    Le fil d'ombre simple, lui, tient.
    """
    nombre = 7
    for i in range(nombre):
        t = i / (nombre - 1)
        x = cx + round((t - 0.5) * largeur)
        longueur = (3 + 3.5 * math.sin(t * math.pi)) * E
        ecart = round((t - 0.5) * 12 * E)
        d.polygon([(x - 4.5 * E, y - 4 * E), (x + 4.5 * E, y - 4 * E), (x + ecart, y + longueur)], fill=clair)

    d.arc([cx - largeur // 2, y - 2 * E, cx + largeur // 2, y + 9 * E], start=25, end=155, fill=ombre, width=E)


def yeux(d, cx: int, y: float, ecart: int = 8, taille: float = 1.0, dodo: bool = False) -> None:
    """Des amandes sombres, sans reflet blanc. Les gros yeux ronds a reflet faisaient un
    personnage de dessin anime, pas un poro."""
    for sens in (-1, 1):
        ox = cx + sens * ecart * E
        rx, ry = 3.0 * E * taille, 4.2 * E * taille
        if dodo:
            # Endormi : deux arcs. Des yeux fermes se lisent instantanement, la ou un
            # sprite assombri ne dit rien.
            d.arc([ox - rx, y - ry, ox + rx, y + ry], start=200, end=340, fill=OEIL, width=E)
            continue
        d.ellipse([ox - rx, y - ry, ox + rx, y + ry], fill=OEIL)
        # Le bas de l'iris s'eclaircit, comme sur le modele...
        d.ellipse([ox - rx * 0.55, y + ry * 0.1, ox + rx * 0.55, y + ry * 0.8], fill=OEIL_C)
        # ...et un vrai point blanc en haut a gauche allume le regard. Sans lui, l'oeil
        # reste une tache sombre.
        d.ellipse([ox - rx * 0.75, y - ry * 0.7, ox - rx * 0.05, y - ry * 0.05], fill=(255, 255, 255))
        d.ellipse([ox + rx * 0.2, y + ry * 0.3, ox + rx * 0.6, y + ry * 0.7], fill=(255, 255, 255))


def crete(d, cx: int, haut: float, clair) -> None:
    """La meche pointue sur le crane, entre les deux oreilles."""
    d.polygon([(cx - 2 * E, haut + 4 * E), (cx + E, haut - 3 * E), (cx + 4 * E, haut + 4 * E)], fill=clair)


def finir(im: Image.Image) -> Image.Image:
    return im.resize((T, T), Image.LANCZOS).resize((FINAL, FINAL), Image.NEAREST)
