#!/usr/bin/env bash
#
# Hook PreToolUse (Claude Code) — se déclenche avant chaque appel de l'outil Bash et
# soumet tout `git push` aux mêmes portes de qualité que la CI.
# Branché dans .claude/settings.json avec le matcher "Bash".
#
# Stdin reçoit la charge utile de l'outil en JSON. On en extrait `tool_input.command`,
# on décide s'il faut intercepter, on lance `npm run health`, et en cas d'échec on
# renvoie un `permissionDecision: deny` sur stderr avec le code 2 — Claude Code bloque
# alors l'appel et remonte la sortie.
#
# PAS de husky : son cycle `prepare` casse `npm ci` dans un workspace en CI.
#
# Contournement d'urgence : ajouter `--no-verify` ou `--dry-run` au push. Ne PAS
# contourner sans demande explicite de l'utilisateur.
set -u

COMMAND=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0

# On n'intercepte que les commandes contenant `git push`, y compris au milieu d'une
# chaîne du type `git add -A && git commit -m "…" && git push origin main`.
if ! echo "$COMMAND" | grep -qE '(^|[[:space:]&|;])git[[:space:]]+push([[:space:]]|$)'; then
  exit 0
fi

if echo "$COMMAND" | grep -qE '(--no-verify|--dry-run)'; then
  exit 0
fi

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$REPO_ROOT" ] || exit 0
cd "$REPO_ROOT" || exit 0

# Ne rien bloquer dans un dépôt qui n'a pas explicitement défini ces portes.
if ! node -e "process.exit(require('./package.json').scripts?.health ? 0 : 1)" 2>/dev/null; then
  exit 0
fi

echo "🔍 [pre-push] portes de qualité avant \`git push\`…"
echo

if npm run health; then
  exit 0
fi

jq -n --arg reason "npm run health a échoué — corriger la porte en défaut puis réessayer, ou contourner avec --no-verify" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $reason
  }
}' >&2
exit 2
