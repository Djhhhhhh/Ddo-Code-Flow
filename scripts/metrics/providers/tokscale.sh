#!/usr/bin/env bash
# tokscale provider: returns cumulative input/output token totals from tokscale cache.
set -euo pipefail

INPUT=$(cat)

if ! command -v tokscale >/dev/null 2>&1; then
  echo '{"error":"tokscale CLI not found; install from https://github.com/junhoyeo/tokscale"}' >&2
  exit 1
fi

# Best-effort sync; do not fail capture if sync fails (warn only).
tokscale cursor sync >/dev/null 2>&1 || true

# tokscale --client cursor --format json outputs usage summary when available.
RAW=$(tokscale --client cursor --format json 2>/dev/null || true)
if [ -z "$RAW" ]; then
  echo '{"error":"tokscale returned no data; run tokscale cursor login first"}' >&2
  exit 1
fi

# Parse with node (expected in Cursor dev environments).
node -e "
const raw = process.argv[1];
let data;
try { data = JSON.parse(raw); } catch { process.exit(2); }
const pick = (obj) => {
  const input =
    obj.inputTokens ?? obj.input_tokens ?? obj.totalInputTokens ?? obj.prompt_tokens ?? null;
  const output =
    obj.outputTokens ?? obj.output_tokens ?? obj.totalOutputTokens ?? obj.completion_tokens ?? null;
  return { inputTokens: Number(input), outputTokens: Number(output), raw: obj };
};
let result = pick(data);
if (Number.isFinite(result.inputTokens) && Number.isFinite(result.outputTokens)) {
  process.stdout.write(JSON.stringify({ ...result, source: 'tokscale' }));
  process.exit(0);
}
// Some tokscale versions wrap totals under usage / totals.
for (const key of ['usage', 'totals', 'total', 'summary']) {
  if (data[key] && typeof data[key] === 'object') {
    result = pick(data[key]);
    if (Number.isFinite(result.inputTokens) && Number.isFinite(result.outputTokens)) {
      process.stdout.write(JSON.stringify({ ...result, source: 'tokscale' }));
      process.exit(0);
    }
  }
}
process.stderr.write(JSON.stringify({ error: 'unable to parse tokscale JSON shape', raw: data }));
process.exit(3);
" "$RAW"
