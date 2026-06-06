#!/usr/bin/env bash
# cursor-sdk: reads cumulative usage from run/.metrics/sdk-usage.json (written by SDK runner).
set -euo pipefail

INPUT=$(cat)

printf '%s' "$INPUT" | node -e "
const ctx = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const fs = require('fs');
const path = require('path');

const sdkFile = path.join(ctx.runDir, '.metrics', 'sdk-usage.json');
if (!fs.existsSync(sdkFile)) {
  process.stderr.write(JSON.stringify({ error: 'missing ' + sdkFile }));
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(sdkFile, 'utf8'));
const input = Number(data.inputTokens);
const output = Number(data.outputTokens);
if (!Number.isFinite(input) || !Number.isFinite(output)) {
  process.stderr.write(JSON.stringify({ error: 'sdk-usage.json requires inputTokens and outputTokens' }));
  process.exit(2);
}
process.stdout.write(JSON.stringify({ inputTokens: input, outputTokens: output, raw: data, source: 'cursor-sdk' }));
"
