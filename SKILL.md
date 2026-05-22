---
name: ddo-swe
description: |
  Customizable AI coding pipeline skill. Use when the user wants to drive a
  multi-stage spec → plan → test-plan → tasking → coding → verification →
  review → reporting → reflection workflow on a target project, with
  user-confirmation gates between key stages.
metadata:
  authors:
    - "djhhhhhh"
  version: "1.0.0"
---

# ddo-swe

## When to use

Activate this skill when the user asks to "use ddo-swe", "run the pipeline",
"按流水线开发", or otherwise references the multi-stage AI coding workflow
defined by this skill. Do NOT activate for one-off coding requests that don't
require the full pipeline.

## Inputs

- `requirement.md` in the target directory, OR an inline user prompt
  describing the requirement.
- `skills/ddo-swe/config.json` — pipeline definition.
- `skills/ddo-swe/atom-tasks/<name>/<name>.json` — atom-task definitions.

## Execution (read top-to-bottom each session)

This skill is an **instruction-driven runtime**. You (the agent) are the
executor. Do not implement business logic in this file; only follow the
mechanical loop below.

### Step 1 — Load and validate

1. Read `skills/ddo-swe/config.json` and `skills/ddo-swe/config.schema.json`.
2. Validate `config.json` against the schema. Reject and abort on failure.
3. For every stage in `config.pipeline`, run the DAG no-cycle check on
   `atomTasks.entry` + `atomTasks.nodes[*].next`. Reject and abort on any
   cycle.
4. If any `atomTasks` is a legacy string array (older schema), convert it
   in-place to the DAG form (first item becomes `entry`; each item's `next`
   is the next item) and **persist** the upgraded `config.json`. Tell the
   user the schema was auto-upgraded.

### Step 2 — Resolve target directory and run dir

1. Resolve `targetDir` relative to the current working directory.
2. If a `<target>/YYYY-MM-DD-<desp>/.state.json` already exists for an
   in-progress run, read it and resume from `currentStage`. Otherwise, the
   Specification stage will create a fresh `YYYY-MM-DD-<desp>/` directory.

### Step 3 — Execute the pipeline

For each `stageDef` in `config.pipeline`, in order, skipping stages whose
`.state.json.stages[stageDef.stage].status == "done"`:

1. **Resolve effective DAG**:
   - Start from `stageDef.atomTasks`.
   - Drop every node whose effective `enabled == false`. The effective value
     is `atomTaskOverrides[name].enabled` if present, else the atom-task
     JSON's own `enabled` field.
   - If `entry` becomes empty after pruning, mark the stage as `skipped` in
     `.state.json` and continue.

2. **Topological batching**:
   - Compute layers via Kahn's algorithm. Each layer is a set of nodes whose
     dependencies have all completed.
   - For each layer, in order:
     a. For every node in the layer (you may produce outputs for the whole
        layer in a single response when possible):
        - Load `atom-tasks/<name>/<name>.json`.
        - Resolve every `io.inputs[*].ref` and `io.outputs[*].ref`:
          - `skill://<path>` → `skills/ddo-swe/<path>` (read-only).
          - `run://<path>` → `<target>/<run-dir>/<path>`.
          - `run://../<path>` → `<target>/<path>`.
        - Execute the node's `prompt.instruction` with the resolved inputs,
          honoring `prompt.guardrails`.
        - Write outputs to disk.
        - Update `.state.json.stages[stageDef.stage]` and (if applicable)
          a per-node entry.
     b. After the layer finishes, collect all nodes in the layer whose
        `parallelApprove == true`. If the set is non-empty, present **one
        merged confirmation request** to the user, listing every output
        produced by these nodes. Wait for the user's reply.
        - On approve: mark each node's confirmation as `approved`.
        - On reject with feedback: re-run only the rejected nodes with the
          feedback appended to their `prompt.instruction`. Repeat until
          approved.

3. **Stage-level confirmation gate**:
   - If `stageDef.stage` is in `config.base.confirmationGates` AND no
     parallel-approve gate already covered the stage's terminal outputs,
     present a single confirmation request for the stage's terminal outputs.
   - Handle approve / reject identically to step 2.b.

4. **Persist state**:
   - At every transition (node start, node end, layer end, stage end), update
     `.state.json` and write it to disk before continuing.

### Step 4 — Verification failure recovery

If the `verification` atom-task writes anything other than `ALL PASSED` to
`verification.log`, jump back to the `coding` stage:
1. Re-read failing items from `verification.log`.
2. Identify which task(s) in `tasks/task-group.json` cover the failing items.
3. Re-run those Coding tasks (you may add new tasks if needed).
4. Re-run Verification. Repeat until `ALL PASSED`.

### Step 5 — Finalize

After the `reflection` stage's confirmation is `approved`:
1. Mark the `done` stage's status as `done` in `.state.json`.
2. Tell the user the run is complete and point them to `<run>/execution-report.md`.

## Outputs to maintain

- `<run>/.state.json` — pipeline state machine. Updated at every transition.
- `<run>/spec.md`, `plan.md`, `test-plan.md`, `verification.log`,
  `execution-report.md`, `reflection-report.md` — produced by their
  respective atom-tasks.
- `<run>/tasks/task-NN.md` and `<run>/tasks/task-group.json` — produced by
  the `tasking` atom-task. `task-group.json` MUST be inside `tasks/`, not
  alongside it.

## Failure modes (recap)

| Trigger | Recovery |
|---|---|
| User rejects a confirmation gate | Re-run the relevant atom-task(s) with feedback appended to `prompt.instruction`. Record the rejection in `.state.json.history`. |
| Verification fails | Jump back to Coding. See Step 4. |
| Session interrupted mid-run | On next start, Step 2 reads `.state.json` and resumes from `currentStage`. Append a `resumed` entry to `.state.json.history`. |
| `<desp>` collides with an existing run directory | Append `-2`, `-3`, ... to the suffix until unique. Record the final name in `.state.json.runId`. |
| Schema or DAG validation fails | Abort with a clear error message; do not produce any artifacts. |

## What this skill does NOT do

- It does NOT embed business logic. All "what to do" lives in atom-task JSON
  files under `atom-tasks/<name>/`.
- It does NOT modify any atom-task JSON file. Enable/disable toggles go to
  `config.json`'s `atomTaskOverrides`.
- It does NOT depend on any runtime besides the agent itself and a POSIX-ish
  shell for `verification` commands.
- It does NOT start a server. The companion UI in `ui/` is a static page
  loaded via `file://` and the File System Access API.
