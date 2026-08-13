#!/usr/bin/env bash
# Le repli XWayland peut-il À LA FOIS laisser passer les clics ET suivre le curseur ?
#
# Hypothèse testée : quand la région d'entrée de l'overlay est réduite à 1x1 (clics
# traversants), plus aucune fenêtre X11 ne reçoit d'événements de pointeur, et XWayland
# perd la position globale du curseur. Si elle se vérifie, l'extension GNOME cesse d'être
# un bonus pour devenir indispensable sur Wayland.
#
# BOUGE LA SOURIS PENDANT TOUTE LA DURÉE DU TEST — sans mouvement, le résultat ne veut rien dire.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "════════════════════════════════════════════════════════"
echo " TEST 1/2 — SANS overlay"
echo "════════════════════════════════════════════════════════"
pkill -f "electron/dist/electron" 2>/dev/null
sleep 2
echo ">>> BOUGE LA SOURIS PARTOUT PENDANT 10 SECONDES <<<"
sleep 1
python3 check-pointer.py 10
A=$?

echo
echo "════════════════════════════════════════════════════════"
echo " TEST 2/2 — AVEC overlay (clics traversants actifs)"
echo "════════════════════════════════════════════════════════"
PERCH_TIMEOUT=40 ./node_modules/.bin/electron . --ozone-platform=x11 >/tmp/perch-tracking.log 2>&1 &
sleep 6
python3 check-input-shape.py 2>/dev/null | tail -3
echo
echo ">>> BOUGE LA SOURIS PARTOUT PENDANT 10 SECONDES <<<"
sleep 1
python3 check-pointer.py 10

pkill -f "electron/dist/electron" 2>/dev/null
echo
echo "════════════════════════════════════════════════════════"
echo " Comparer les deux « positions distinctes » ci-dessus."
echo " Beaucoup puis 1 → les clics traversants tuent le suivi."
echo "════════════════════════════════════════════════════════"
exit 0
