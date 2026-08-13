#!/usr/bin/env python3
"""
Échantillonne XQueryPointer pendant N secondes et rapporte combien de positions
DISTINCTES ont été vues.

But : savoir si XWayland connaît la position globale du curseur quand aucune fenêtre
X11 ne reçoit d'événements de pointeur. C'est la question qui décide si le repli
XWayland peut à la fois laisser passer les clics ET suivre la souris.

Usage :
    ./check-pointer.py [secondes]      # bouger la souris pendant ce temps

Lecture :
    beaucoup de positions distinctes → XWayland suit le curseur      ✅
    1 ou 2 positions                 → position figée / obsolète     ❌
"""

import ctypes
import sys
import time


def main() -> int:
    duration = float(sys.argv[1]) if len(sys.argv) > 1 else 10.0

    xlib = ctypes.CDLL("libX11.so.6")
    xlib.XOpenDisplay.restype = ctypes.c_void_p
    xlib.XOpenDisplay.argtypes = [ctypes.c_char_p]
    xlib.XDefaultRootWindow.restype = ctypes.c_ulong
    xlib.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
    xlib.XQueryPointer.restype = ctypes.c_int
    xlib.XQueryPointer.argtypes = [
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.POINTER(ctypes.c_ulong),
        ctypes.POINTER(ctypes.c_ulong),
        ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.c_uint),
    ]

    display = xlib.XOpenDisplay(None)
    if not display:
        print("impossible d'ouvrir le display X", file=sys.stderr)
        return 1
    root = xlib.XDefaultRootWindow(display)

    root_ret = ctypes.c_ulong()
    child_ret = ctypes.c_ulong()
    root_x = ctypes.c_int()
    root_y = ctypes.c_int()
    win_x = ctypes.c_int()
    win_y = ctypes.c_int()
    mask = ctypes.c_uint()

    seen: list[tuple[int, int]] = []
    print(f"échantillonnage pendant {duration:.0f}s — BOUGE LA SOURIS maintenant…")

    deadline = time.time() + duration
    while time.time() < deadline:
        ok = xlib.XQueryPointer(
            display,
            root,
            ctypes.byref(root_ret),
            ctypes.byref(child_ret),
            ctypes.byref(root_x),
            ctypes.byref(root_y),
            ctypes.byref(win_x),
            ctypes.byref(win_y),
            ctypes.byref(mask),
        )
        pos = (root_x.value, root_y.value) if ok else (-1, -1)
        if not seen or seen[-1] != pos:
            seen.append(pos)
        time.sleep(0.05)

    distinct = len(set(seen))
    print(f"\npositions distinctes : {distinct}")
    print(f"première : {seen[0]}")
    print(f"dernière : {seen[-1]}")

    if distinct >= 10:
        print("\n✅ XWayland suit le curseur global")
    elif distinct <= 2:
        print("\n❌ position FIGÉE — XWayland ne voit pas le curseur global")
    else:
        print("\n⚠️ suivi partiel — le curseur n'est vu que sur certaines zones")
    return 0


if __name__ == "__main__":
    sys.exit(main())
