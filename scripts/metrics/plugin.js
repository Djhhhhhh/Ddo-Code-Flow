#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { estimateCostUsd } = require("./pricing");

function usage() {
  process.stderr.write(`Usage:
  node plugin.js runStart  --run-dir <path> --config <path> --skill-root <path>
  node plugin.js runFinish --run-dir <path> --config <path> --skill-root <path>
`);
  process.exit(2);
}

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--run-dir") opts.runDir = argv[++i];
    else if (arg === "--config") opts.configPath = argv[++i];
    else if (arg === "--skill-root") opts.skillRoot = argv[++i];
    else if (arg.startsWith("-")) usage();
    else positional.push(arg);
  }
  opts.event = positional[0];
  if (!opts.event || !opts.runDir || !opts.configPath || !opts.skillRoot) usage();
  if (opts.event !== "runStart" && opts.event !== "runFinish") usage();
  return opts;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function loadRegistry(skillRoot) {
  const registryPath = path.join(skillRoot, "scripts/metrics/providers/registry.json");
  return readJson(registryPath);
}

function invokeProvider(providerId, skillRoot, context) {
  const registry = loadRegistry(skillRoot);
  const entry = registry.providers?.[providerId];
  if (!entry?.script) {
    throw new Error(`Unknown metrics provider: ${providerId}`);
  }
  const scriptPath = path.join(skillRoot, "scripts/metrics", entry.script);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Provider script missing: ${scriptPath}`);
  }

  const payload = JSON.stringify(context);
  const result = spawnSync("bash", [scriptPath], {
    input: payload,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const errMsg = (result.stderr || result.stdout || "").trim() || `exit ${result.status}`;
    throw new Error(errMsg);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error(`Provider ${providerId} returned invalid JSON: ${result.stdout}`);
  }

  const inputTokens = Number(parsed.inputTokens);
  const outputTokens = Number(parsed.outputTokens);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    throw new Error(
      `Provider ${providerId} must return inputTokens and outputTokens numbers`
    );
  }

  return {
    inputTokens,
    outputTokens,
    capturedAt: new Date().toISOString(),
    source: parsed.source || providerId,
    raw: parsed.raw ?? parsed,
  };
}

function formatNumber(n) {
  return Number(n).toLocaleString("en-US");
}

function renderReport(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(String(value ?? ""));
  }
  return out;
}

function generateReport(runDir, state, metricsConfig, skillRoot) {
  const relPath = metricsConfig.report?.path || "metrics-report.md";
  const templatePath = path.join(skillRoot, "scripts/metrics/templates/metrics-report.md");
  const template = fs.readFileSync(templatePath, "utf8");
  const runTotal = state.metrics.runTotal || {};
  const cost =
    runTotal.estimatedCostUsd != null
      ? `$${runTotal.estimatedCostUsd} USD`
      : "N/A (set pricing in config.base.metrics.pricing)";

  const pricingModel = String(metricsConfig.pricing?.model || "").trim();
  const pricingModelLine = pricingModel ? `- **Pricing model (label):** \`${pricingModel}\`\n` : "";

  const body = renderReport(template, {
    runId: state.runId || path.basename(runDir),
    inputTokens: formatNumber(runTotal.inputTokens),
    outputTokens: formatNumber(runTotal.outputTokens),
    totalTokens: formatNumber(runTotal.totalTokens),
    estimatedCostUsd: cost,
    provider: state.metrics.provider,
    pricingModelLine,
    snapshotBeforeAt: state.metrics.snapshotBefore?.capturedAt || "—",
    snapshotAfterAt: state.metrics.snapshotAfter?.capturedAt || "—",
  });

  const outPath = path.join(runDir, relPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body, "utf8");
  return relPath;
}

function recordFailure(state, metricsConfig, error) {
  state.metrics = state.metrics || {};
  state.metrics.enabled = metricsConfig.enabled;
  state.metrics.provider = metricsConfig.provider;
  state.metrics.failurePolicy = metricsConfig.failurePolicy;
  state.metrics.status = "failed";
  state.metrics.error = String(error.message || error);
  state.history = state.history || [];
  state.history.push({
    at: new Date().toISOString(),
    stage: "metrics",
    action: "failed",
    detail: state.metrics.error,
  });
}

function ensureMetricsShell(state, metricsConfig) {
  state.metrics = state.metrics || {};
  state.metrics.enabled = metricsConfig.enabled;
  state.metrics.provider = metricsConfig.provider;
  state.metrics.failurePolicy = metricsConfig.failurePolicy;
  if (!state.metrics.status) state.metrics.status = "pending";
}

function computeRunTotal(before, after, pricing) {
  const inputTokens = after.inputTokens - before.inputTokens;
  const outputTokens = after.outputTokens - before.outputTokens;
  if (inputTokens < 0 || outputTokens < 0) {
    throw new Error(
      "Negative token delta (snapshotAfter < snapshotBefore). Check for concurrent sessions or counter reset."
    );
  }
  const totalTokens = inputTokens + outputTokens;
  const estimatedCostUsd = estimateCostUsd(inputTokens, outputTokens, pricing);
  const runTotal = {
    inputTokens,
    outputTokens,
    totalTokens,
    confidence: "exact",
    currency: "USD",
  };
  if (estimatedCostUsd != null) runTotal.estimatedCostUsd = estimatedCostUsd;
  return runTotal;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const config = readJson(opts.configPath);
  const metricsConfig = config.base?.metrics;

  if (!metricsConfig?.enabled) {
    process.stdout.write(JSON.stringify({ status: "skipped", reason: "metrics disabled" }));
    process.exit(0);
  }

  const statePath = path.join(opts.runDir, ".state.json");
  if (!fs.existsSync(statePath)) {
    process.stderr.write(`Missing state file: ${statePath}\n`);
    process.exit(1);
  }

  const state = readJson(statePath);
  ensureMetricsShell(state, metricsConfig);

  const captureContext = {
    event: opts.event,
    runDir: path.resolve(opts.runDir),
    statePath,
    skillRoot: path.resolve(opts.skillRoot),
    config: config.base,
    state,
  };

  try {
    if (opts.event === "runStart") {
      if (state.metrics.snapshotBefore?.inputTokens != null) {
        state.metrics.status = state.metrics.status === "failed" ? "failed" : "started";
        writeJson(statePath, state);
        process.stdout.write(
          JSON.stringify({ status: "skipped", reason: "snapshotBefore already captured (resume)" })
        );
        process.exit(0);
      }
      const snapshot = invokeProvider(metricsConfig.provider, opts.skillRoot, captureContext);
      state.metrics.snapshotBefore = snapshot;
      state.metrics.status = "started";
      writeJson(statePath, state);
      process.stdout.write(JSON.stringify({ status: "ok", snapshotBefore: snapshot }));
      process.exit(0);
    }

    // runFinish
    const snapshotAfter = invokeProvider(metricsConfig.provider, opts.skillRoot, captureContext);
    state.metrics.snapshotAfter = snapshotAfter;

    if (!state.metrics.snapshotBefore) {
      throw new Error("snapshotBefore missing; runStart metrics plugin must run first");
    }

    state.metrics.runTotal = computeRunTotal(
      state.metrics.snapshotBefore,
      snapshotAfter,
      metricsConfig.pricing
    );
    state.metrics.status = "ok";
    state.metrics.error = undefined;

    if (metricsConfig.report?.enabled) {
      const reportRel = generateReport(opts.runDir, state, metricsConfig, opts.skillRoot);
      state.metrics.reportPath = reportRel;
    }

    writeJson(statePath, state);
    process.stdout.write(
      JSON.stringify({ status: "ok", runTotal: state.metrics.runTotal, reportPath: state.metrics.reportPath })
    );
    process.exit(0);
  } catch (err) {
    recordFailure(state, metricsConfig, err);
    writeJson(statePath, state);
    process.stderr.write(`${err.message || err}\n`);
    // failurePolicy warn: exit 0 so workflow is not blocked
    const code = metricsConfig.failurePolicy === "fail" ? 1 : 0;
    process.stdout.write(JSON.stringify({ status: "failed", error: state.metrics.error }));
    process.exit(code);
  }
}

main();
