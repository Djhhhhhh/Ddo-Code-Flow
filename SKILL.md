---
name: ddo-code-flow
description: |
  Customizable AI coding pipeline skill. Drives a multi-stage workflow defined
  in config.json, with user-confirmation gates between key stages. The pipeline
  stages, atom-tasks, and their order are fully configurable — this skill is a
  generic runtime that executes whatever DAG the config defines.
metadata:
  authors:
    - "djhhhhhh"
  version: "1.0.2"
---

# ddo-code-flow

## When to use

Activate this skill when the user asks to "use ddo-code-flow", "run the pipeline",
"按流水线开发", or otherwise references the multi-stage AI coding workflow
defined by this skill. Do NOT activate for one-off coding requests that don't
require the full pipeline.

## Inputs

- An inline user prompt describing the requirement (the message that triggered this skill).
- `config.json` — pipeline definition (project root).
- `config.schema.json` — JSON Schema for validation (project root).
- `atom-tasks/<name>/<name>.json` — atom-task definitions (project root).

## Execution (read top-to-bottom each session)

This skill is an **instruction-driven runtime**. You (the agent) are the
executor. Do not implement business logic in this file; only follow the
mechanical loop below.

### Step 1 — Load and validate

1. Read `config.json` and `config.schema.json` from the project root.
2. Validate `config.json` against the schema. Reject and abort on failure.
3. For every stage in `config.pipeline`, run the DAG no-cycle check on
   `atomTasks.entry` + `atomTasks.nodes[*].next`. Reject and abort on any
   cycle.
4. If any `atomTasks` is a legacy string array (older schema), convert it
   in-place to the DAG form (first item becomes `entry`; each item's `next`
   is the next item) and **persist** the upgraded `config.json`. Tell the
   user the schema was auto-upgraded.

### Step 2 — Resolve target directory and initialize state

> **Design decision**: Step 2 does NOT create a run directory. The run directory
> (i.e., the worktree directory) is created by the `git-worktree` atom-task
> during pipeline execution. This ensures all artifacts — including early-stage
> outputs like `context-summary.md` — are written to a single unified directory.

1. Resolve `targetDir` relative to the current working directory.
2. Search `targetDir` for an existing `.state.json` (any subdirectory matching
   `*/docs/*/.state.json`). If found, read it and resume from `currentStage`.
   Append a `resumed` entry to `.state.json.history`.
3. If no resumable run is found, initialize `.state.json` **in memory only**
   (do NOT write to disk yet — there is no directory to write to):
   ```json
   {
     "runId": null,
     "createdAt": "<ISO 8601>",
     "userRequirement": "<verbatim user prompt>",
     "currentStage": "context",
     "stages": {},
     "history": [{ "event": "created", "at": "<ISO 8601>" }]
   }
   ```
   The `runId` and `worktreePath` fields will be populated later by the
   `git-worktree` atom-task.
4. Metrics (runStart) is **deferred** to after the run directory is created
   (see Step 3 notes). When `config.base.metrics.enabled == false`, skip
   entirely.

### Step 3 — Execute the pipeline

**Path resolution rules** (apply throughout):

| Prefix | Resolves to | When |
|---|---|---|
| `skill://<path>` | Project root `/<path>` (read-only) | Always |
| `run://<path>` | `<worktreePath>/<path>` | After git-worktree sets `worktreePath` |
| `run://docs/{type}/{dateDescription}/<path>` | `<worktreePath>/docs/<type>/<dateDescription>/<path>` | After git-worktree sets `worktreePath`, `type`, and `dateDescription` |
| `run://<path>` | Hold in memory (pending write) | Before `worktreePath` exists |
| `run://../<path>` | `<target>/<path>` (project root) | Always |

**Directory structure**:

The worktree directory sits under `targetDir` as a sibling of the project root.
Its name follows the pattern `<projectName>-<branchName>` with slashes replaced
by dashes. Artifacts live in a nested `docs/<type>/<dateDescription>/` subdirectory.

Example for project `Ddo-Code-Flow`, branch `feat/2026-06-24-add-dark-mode`:
```
<targetDir>/
├── Ddo-Code-Flow/                                    ← project root
└── Ddo-Code-Flow-feat-2026-06-24-add-dark-mode/      ← worktreePath
    └── docs/
        └── feat/                                     ← type
            └── 2026-06-24-add-dark-mode/             ← dateDescription
                ├── .state.json
                ├── worktree-info.json
                ├── context-summary.md
                ├── spec.md
                ├── plan.md
                └── ...
```

- `projectName` = basename of project root (e.g. `Ddo-Code-Flow`)
- `type` = branch prefix before the first `/` (e.g. `feat`)
- `dateDescription` = branch name after the first `/` (e.g. `2026-06-24-add-dark-mode`)

**`.state.json` location**: `.state.json` and `worktree-info.json` live at
`<worktreePath>/docs/<type>/<dateDescription>/.state.json`.
The `git-worktree` atom-task sets `worktreePath` in `.state.json` so that
subsequent stages can resolve `run://` paths. To find `.state.json` on resume,
search `<targetDir>/*/docs/*/*/.state.json` (glob across all worktrees, types, and date-descriptions).

**Key mechanism — delayed write**: When `worktreePath` is not yet set in
`.state.json`, any atom-task whose `io.outputs` use `run://` prefixes must
hold its output **in memory** and mark the node with `outputPending: true`
in `.state.json`. Once `git-worktree` creates the worktree directory,
the `docs/<type>/<dateDescription>/` subdirectory, and sets `worktreePath`,
all pending outputs are flushed to `<worktreePath>/docs/<type>/<dateDescription>/`.
This ensures `context-summary.md` and all subsequent artifacts live in the same directory.

**Resume worktree override**: If `.state.json.worktreePath` and `.state.json.type`
are already set (resuming a previous run), record them. All `run://` paths
resolve to the worktree directory, and `run://docs/{type}/{dateDescription}/` paths
resolve to `<worktreePath>/docs/<type>/<dateDescription>/` immediately.
No delayed write is needed.

**Metrics (runStart)**: Once `worktreePath` is set (either from resume or
from git-worktree creating it), invoke the Metrics Runtime Plugin when
`config.base.metrics.enabled == true`:
```
node scripts/metrics/plugin.js runStart --run-dir <worktreePath>/docs/<type> --config config.json --skill-root .
```
If `.state.json.metrics.snapshotBefore` already exists (resume), the plugin
skips re-capture. On failure, record `metrics.status: failed` and **continue**
the workflow (`failurePolicy` defaults to `warn`).

---

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
        - Resolve every `io.inputs[*].ref` and `io.outputs[*].ref` using the
          path resolution table above.
        - Resolve effective options: merge `atomTaskOverrides[name]` (all keys
          except `enabled`) over `prompt.options[*].default` values. The merged
          object is available as `options.<key>` inside the instruction.
        - Execute the node's `prompt.instruction` with the resolved inputs
          and effective options, honoring `prompt.guardrails`.
        - Write outputs to disk (or hold in memory if `worktreePath` is not
          yet set — see delayed write mechanism above).
        - Update `.state.json.stages[stageDef.stage]` and (if applicable)
          a per-node entry.
     b. After the layer finishes, collect all nodes in the layer whose
        `parallelApprove == true`. If the set is non-empty, present **one
        merged confirmation request** to the user, listing every output
        produced by these nodes. Wait for the user's reply.
        - On approve (user explicitly says 同意/approve/确认 or equivalent
          clear affirmative): mark each node's confirmation as `approved`.
        - On reject with feedback (including when user selects an option from
          multiple choices — this is feedback, NOT implicit approval): re-run
          only the rejected nodes with the feedback appended to their
          `prompt.instruction`. The node's output file (e.g., spec.md) MUST
          be updated to reflect the user's feedback before re-presenting for
          confirmation. Repeat until approved.
        - IMPORTANT: When the user selects from options presented in the
          output document, treat it as "reject with feedback" — update the
          document first, then ask for explicit approval again. Never treat
          a selection as implicit approval to proceed.

3. **Stage-level confirmation gate**:
   - If `stageDef.stage` is in `config.base.confirmationGates` AND no
     parallel-approve gate already covered the stage's terminal outputs,
     present a single confirmation request for the stage's terminal outputs.
   - Handle approve / reject identically to step 2.b.

4. **Persist state**:
   - At every transition (node start, node end, layer end, stage end), update
     `.state.json` and write it to disk before continuing.
   - For the initial write (before `worktreePath` exists), write `.state.json`
     to a temporary location in memory. Once `worktreePath` and `type` are set,
     flush it to `<worktreePath>/docs/<type>/.state.json`.

### Step 4 — Stage-level failure recovery

Some atom-tasks define recovery logic in their `prompt.instruction` (e.g.,
verification may specify "jump back to coding if failed"). When executing an
atom-task, follow the recovery instructions defined in that atom-task's
`prompt.instruction`. The runtime does NOT hardcode recovery targets — they
are fully defined in the atom-task JSON.

### Step 5 — Finalize

After all stages in `config.pipeline` have completed (i.e., the last stage's
status is `done` in `.state.json`):
1. Invoke the **Metrics Runtime Plugin (runFinish)** when
   `config.base.metrics.enabled == true`:
   - Command:
     `node scripts/metrics/plugin.js runFinish --run-dir <worktreePath>/docs/<type> --config config.json --skill-root .`
   - Writes `metrics.snapshotAfter`, computes `metrics.runTotal` (delta from
     snapshots), and optionally `<worktreePath>/docs/<type>/metrics-report.md`
     when `metrics.report.enabled == true`.
   - Metrics failure does **not** revert workflow success; run stays COMPLETED.
2. Tell the user the run is complete and point them to
   `<worktreePath>/docs/{type}/{dateDescription}/execution-report.md`
   (and `<worktreePath>/metrics-report.md` when generated).

## Metrics Runtime Plugin (observability)

Metrics is **not** an atom-task and **not** part of the DAG. It is a runtime
plugin invoked at run start and run finish only. See `docs/metrics.md` and
`scripts/metrics/` for provider setup.

- Do **not** add metrics-reporting / usage-report atom-tasks or pipeline stages.
- Do **not** implement per-atom-task token attribution in this version.
- Agent must **not** invent `metrics.runTotal` values; only the plugin writes them.

## Outputs to maintain

- `<worktreePath>/docs/<type>/.state.json` — pipeline state machine. Updated at
  every transition. The `worktreePath` field is set by the `git-worktree` atom-task
  and points to the absolute path of the worktree directory. The `type` field
  records the branch prefix (feat/fix/...).
- `<worktreePath>/docs/<type>/worktree-info.json` — branch metadata written by
  the `git-worktree` atom-task.
- All other outputs are defined in each atom-task's `io.outputs[*].ref`.
  The runtime resolves `run://docs/{type}/{dateDescription}/` paths to
  `<worktreePath>/docs/<type>/<dateDescription>/` and writes outputs accordingly.
  `{type}` and `{dateDescription}` are resolved from `.state.json`
  (set by the `git-worktree` atom-task from the branch name).
  Before `worktreePath` is set, outputs are held in memory (delayed write).
- `<worktreePath>/metrics-report.md` — optional; produced by the Metrics
  Runtime Plugin when `config.base.metrics.report.enabled == true`.

## Failure modes (recap)

| Trigger | Recovery |
|---|---|
| User rejects a confirmation gate | Re-run the relevant atom-task(s) with feedback appended to `prompt.instruction`. Record the rejection in `.state.json.history`. |
| Atom-task defines recovery logic | Follow the recovery instructions in that atom-task's `prompt.instruction`. See Step 4. |
| Session interrupted mid-run | On next start, Step 2 reads `.state.json` and resumes from `currentStage`. Append a `resumed` entry to `.state.json.history`. |
| Run directory name collides | Append `-2`, `-3`, ... to the suffix until unique. Record the final name in `.state.json.runId`. |
| Schema or DAG validation fails | Abort with a clear error message; do not produce any artifacts. |
| Atom-task with `rejectAction: "abort"` fails | Abort the pipeline. Report the error to the user. The `rejectAction` is read from the atom-task JSON, not hardcoded. |

## What this skill does NOT do

- It does NOT embed business logic. All "what to do" lives in atom-task JSON
  files under `atom-tasks/<name>/`.
- It does NOT modify any atom-task JSON file. Enable/disable toggles go to
  `config.json`'s `atomTaskOverrides`.
- It does NOT depend on any runtime besides the agent itself and a POSIX-ish
  shell for `verification` commands.
- It does NOT start a server. The companion UI in `ui/` is a static page
  loaded via `file://` and the File System Access API.
- It does NOT create the run directory. The run directory is created by the
  `git-worktree` atom-task during pipeline execution.
