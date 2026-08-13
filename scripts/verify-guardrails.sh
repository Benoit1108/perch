#!/usr/bin/env bash
#
# Vérifie que les garde-fous rejettent bien ce qu'ils sont censés rejeter.
#
# « Un garde-fou qu'on n'a pas vu échouer n'est pas un garde-fou. » Une règle ESLint mal
# ciblée, un chemin dependency-cruiser périmé après un renommage : dans les deux cas
# `npm run health` reste vert et ne protège plus rien.
#
# DEUX PRÉCAUTIONS, apprises d'une revue qui a pris ce script en défaut :
#
#   1. On vérifie d'abord que chaque outil est VERT sur l'arbre propre. Sans ce socle, un
#      fichier de configuration cassé fait échouer tous les contrôles — et le script
#      annonçait alors une protection totale alors que la chaîne était désarmée.
#   2. On n'exige pas seulement un échec : on exige que la sortie mentionne LA règle
#      attendue. Échouer pour une autre raison ne prouve rien.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

failures=0
staged_files=()
staged_dirs=()

cleanup() {
  for f in "${staged_files[@]:-}"; do [ -n "$f" ] && rm -f "$f"; done
  for d in "${staged_dirs[@]:-}"; do [ -n "$d" ] && rmdir "$d" 2>/dev/null; done
  staged_files=()
  staged_dirs=()
}
trap cleanup EXIT

ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() {
  printf '  \033[31m✗\033[0m %s\n      %s\n' "$1" "$2"
  failures=$((failures + 1))
}

stage_dir() {
  [ -d "$1" ] || { mkdir -p "$1" && staged_dirs+=("$1"); }
}

stage() { # stage <chemin> <contenu>
  printf '%s\n' "$2" >"$1"
  staged_files+=("$1")
}

# Exige que la commande échoue ET que sa sortie mentionne le motif attendu.
expect_rejected() { # expect_rejected <libellé> <motif attendu> <commande>
  local label="$1" pattern="$2" command="$3" output status
  output=$(eval "$command" 2>&1)
  status=$?
  cleanup

  if [ "$status" -eq 0 ]; then
    ko "$label" "la commande a RÉUSSI alors qu'elle devait échouer"
  elif ! grep -qE "$pattern" <<<"$output"; then
    ko "$label" "échec obtenu, mais pas pour la bonne raison (motif attendu : $pattern)"
  else
    ok "$label"
  fi
}

# Sans ce socle, tout le reste est un faux positif.
require_green() { # require_green <libellé> <commande>
  if eval "$2" >/dev/null 2>&1; then
    ok "socle — $1 est vert sur l'arbre propre"
  else
    ko "socle — $1" "l'outil échoue DÉJÀ sans aucune violation : les contrôles suivants n'auraient aucune valeur"
    printf '\n\033[31mAbandon : la chaîne est cassée avant même d’être testée.\033[0m\n'
    exit 1
  fi
}

ESLINT="npx eslint --max-warnings=0"

echo "Vérification des garde-fous"
echo

require_green "dependency-cruiser" "npm run deps"
require_green "eslint" "$ESLINT packages"
echo

# ── Règles d'architecture (dependency-cruiser) ────────────────────────────────────

# Import par NOM DE PAQUET, la forme la plus naturelle — et celle qui était invisible :
# `@perch/app` se résolvait vers `dist/`, exclu de l'analyse, si bien que la règle ne
# voyait jamais rien. Tester la forme relative seule aurait laissé le trou ouvert.
stage "packages/core/src/violation-a1.ts" \
  "import { bootstrap } from '@perch/app';
export const boum = bootstrap;"
expect_rejected "A1 — core importe le corps (par nom de paquet)" \
  "a1-core-ignore-le-reste" "npm run deps"

stage "packages/core/src/violation-a2.ts" \
  "import { readFileSync } from 'node:fs';
export const boum = (): string => readFileSync('/etc/hostname', 'utf8');"
expect_rejected "A2 — core importe un module Node" "a2-core-sans-plateforme" "npm run deps"

stage "packages/shell/src/violation-a3.ts" \
  "import { parseCreaturePack } from '@perch/core';
export const boum = parseCreaturePack;"
expect_rejected "A3 — l'extension importe le cœur" "a3-shell-isole" "npm run deps"

stage_dir "packages/app/src/renderer"
stage "packages/app/src/renderer/violation-a4.ts" \
  "import { bootstrap } from '../main/bootstrap.js';
export const boum = bootstrap;"
expect_rejected "A4 — le renderer importe le process principal" \
  "a4-renderer-et-main-separes" "npm run deps"

stage "packages/core/src/violation-a5a.ts" \
  "import { b } from './violation-a5b.js';
export const a = (): number => b();"
stage "packages/core/src/violation-a5b.ts" \
  "import { a } from './violation-a5a.js';
export const b = (): number => a();"
expect_rejected "A5 — cycle de dépendances" "a5-aucun-cycle" "npm run deps"

stage "packages/core/src/ports/violation-a6.ts" \
  "export class Implementation {
  compute(): number {
    return 42;
  }
}"
expect_rejected "A6 — une implémentation dans ports/" \
  "no-restricted-syntax" "$ESLINT packages/core/src/ports/violation-a6.ts"

# ── Règles de code (ESLint) ───────────────────────────────────────────────────────

stage "packages/core/src/violation-globals.ts" \
  "export const boum = (): string => process.platform;"
expect_rejected "I3 — core lit une globale système" \
  "no-restricted-globals" "$ESLINT packages/core/src/violation-globals.ts"

stage "packages/core/src/violation-any.ts" \
  "export function boum(value: any): any {
  return value;
}"
expect_rejected "no-explicit-any" "no-explicit-any" "$ESLINT packages/core/src/violation-any.ts"

stage "packages/core/src/violation-assertion.ts" \
  "const brut: unknown = 1;
export const boum = brut as number;"
expect_rejected "consistent-type-assertions" \
  "consistent-type-assertions" "$ESLINT packages/core/src/violation-assertion.ts"

stage "packages/core/src/violation-long.ts" \
  "$(for i in $(seq 1 220); do echo "export const l$i = $i;"; done)"
expect_rejected "max-lines (200)" "max-lines" "$ESLINT packages/core/src/violation-long.ts"

# ── Invariant I5 : aucun sprite committé ──────────────────────────────────────────
# Mécanisme différent : ce n'est pas un outil qui protège, c'est .gitignore. C'est
# pourtant l'invariant dont les conséquences sont juridiques.

stage_dir "packs/test-pack/sprites"
stage "packs/test-pack/sprites/verification.png" "faux sprite"
if git check-ignore -q "packs/test-pack/sprites/verification.png"; then
  ok "I5 — un sprite déposé dans packs/ est bien ignoré par git"
else
  ko "I5 — sprite committable" "packs/*/sprites/ n'est plus couvert par .gitignore"
fi
cleanup

echo
if [ "$failures" -gt 0 ]; then
  printf '\033[31m%d garde-fou(s) ne protègent plus.\033[0m\n' "$failures"
  exit 1
fi

printf '\033[32mTous les garde-fous rejettent ce qu’ils doivent rejeter.\033[0m\n'
