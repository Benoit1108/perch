#!/usr/bin/env python3
"""
Interroge la région d'entrée X11 (ShapeInput) d'une fenêtre.

`xwininfo -shape` ne rapporte que les formes *bounding* et *clip* — pas celle qui
décide si les clics traversent. On appelle donc XShapeGetRectangles directement.

Usage :
    ./check-input-shape.py            # cherche la fenêtre « Perch »
    ./check-input-shape.py 0x1000004  # id explicite

Lecture du résultat :
    input: aucune             → la fenêtre CAPTE tous les clics  ❌
    input: 1 rect 1x1         → les clics traversent             ✅
"""

import ctypes
import subprocess
import sys

SHAPE_BOUNDING = 0
SHAPE_INPUT = 2


class XRectangle(ctypes.Structure):
    _fields_ = [
        ("x", ctypes.c_short),
        ("y", ctypes.c_short),
        ("width", ctypes.c_ushort),
        ("height", ctypes.c_ushort),
    ]


def find_window_id() -> int | None:
    try:
        tree = subprocess.run(
            ["xwininfo", "-root", "-tree"], capture_output=True, text=True, timeout=10
        ).stdout
    except Exception:
        return None
    for line in tree.splitlines():
        if "perch" in line.lower() and "guard" not in line.lower():
            for token in line.split():
                if token.startswith("0x"):
                    return int(token, 16)
    return None


def main() -> int:
    wid = int(sys.argv[1], 16) if len(sys.argv) > 1 else find_window_id()
    if wid is None:
        print("fenêtre introuvable — l'application tourne-t-elle ?", file=sys.stderr)
        return 1

    xlib = ctypes.CDLL("libX11.so.6")
    xext = ctypes.CDLL("libXext.so.6")

    xlib.XOpenDisplay.restype = ctypes.c_void_p
    xlib.XOpenDisplay.argtypes = [ctypes.c_char_p]
    xext.XShapeGetRectangles.restype = ctypes.POINTER(XRectangle)
    xext.XShapeGetRectangles.argtypes = [
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.c_int,
        ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.c_int),
    ]

    display = xlib.XOpenDisplay(None)
    if not display:
        print("impossible d'ouvrir le display X", file=sys.stderr)
        return 1

    print(f"fenêtre 0x{wid:x}")
    verdict = None

    for kind, label in ((SHAPE_BOUNDING, "bounding"), (SHAPE_INPUT, "input")):
        count = ctypes.c_int(0)
        ordering = ctypes.c_int(0)
        rects = xext.XShapeGetRectangles(
            display, wid, kind, ctypes.byref(count), ctypes.byref(ordering)
        )
        n = count.value

        if not rects or n == 0:
            print(f"  {label:9s}: aucune région définie (= fenêtre entière)")
            if kind == SHAPE_INPUT:
                verdict = False
            continue

        area = sum(rects[i].width * rects[i].height for i in range(n))
        first = rects[0]
        print(
            f"  {label:9s}: {n} rectangle(s), 1er = {first.width}x{first.height}"
            f"@{first.x},{first.y}, aire totale = {area} px²"
        )
        if kind == SHAPE_INPUT:
            verdict = area <= 4

    print()
    if verdict is True:
        print("✅ les clics TRAVERSENT l'overlay")
    else:
        print("❌ l'overlay CAPTE les clics — ne pas laisser tourner")
    return 0


if __name__ == "__main__":
    sys.exit(main())
