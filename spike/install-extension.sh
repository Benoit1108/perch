#!/usr/bin/env bash
# Installe l'extension de capteurs dans GNOME Shell.
#
# Sur Wayland, GNOME ne peut pas recharger le shell à chaud : l'extension ne sera
# active qu'après une déconnexion / reconnexion de session. C'est la même contrainte
# que Shijima-Qt impose à ses utilisateurs — inévitable, à annoncer clairement.
set -euo pipefail

UUID="perch-sensors@perch.local"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/gnome-extension"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DEST"
cp "$SRC/metadata.json" "$SRC/extension.js" "$DEST/"
echo "✓ installée dans $DEST"

if gnome-extensions enable "$UUID" 2>/dev/null; then
  echo "✓ activée"
else
  echo "· pas encore activable — GNOME ne la connaîtra qu'après reconnexion"
  echo "  ensuite : gnome-extensions enable $UUID"
fi

echo
echo "Vérifier une fois reconnecté :"
echo "  gdbus call --session --dest org.perch.Sensors \\"
echo "    --object-path /org/perch/Sensors \\"
echo "    --method org.perch.Sensors.GetPointer"
