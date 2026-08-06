# Metrics Runtime Plugin

Metrics is an optional run-level runtime hook. It is not an atom-task and never
appears in `workflows/*.json`.

## When It Runs

The runtime may call:

```text
node scripts/metrics/plugin.js runStart  --run-dir <artifactDir> --config <config-file> --skill-root <skillRoot>
node scripts/metrics/plugin.js runFinish --run-dir <artifactDir> --config <config-file> --skill-root <skillRoot>
```

In v4, effective config is composed in memory from:

```text
config.default.json <- projectRoot/.ddo/config.json <- run arguments
```

If the executor needs a file path for `--config`, it may write a temporary file
outside the run artifacts. Do not commit or persist a per-run effective config
inside `.ddo/runs/`.

## Providers

Registered providers live in `scripts/metrics/providers/registry.json`.

- `tokscale`: reads local IDE cumulative token counts through the tokscale CLI.
- `custom-command`: runs a user configured capture command.
- `cursor-session-counter`: reads `.metrics/session-counter.json` from the run.
- `cursor-sdk`: reads `.metrics/sdk-usage.json` from the run.

## Output

When enabled, `runFinish` records `metrics.snapshotAfter`,
`metrics.runTotal`, and optionally `metrics-report.md` under `artifactDir`.

Failure behavior follows `base.metrics.failurePolicy`:

- `warn`: record the metrics failure and continue the workflow.
- `fail`: return a failing exit code so the runtime may stop.
