#!/usr/bin/env bash
# Example custom provider for local testing. Maintains a cumulative counter in run/.metrics/dev-counter.json.
set -euo pipefail

INPUT=$(cat)

printf '%s' "$INPUT" | node -e "
const ctx = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const fs = require('fs');
const path = require('path');

const runDir = ctx.runDir;
const metricsDir = path.join(runDir, '.metrics');
const counterFile = path.join(metricsDir, 'dev-counter.json');
const stepIn = 50000;
const stepOut = 8000;

fs.mkdirSync(metricsDir, { recursive: true });
let data = { inputTokens: 1200000, outputTokens: 180000 };
if (fs.existsSync(counterFile)) {
  data = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
}
data.inputTokens = Number(data.inputTokens) + stepIn;
data.outputTokens = Number(data.outputTokens) + stepOut;
fs.writeFileSync(counterFile, JSON.stringify(data));
process.stdout.write(JSON.stringify({
  inputTokens: data.inputTokens,
  outputTokens: data.outputTokens,
  source: 'example-cumulative',
  raw: data,
}));
"
