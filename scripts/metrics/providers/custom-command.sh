#!/usr/bin/env bash
# custom-command provider: delegates capture to user script from config.metrics.customCommand
set -euo pipefail

INPUT=$(cat)

CMD=$(printf '%s' "$INPUT" | node -e "
const ctx = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const cmd = ctx.config?.metrics?.customCommand;
if (!cmd) {
  process.stderr.write('metrics.customCommand is required for custom-command provider\\n');
  process.exit(1);
}
process.stdout.write(cmd);
")

SKILL_ROOT=$(printf '%s' "$INPUT" | node -e "
const ctx = JSON.parse(require('fs').readFileSync(0, 'utf8'));
process.stdout.write(ctx.skillRoot || '');
")

resolve_skill_uri() {
  local uri="$1"
  local skill_root="$2"
  if [[ "$uri" == skill://* ]]; then
    echo "${skill_root}/${uri#skill://}"
  else
    echo "$uri"
  fi
}

RESOLVED=$(resolve_skill_uri "$CMD" "$SKILL_ROOT")

if [ ! -f "$RESOLVED" ] && ! command -v "$RESOLVED" >/dev/null 2>&1; then
  echo "{\"error\":\"custom command not found: $RESOLVED\"}" >&2
  exit 1
fi

if [ -f "$RESOLVED" ]; then
  printf '%s' "$INPUT" | bash "$RESOLVED"
else
  printf '%s' "$INPUT" | eval "$RESOLVED"
fi
