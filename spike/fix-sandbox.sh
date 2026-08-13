#!/usr/bin/env bash
# Corrige les permissions du helper de bac à sable d'Electron.
#
# Après un `npm install` utilisateur, `chrome-sandbox` appartient à l'utilisateur et n'a
# pas le bit SUID. Chromium refuse alors de démarrer. Le contournement habituel
# (`--no-sandbox`) déstabilise le process GPU : il segfault en boucle, Chromium se rabat
# sur le présentateur logiciel X11, celui-ci échoue (« XGetWindowAttributes failed »), et
# la fenêtre est créée sans jamais être peinte.
#
# L'application packagée n'a pas ce problème : l'installateur pose les bonnes permissions.
# C'est une friction de développement uniquement.
set -euo pipefail

SANDBOX="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/node_modules/electron/dist/chrome-sandbox"

if [ ! -f "$SANDBOX" ]; then
  echo "introuvable : $SANDBOX" >&2
  echo "lancer d'abord : npm install" >&2
  exit 1
fi

echo "Ce script a besoin des droits root pour :"
echo "  chown root:root $SANDBOX"
echo "  chmod 4755      $SANDBOX"
echo

# `sudo` exige un terminal pour demander le mot de passe. Lancé depuis un outil sans TTY,
# il échoue avec « a terminal is required ». On bascule alors sur pkexec, qui ouvre une
# fenêtre d'authentification graphique.
CMD="chown root:root '$SANDBOX' && chmod 4755 '$SANDBOX'"

if [ -t 0 ]; then
  sudo sh -c "$CMD"
elif command -v pkexec >/dev/null 2>&1; then
  echo "pas de terminal : authentification graphique (pkexec)…"
  pkexec sh -c "$CMD"
else
  echo "erreur : ni terminal pour sudo, ni pkexec disponible" >&2
  exit 1
fi

echo "✓ corrigé :"
ls -l "$SANDBOX"
echo
echo "Relancer ensuite avec :  npm run start:debug"
