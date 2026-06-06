#!/usr/bin/env bash
# cursor-session-counter: reads run/.metrics/session-counter.json { inputTokens, outputTokens }
set -euo pipefail

INPUT=$(cat)

printf '%s' "$INPUT" | node -e "
const ctx = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const fs = require('fs');
const path = require('path');

const counterFile = path.join(ctx.runDir, '.metrics', 'session-counter.json');
if (!fs.existsSync(counterFile)) {
  process.stderr.write(JSON.stringify({ error: 'missing ' + counterFile }));
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
const input = Number(data.inputTokens);
const output = Number(data.outputTokens);
if (!Number.isFinite(input) || !Number.isFinite(output)) {
  process.stderr.write(JSON.stringify({ error: 'session-counter.json requires inputTokens and outputTokens' }));
  process.exit(2);
}
process.stdout.write(JSON.stringify({ inputTokens: input, outputTokens: output, raw: data, source: 'cursor-session-counter' }));
"
