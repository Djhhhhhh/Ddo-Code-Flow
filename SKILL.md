---
name: ddo-code-flow
description: |
  Customizable AI coding pipeline skill. Drives a multi-stage workflow defined
  in config.json, with user-confirmation gates between key stages. The pipeline
  stages, atom-tasks (defined as .md files with YAML frontmatter), and their
  order are fully configurable — this skill is a generic runtime that executes
  whatever DAG the config defines.
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
- `config.json` — workflow index + global runtime settings (`skillRoot`, **唯一事实来源**).
- `config.schema.json` — JSON Schema for validation (`skillRoot`). Also defines `$defs/workflowDefinition` for workflow JSON files.
- `workflows/*.json` — workflow definitions (pipeline, confirmationGates, atomTaskOverrides per mode).
- `atom-tasks/<name>/<name>.md` — atom-task definitions (YAML frontmatter + markdown body, `skillRoot`). **渐进式读取：只在进入该 node 时才加载。**

Runtime path vocabulary is fixed:

- `skillRoot`: directory containing this `SKILL.md`, `config.json`, workflows, and atom tasks; read-only during a run.
- `projectRoot`: target Git repository present when the skill is invoked.
- `targetDir`: parent container in which sibling worktrees are created; never a code-editing working directory.
- `worktreePath`: isolated Git worktree for this run and the only directory where source edits and project commands are allowed.
- `artifactDir`: `<worktreePath>/docs/<type>/<dateDescription>`.

## Execution (read top-to-bottom each session)

This skill is an **instruction-driven runtime**. You (the agent) are the
executor. Do not implement business logic in this file; only follow the
mechanical loop below.

### Step 1 — Load and validate

1. Read `config.json` and `config.schema.json` from `skillRoot`; record the current target Git repository as `projectRoot`.
2. Validate `config.json` against the schema. Reject and abort on failure.
3. **Auto-migration (v2 → v3)**: If `config.json` has a top-level `pipeline` field and no `workflows` field, perform automatic migration:
   a. Create `workflows/` directory if it doesn't exist.
   b. Write `workflows/standard.json` with the current `pipeline`, `base.confirmationGates`, and `atomTaskOverrides`.
   c. Rewrite `config.json` to v3 index structure (see plan.md §4.1 for schema).
   d. Tell the user the config was auto-migrated from v2 to v3.
4. **Validate workflows**: For each entry in `config.workflows.items`:
   a. Verify the `path` file exists and is valid JSON.
   b. Validate against `$defs/workflowDefinition` in `config.schema.json`.
   c. Run the DAG no-cycle check on every stage's `atomTasks.entry` + `atomTasks.nodes[*].next`. Reject and abort on any cycle.
5. Validate that `config.workflows.default` references an existing `workflows.items[].id`.
6. Validate that all `config.workflows.selection.rules[].workflow` references exist in `workflows.items[]`.

### Step 2 — Resolve target workflow

> **Workflow 选择算法**：解析顺序固定如下，第一条命中即停止。

1. Read the resolved `config.workflows` object.
2. **Explicit parameter**: If the user's skill invocation contains `workflow=<id>`, `mode=<id>`, or `profile=<id>` (one of `config.workflows.selection.argumentNames`), and `allowUserOverride` is true, use that id.
3. **Rule matching**: Otherwise, iterate `config.workflows.selection.rules` in order. For each rule, check if any keyword in `matchAny` appears in the user's requirement text. First match wins.
4. **Fallback**: If no rule matched, use the rule with `fallback: true`.
5. **Default**: If still unresolved, use `config.workflows.default`.
6. Load the workflow JSON from `config.workflows.items[].path` for the resolved id. This is the **active workflow**.
7. **Resume override**: If `.state.json` already exists and contains a `workflowId` field, use that workflow instead (resuming a previous run should not switch workflows).
8. Record `workflowId` in `.state.json`.

### Step 3 — Resolve target directory and initialize state

> **Design decision**: Step 2 does NOT create a run directory. The run directory
> (i.e., the worktree directory) is created by the `git-worktree` atom-task
> during pipeline execution. This ensures all artifacts — including early-stage
> outputs like `context-summary.md` — are written to a single unified directory.

1. Resolve `targetDir` relative to `projectRoot`.
2. Search `targetDir` for an existing `.state.json` (any subdirectory matching
   `*/docs/*/*/.state.json`). A candidate is resumable only when its
   `currentStage != "done"`, its recorded `projectRoot` equals this run's
   `projectRoot`, its `worktreePath` exists, and the state file is inside the
   recorded `artifactDir`. If multiple candidates remain, stop and require an
   explicit run/state selection; never resume an arbitrary match. If exactly
   one candidate remains, read it and resume from `currentStage`.
   Append a `resumed` entry to `.state.json.history`. If `pendingOutputs`
   exists and `worktreePath` is set, flush all pending outputs to disk
   (write each entry to its resolved path under `worktreePath`) and remove
   the `pendingOutputs` field from `.state.json`.
3. If no resumable run is found, initialize `.state.json` **in memory only**
   (do NOT write to disk yet — there is no directory to write to):
   ```json
   {
     "runId": null,
     "createdAt": "<ISO 8601>",
     "projectRoot": "<absolute target Git repository>",
     "skillRoot": "<absolute skill directory>",
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
| `skill://<path>` | `<skillRoot>/<path>` (read-only) | Always |
| `run://<path>` | `<worktreePath>/<path>` | After git-worktree sets `worktreePath` |
| `run://docs/{type}/{dateDescription}/<path>` | `<worktreePath>/docs/<type>/<dateDescription>/<path>` | After git-worktree sets `worktreePath`, `type`, and `dateDescription` |
| `run://<path>` | Hold in memory (pending write) | Before `worktreePath` exists |
| `run://../<path>` | `<projectRoot>/<path>` | Always |

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
persist its output to `.state.json.pendingOutputs[outputRef]` (base64-encoded
text content) and mark the node with `outputPending: true` in `.state.json`.
This ensures outputs survive session interruptions. Once `git-worktree` creates
the worktree directory, the `docs/<type>/<dateDescription>/` subdirectory, and
sets `worktreePath`, all pending outputs are flushed from `pendingOutputs` to
`<worktreePath>/docs/<type>/<dateDescription>/`, and the `pendingOutputs` field
is removed from `.state.json`.
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
node <skillRoot>/scripts/metrics/plugin.js runStart --run-dir <artifactDir> --config <skillRoot>/config.json --skill-root <skillRoot>
```
If `.state.json.metrics.snapshotBefore` already exists (resume), the plugin
skips re-capture. On failure, record `metrics.status: failed` and **continue**
the workflow (`failurePolicy` defaults to `warn`).

---

For each `stageDef` in the **active workflow's `pipeline`**, in order, skipping stages whose
`.state.json.stages[stageDef.stage].status == "done"`:

> **渐进式加载**: Only load `atom-tasks/<name>/<name>.md` when entering that node.
> Only read `outputSchemaRef` when that atom-task declares one.
> Only resolve `io.inputs` when entering that node. Do NOT preload all atom-tasks at startup.

> **Override 合并优先级**: workflow 级 `atomTaskOverrides` > config 全局 `atomTaskOverrides` > atom-task 自身默认值。

1. **Resolve effective DAG**:
   - If `stageDef.stage == "done"` and its entry is empty, treat it as a
     terminal sentinel: run the Step 5 terminal invariants and set its status
     to `done` only if they pass. Do not mark the terminal sentinel `skipped`.
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
        - Load `atom-tasks/<name>/<name>.md`. Parse the YAML frontmatter
          (between the `---` delimiters) to extract metadata: `name`, `version`,
          `stage`, `enabled`, `io`, `options`, `confirmation`, `concurrency`,
          `timeoutSec`, `outputSchemaRef`. The markdown body contains:
          `## 指令` (instruction) and `## 约束` (guardrails).
        - Resolve every `io.inputs[*].ref` and `io.outputs[*].ref` using the
          path resolution table above.
        - Resolve effective options: merge `atomTaskOverrides[name]` (all keys
          except `enabled`) over `options[*].default` values. The merged
          object is available as `options.<key>` inside the instruction.
        - Execute the node's instruction (from `## 指令` section) with the
          resolved inputs and effective options, honoring constraints
          (from `## 约束` section).
        - If `outputSchemaRef` is present, read the referenced
          `.output.schema.json` and use its `sections` definition and `example`
          to structure the output file format.
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
          the instruction (from `## 指令` section). The node's output file (e.g., spec.md) MUST
          be updated to reflect the user's feedback before re-presenting for
          confirmation. Repeat until approved.
        - IMPORTANT: When the user selects from options presented in the
          output document, treat it as "reject with feedback" — update the
          document first, then ask for explicit approval again. Never treat
          a selection as implicit approval to proceed.

3. **Stage-level confirmation gate**:
   - If `stageDef.stage` is in the **active workflow's `confirmationGates`** AND no
     parallel-approve gate already covered the stage's terminal outputs,
     present a single confirmation request for the stage's terminal outputs.
   - Handle approve / reject identically to step 2.b.

4. **Persist state**:
   - At every transition (node start, node end, layer end, stage end), update
     `.state.json` and write it to disk before continuing.
   - For the initial write (before `worktreePath` exists), write `.state.json`
     to a temporary location in memory. Once `worktreePath` and `type` are set,
     flush it to `<artifactDir>/.state.json`.

### Step 4 — Stage-level failure recovery

Some atom-tasks define recovery logic in their instruction (from `## 指令`
section in the .md file, e.g., verification may specify "jump back to coding
if failed"). When executing an atom-task, follow the recovery instructions
defined in that atom-task's instruction. The runtime does NOT hardcode
recovery targets — they are fully defined in the atom-task .md file.

### Step 5 — Finalize

Before marking the terminal sentinel `done`, enforce all of these invariants:

- Every enabled non-terminal stage is `done` or legitimately `skipped`.
- Every required confirmation gate is explicitly approved.
- No task is `running`, `failed`, or pending rework.
- Verification, when enabled, ends with `ALL PASSED`; there are no failed or
  unanswered `human:` checks.
- No pending outputs or unresolved confirmations remain.

If any invariant fails, keep `currentStage` at the blocking stage, persist a
`waiting-confirmation`, `waiting-human`, or `failed` status as appropriate, and
stop. Never report the run as complete.

After the terminal sentinel status is `done` in `.state.json`:
1. Invoke the **Metrics Runtime Plugin (runFinish)** when
   `config.base.metrics.enabled == true`:
   - Command:
     `node <skillRoot>/scripts/metrics/plugin.js runFinish --run-dir <artifactDir> --config <skillRoot>/config.json --skill-root <skillRoot>`
   - Writes `metrics.snapshotAfter`, computes `metrics.runTotal` (delta from
     snapshots), and optionally `<artifactDir>/metrics-report.md`
     when `metrics.report.enabled == true`.
   - Metrics failure does **not** revert workflow success; run stays COMPLETED.
2. Tell the user the run is complete and point them to
   `<worktreePath>/docs/{type}/{dateDescription}/execution-report.md`
   (and `<artifactDir>/metrics-report.md` when generated).

## Metrics Runtime Plugin (observability)

Metrics is **not** an atom-task and **not** part of the DAG. It is a runtime
plugin invoked at run start and run finish only. See `docs/metrics.md` and
`scripts/metrics/` for provider setup.

- Do **not** add metrics-reporting / usage-report atom-tasks or pipeline stages.
- Do **not** implement per-atom-task token attribution in this version.
- Agent must **not** invent `metrics.runTotal` values; only the plugin writes them.

## Outputs to maintain

- `<artifactDir>/.state.json` — pipeline state machine. Updated at
  every transition. The `worktreePath` field is set by the `git-worktree` atom-task
  and points to the absolute path of the worktree directory. The `type` field
  records the branch prefix (feat/fix/...).
- `<artifactDir>/worktree-info.json` — branch metadata written by
  the `git-worktree` atom-task.
- All other outputs are defined in each atom-task's `io.outputs[*].ref`.
  The runtime resolves `run://docs/{type}/{dateDescription}/` paths to
  `<worktreePath>/docs/<type>/<dateDescription>/` and writes outputs accordingly.
  `{type}` and `{dateDescription}` are resolved from `.state.json`
  (set by the `git-worktree` atom-task from the branch name).
  Before `worktreePath` is set, outputs are held in memory (delayed write).
- `<artifactDir>/metrics-report.md` — optional; produced by the Metrics
  Runtime Plugin when `config.base.metrics.report.enabled == true`.

## Failure modes (recap)

| Trigger | Recovery |
|---|---|
| User rejects a confirmation gate | Re-run the relevant atom-task(s) with feedback appended to the instruction. Record the rejection in `.state.json.history`. |
| Atom-task defines recovery logic | Follow the recovery instructions in that atom-task's instruction (`## 指令` section). See Step 4. |
| Session interrupted mid-run | On next start, Step 2 reads `.state.json` and resumes from `currentStage`. Append a `resumed` entry to `.state.json.history`. |
| Run directory name collides | Append `-2`, `-3`, ... to the suffix until unique. Record the final name in `.state.json.runId`. |
| Schema or DAG validation fails | Abort with a clear error message; do not produce any artifacts. |
| Atom-task with `rejectAction: "abort"` fails | Abort the pipeline. Report the error to the user. The `rejectAction` is read from the atom-task .md frontmatter, not hardcoded. |

## What this skill does NOT do

- It does NOT embed business logic. All "what to do" lives in atom-task .md
  files under `atom-tasks/<name>/` (YAML frontmatter + markdown body).
- It does NOT modify any atom-task .md file. Enable/disable toggles go to
  `config.json`'s `atomTaskOverrides`.
- It does NOT depend on any runtime besides the agent itself and a POSIX-ish
  shell for `verification` commands.
- It does NOT start a server. The companion UI in `ui/` is a static page
  loaded via `file://` and the File System Access API.
- It does NOT create the run directory. The run directory is created by the
  `git-worktree` atom-task during pipeline execution.
