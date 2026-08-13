#!/usr/bin/env bash
#
# Corrige les permissions du helper de bac à sable d'Electron (Linux, développement).
#
# Après un `npm install` utilisateur, `chrome-sandbox` appartient à l'utilisateur et n'a
# pas le bit SUID : Chromium refuse alors de démarrer. Le réflexe `--no-sandbox`
# déstabilise le process GPU et mène à une fenêtre créée mais jamais peinte — un
# symptôme qui ne désigne pas du tout sa cause (voir spike/README.md, constat n°4).
#
# L'application packagée n'a PAS ce problème : l'installateur pose les bonnes
# permissions. C'est une friction de développement uniquement.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANDBOX="$ROOT/node_modules/electron/dist/chrome-sandbox"

if [ ! -f "$SANDBOX" ]; then
  echo "Binaire Electron absent. `npm ci` ne le télécharge pas toujours ; lancer :" >&2
  echo "  node node_modules/electron/install.js" >&2
  exit 1
fi

if [ "$(stat -c '%U:%a' "$SANDBOX")" = "root:4755" ]; then
  echo "✓ déjà correct : $(ls -l "$SANDBOX" | awk '{print $1, $3":"$4}')"
  exit 0
fi

CMD="chown root:root '$SANDBOX' && chmod 4755 '$SANDBOX'"

# `sudo` exige un terminal. Sans TTY (lancé depuis un outil), on bascule sur pkexec,
# qui ouvre une fenêtre d'authentification graphique.
if [ -t 0 ]; then
  sudo sh -c "$CMD"
elif command -v pkexec >/dev/null 2>&1; then
  echo "pas de terminal : authentification graphique (pkexec)…"
  pkexec sh -c "$CMD"
else
  echo "erreur : ni terminal pour sudo, ni pkexec disponible" >&2
  exit 1
fi

echo "✓ corrigé : $(ls -l "$SANDBOX" | awk '{print $1, $3":"$4}')"
