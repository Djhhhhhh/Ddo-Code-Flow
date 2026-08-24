---
name: ddo-code-flow
description: |
  Customizable AI coding pipeline skill. Drives workflows defined by
  config.default.json and workflows/*.json. v4 keeps atom-tasks decoupled:
  tasks declare artifact roles, the runtime wires them through a blackboard,
  and pipelines are the only integration layer.
metadata:
  authors:
    - "djhhhhhh"
  version: "4.0.0"
---

# ddo-code-flow

## When to use

Activate this skill when the user asks to "use ddo-code-flow", "run the pipeline",
"按流水线开发", or otherwise references the multi-stage AI coding workflow
defined by this skill. Do not activate for one-off coding requests that do not
need the full pipeline.

## Runtime Locations

- `skillRoot`: directory containing this `SKILL.md`, `config.default.json`,
  schemas, workflows, and atom-tasks. It is read-only during a run.
- `projectRoot`: target Git repository where the user invoked the skill.
- `projectConfig`: `<projectRoot>/.ddo/config.json`. It is the only project-owned
  configuration file and is created on first run when absent.
- `worktreeDir`: effective config value that receives worktrees. Empty means the
  parent directory of `projectRoot`.
- `worktreePath`: isolated Git worktree for one run. Source edits and project
  commands are allowed only here.
- `artifactDir`: `<worktreePath>/.ddo/runs/<type>/<dateDescription>`. Runtime
  state, blackboard metadata, and generated run artifacts live here.

## Inputs

- User requirement from the triggering message.
- Minimal run arguments:
  - `--model <workflow-id>` selects a workflow explicitly.
  - `--feature` marks the run type as `feat`.
  - `--bugfix` marks the run type as `fix`.
  - `--atom <task-name>` triggers a single atom-task without running the full
    pipeline. When set, skip Steps 3–7 and execute only the named atom-task.
- `config.default.json`: read-only global defaults and workflow index.
- `config.schema.json`: schema for defaults, workflow JSON, and project config.
- `state.schema.json`: schema and ownership contract for `.state.json` top-level
  fields.
- `workflows/*.json`: pipeline definitions and confirmation gates.
- `atom-tasks/artifacts.json`: artifact role catalog.
- `atom-tasks/<name>/<name>.md`: atom-task frontmatter and instructions. Load an
  atom-task only when entering its node.

## Core Contract

### Layer Responsibilities

| Layer | Owns | Must Not Own |
|---|---|---|
| atom-task | Business instruction, produced roles, consumed roles, options, reject behavior | Stage membership, concrete artifact paths, upstream task names, global config reads |
| workflow | Stage order, DAG nodes, `taskRef`, node options, confirmation gates | Business instructions, artifact file paths |
| config | Global defaults, project overrides, atom-task option overrides | Generated run state or per-run effective config files |
| runtime | Config composition, DAG validation, role injection, artifact registration, state, recovery | Business decisions already owned by atom-tasks |

### Artifact Blackboard

Atom-tasks declare:

```yaml
produces:
  - role: spec
    kind: markdown
    primary: true
consumes:
  - role: requirement
    required: true
```

The runtime resolves roles through `atom-tasks/artifacts.json`. After a node
writes an output, register it in `.state.json.artifacts`:

```json
{
  "spec": {
    "path": "run://.ddo/runs/feat/2026-08-06-example/spec.md",
    "producer": "spec",
    "stage": "spec",
    "at": "<ISO 8601>"
  }
}
```

When entering a node, inject each consumed role into the instruction as
`{{inputs.<role>}}`. Required missing roles fail the node. Optional missing roles
are skipped and recorded in history. Dynamic role `stage-artifact` resolves to
the current stage's latest primary artifact and is used by `remote-gate`.

## Runtime CLI

The deterministic core — DAG validation, role injection, state write ownership,
confirmation gates, stage advancement — lives in code (`scripts/runtime/`), not
prose. The model invokes stateless Node subcommands; each reads `.state.json`
fresh and answers through the four-channel contract:

| Channel | Contract |
|---|---|
| stdout | Structured JSON only (or the pre-computed instruction text). The model reads it to decide the next action. |
| stderr | Human-readable explanation on non-zero exit. |
| exit code | `0` ok · `1` hard failure (enter the correction loop) · `2` usage error · `77` pending (remote gate / CI) |
| `.state.json` | Sole source of truth. Every command reads fresh — no in-memory cache. |

Entry point:

```text
node <skillRoot>/scripts/runtime/ddo.js <subcommand> [--flags]
```

All state writes go through the single `applyMutation(state, patch, writer)`
guard, which enforces the `x-ddo-writer` ownership declared in
`state.schema.json`: an unauthorized write or a newly invented top-level field
exits `1`.

## Execution

### Step 1 - Compose Config

```text
node <skillRoot>/scripts/runtime/ddo.js compose-config \
  --skill-root <skillRoot> --project-root <projectRoot> [--args-json '<json>']
```

- What it does: deep-merges `config.default.json <- .ddo/config.json <- run args`
  (objects recurse, arrays replace, scalars replace) and prints the effective
  config to stdout. It never writes an effective config file to disk.
- Before calling, ensure `<projectRoot>/.ddo/` exists — on first run create
  `.ddo/config.json` (minimal project config) and `.ddo/runs/`. Do not modify
  `.gitignore`, git exclude, or any git visibility setting.
- Exit `0` = merged config on stdout; `2` = missing flag (fix the invocation).

### Step 2 - Resolve Workflow And Run Type

```text
node <skillRoot>/scripts/runtime/ddo.js select-workflow \
  --skill-root <skillRoot> [--model <id>] [--feature|--bugfix] [--text '<requirement>']
```

- What it does: resolves `{workflowId, runType, workflowPath}` — `--model` explicit
  > `selection.rules` match (against `--model`, then requirement text) > fallback.
  `--feature` → `feat`, `--bugfix` → `fix`, otherwise inferred or `defaultRunType`.
- Display the pipeline summary from the returned JSON before proceeding:
  ```
  ▸ Workflow: <name> — <description>
  ▸ Run type: <feat|fix>
  ▸ Issue: #<N>          (only when issue-driven)
  ▸ Stages: <stage1> → <stage2> → ... → done
  ```
- Exit `0` = selection JSON; `2` = usage error.

### Step 2.5 - Single Atom-Task Execution (--atom)

When `--atom <task-name>` is present, skip Steps 3–7 entirely. Load
`atom-tasks/<task-name>/<task-name>.md`, resolve its `consumes` roles from
`.state.json.artifacts` (abort listing any missing required role), execute the
instruction as a standalone task, then register outputs with `register-artifact`
and validate with `validate-output` (see Step 5).

### Step 3 - Validate DAG

```text
node <skillRoot>/scripts/runtime/ddo.js validate-dag \
  --skill-root <skillRoot> --workflow <workflowPath>
```

- What it does: traverses the workflow in stage order and node topological order,
  checks every produced/consumed role exists in `artifacts.json`, and that every
  `required:true` consume is already produced upstream (except `stage-artifact`).
  Cycles and duplicate same-run producers are rejected.
- Exit `1` = the workflow is invalid (stderr lists the errors). Fix the workflow
  JSON or the atom-task declarations, then re-run — never proceed past this gate.
- Exit `0` = DAG is reachable.

### Step 4 - Initialize Or Resume State

```text
node <skillRoot>/scripts/runtime/ddo.js find-resumable \
  --skill-root <skillRoot> --project-root <projectRoot> [--worktree-dir <dir>]

node <skillRoot>/scripts/runtime/ddo.js init-state \
  --skill-root <skillRoot> --project-root <projectRoot> --workflow <workflowPath> \
  [--workflow-id <id>] [--run-type feat|fix] [--args-json '<json>']
```

- `find-resumable` scans `*/.ddo/runs/*/*/.state.json` for a candidate with
  `currentStage != "done"`, matching `projectRoot`, and an existing `worktreePath`.
  Exactly one → resume (append `resumed` to history; resolve the skill by
  `skillName`, using stored `skillRoot` only as a hint). Multiple → exit `1`,
  ask the user to choose. None → run `init-state`.
- `init-state` prints the fresh state skeleton; git-worktree fields (`runId`,
  `worktreePath`, `type`, `dateDescription`, `artifactDir`) stay null until the
  worktree exists. Persist it to `.state.json`; it must validate against
  `state.schema.json`.
- `.state.json` is the ownership contract. Writers: `git-worktree` (runId,
  worktreePath, type, dateDescription, artifactDir), `issue-fetch` (issueContext),
  `remote-gate` (gatePending), `create-pr` (prInfo), `runtime` (everything else).

### Step 5 - Execute Nodes

For each stage, skipping stages already `done`:

1. Pick the next batch:
   ```text
   node <skillRoot>/scripts/runtime/ddo.js next-node \
     --skill-root <skillRoot> --state <statePath>
   ```
   Prints the in-degree-0 batch: each node's self-contained instruction with
   `{{inputs.<role>}}` resolved to artifact paths and options merged (workflow
   override > config override > node options > atom-task defaults). If
   `done: true`, no nodes remain — go to Step 7.
2. Execute each instruction and honor its constraints. If `outputSchemaRef`
   exists, read it and use its sections/rules/example.
3. Register each produced role (artifact text via stdin):
   ```text
   printf '%s' '<artifact text>' | node <skillRoot>/scripts/runtime/ddo.js register-artifact \
     --skill-root <skillRoot> --state <statePath> --role <role> [--producer <node>] [--stage <stage>]
   ```
   Writes the file under `artifactDir`, records `.state.json.artifacts[role]`,
   and appends `node-done`. Exit `1` = the role is not in `artifacts.json` or
   `artifactDir` is not ready — hold the text in `pendingOutputs` and flush after
   `git-worktree` sets `artifactDir`.
4. Validate each produced output:
   ```text
   node <skillRoot>/scripts/runtime/ddo.js validate-output \
     --skill-root <skillRoot> --artifact <artifactPath> --output-schema-ref <schemaRef>
   ```
   `json` outputs are checked against `jsonFields`; `markdown` outputs must contain
   every `required:true` section heading; `.state.json` is checked against
   `state.schema.json`. Exit `1` = hard reject — read stderr, fix, re-register.

Calling each subcommand is a soft trigger (the model calls them via the Bash
tool), but the outcome is hard: a non-zero exit cannot be reasoned away — read
stderr, correct, re-run.

### Step 6 - Confirmation Gates

Confirmation gates live only in workflow JSON (`confirmationGates`). After a gate
stage's terminal outputs, call:

```text
node <skillRoot>/scripts/runtime/ddo.js gate \
  --skill-root <skillRoot> --state <statePath> --stage <stage> \
  --action approved|rejected|pending [--feedback '<text>']
```

- `approved` → appends `gate-approved`; proceed to `advance-stage`.
- `rejected` → appends `gate-rejected` with feedback, archive the previous version
  to `_del`, rerun the affected node, and request approval again.
- `pending` (remote gate) → exit `77`; poll later.
- Ask the user only for stages in `confirmationGates` that have no `remote-gate` node.

### Step 7 - Advance Stage And Finalize

```text
node <skillRoot>/scripts/runtime/ddo.js advance-stage \
  --skill-root <skillRoot> --state <statePath>
```

- Hard terminal check before advancing `currentStage`: every node in the current
  stage `done`, the stage's gate (if any) approved, no running/failed/pending.
- Exit `1` = a terminal condition is unmet (stderr lists it); do not advance.
  Exit `0` = `currentStage` moved to the next stage (or `done`).
- Before `done`, also enforce: no pending outputs or unresolved role bindings;
  verification (when enabled) ends with `ALL PASSED` and no unanswered `human:`
  checks. Follow the current atom-task's recovery instructions — the runtime does
  not hardcode business recovery targets.

After `done`, run metrics finish when enabled (see Metrics).

## Metrics

Metrics is not an atom-task and never appears in workflow DAGs. When enabled,
invoke:

```text
node <skillRoot>/scripts/metrics/plugin.js runStart  --run-dir <artifactDir> --config <effective-config-json> --skill-root <skillRoot>
node <skillRoot>/scripts/metrics/plugin.js runFinish --run-dir <artifactDir> --config <effective-config-json> --skill-root <skillRoot>
```

The config argument may point to a temporary runtime-generated file if the
executor needs a file path, but it must not be stored in the run artifacts as a
per-run effective config. Metrics failure follows `failurePolicy` and does not
change workflow success when the policy is `warn`.

## What This Skill Does Not Do

- It does not write to `skillRoot` during a run.
- It does not manage `.gitignore` or git exclude.
- It does not place worktrees inside `.ddo/runs/`.
- It does not add metrics stages or per-atom token attribution.
- It does not keep v2/v3 compatibility logic.
