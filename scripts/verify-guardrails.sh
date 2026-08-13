#!/usr/bin/env bash
#
# Vérifie que les garde-fous rejettent bien ce qu'ils sont censés rejeter.
#
# « Un garde-fou qu'on n'a pas vu échouer n'est pas un garde-fou. » Une configuration
# ESLint mal ciblée, une règle dependency-cruiser dont le chemin ne correspond plus après
# un renommage : dans les deux cas `npm run health` reste vert et ne protège plus rien.
#
# Ce script introduit délibérément des violations, exige que l'outil concerné échoue, et
# nettoie derrière lui. Il tourne en CI à chaque poussée.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

failures=0
scratch=()

cleanup() {
  for f in "${scratch[@]:-}"; do
    [ -n "$f" ] && rm -f "$f"
  done
}
trap cleanup EXIT

# check <libellé> <fichier> <contenu> <commande attendue en échec>
check() {
  local label="$1" file="$2" content="$3" command="$4"

  printf '%s\n' "$content" >"$file"
  scratch+=("$file")

  if eval "$command" >/dev/null 2>&1; then
    printf '  \033[31m✗\033[0m %s — la violation N’A PAS été détectée\n' "$label"
    failures=$((failures + 1))
  else
    printf '  \033[32m✓\033[0m %s — correctement rejetée\n' "$label"
  fi

  rm -f "$file"
}

echo "Vérification des garde-fous"
echo

check "A2 — core importe un module Node" \
  "packages/core/src/violation-fs.ts" \
  "import { readFileSync } from 'node:fs';
export const boom = (): string => readFileSync('/etc/hostname', 'utf8');" \
  "npm run deps"

check "A1 — core importe le corps" \
  "packages/core/src/violation-app.ts" \
  "import { systemClock } from '../../app/src/adapters/clock.js';
export const boom = systemClock;" \
  "npm run deps"

check "no-explicit-any" \
  "packages/core/src/violation-any.ts" \
  "export function boom(value: any): any {
  return value;
}" \
  "npx eslint packages/core/src/violation-any.ts --max-warnings=0"

check "consistent-type-assertions" \
  "packages/core/src/violation-assertion.ts" \
  "const raw: unknown = { a: 1 };
export const boom = raw as { a: number };" \
  "npx eslint packages/core/src/violation-assertion.ts --max-warnings=0"

# 220 lignes de code effectif : au-delà de la limite de 200, hors blancs et commentaires.
check "max-lines (200)" \
  "packages/core/src/violation-long.ts" \
  "$(for i in $(seq 1 220); do echo "export const l$i = $i;"; done)" \
  "npx eslint packages/core/src/violation-long.ts --max-warnings=0"

echo
if [ "$failures" -gt 0 ]; then
  printf '\033[31m%d garde-fou(s) ne protègent plus.\033[0m\n' "$failures"
  exit 1
fi

printf '\033[32mTous les garde-fous rejettent ce qu’ils doivent rejeter.\033[0m\n'
