# Metrics Report — {{runId}}

## Run total (exact)

| Metric | Value |
|--------|------:|
| Input tokens | {{inputTokens}} |
| Output tokens | {{outputTokens}} |
| Total tokens | {{totalTokens}} |
| Estimated cost | {{estimatedCostUsd}} |

- **Provider:** `{{provider}}`
{{pricingModelLine}}- **Captured:** {{snapshotBeforeAt}} → {{snapshotAfterAt}}
- **Confidence:** exact

## Note

This report covers the **entire workflow run** only. Per-stage or per-atom-task token attribution is not available in this version.

See [docs/metrics.md](../../docs/metrics.md) for provider setup and limitations.
