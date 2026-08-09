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

## Execution

### Step 1 - Load Defaults And Project Config

1. Read `config.default.json`, `config.schema.json`, `state.schema.json`,
   `atom-tasks/artifacts.json`, and the workflow index from `skillRoot`.
2. Validate defaults and artifact catalog.
3. Ensure `<projectRoot>/.ddo/` exists. If missing, create:
   - `.ddo/config.json` with a minimal project config object.
   - `.ddo/runs/`.
   Do not modify `.gitignore`, git exclude, or any other git visibility setting.
4. Validate `.ddo/config.json` against `$defs.projectConfig` when it exists.
5. Compose effective config in memory only:
   `config.default.json <- .ddo/config.json <- run arguments`.
   Objects merge recursively, arrays replace as a whole, scalars replace.
   Never write an effective config file to disk.

### Step 2 - Resolve Workflow And Run Type

1. Parse arguments. `--model <id>` is an explicit workflow selector.
2. If `--model` matches `workflows.items[].id`, use that workflow.
3. Otherwise match workflow selection rules against the `--model` value when
   present, then against the user requirement text, then fallback/default.
4. Resolve run type:
   - `--feature` -> `feat`
   - `--bugfix` -> `fix`
   - otherwise infer from text or use `base.defaultRunType`
5. Load the selected workflow JSON and validate it against
   `$defs.workflowDefinition`.
6. For each stage DAG, validate references and cycles. `taskRef` means the DAG
   node name is an instance name while the atom-task definition comes from
   `taskRef`.
7. Display the pipeline execution summary before proceeding:
   ```
   ▸ Workflow: <name> — <description>
   ▸ Run type: <feat|fix>
   ▸ Issue: #<N>          (only when issue-driven)
   ▸ Stages: <stage1> → <stage2> → ... → done
   ```
   When `--atom` is set, display single-task mode instead:
   ```
   ▸ Mode: 单任务执行 (<task-name>)
   ▸ 输入: <resolved consumed roles>
   ```

### Step 2.5 - Single Atom-Task Execution (--atom)

When `--atom <task-name>` is present:

1. Skip Steps 3–7 entirely.
2. Load `atom-tasks/<task-name>/<task-name>.md` and validate its frontmatter.
3. Resolve its `consumes` roles from `.state.json.artifacts`. For each required
   role that is missing, abort with an error listing the missing role.
4. Execute the atom-task instruction as a standalone task, honoring all its
   constraints.
5. Write produced artifacts under `artifactDir` (or `pendingOutputs` if
   `artifactDir` is not yet available).
6. Register produced roles in `.state.json.artifacts` and append history events.
7. Display completion summary and exit.

### Step 3 - Validate Role Reachability

Before execution, perform a workflow role check:

1. Maintain a set of produced roles while traversing the workflow in stage order
   and node topological order.
2. For each enabled node, load only its frontmatter. Every produced and consumed
   role must exist in `artifacts.json`.
3. Every required consumed role must already be available, except:
   - `stage-artifact`, which is resolved at runtime inside the current stage.
   - roles whose task instruction explicitly reads state fallback fields such as
     `.state.json.issueContext`.
4. Reject the workflow on missing required roles or duplicate same-run producers
   that would make a role ambiguous.

### Step 4 - Initialize Or Resume State

Find resumable state under effective `worktreeDir` and `projectRoot` by scanning
`*/.ddo/runs/*/*/.state.json`. A candidate is resumable only when:

- `currentStage != "done"`.
- recorded `projectRoot` equals this run's `projectRoot`.
- recorded `worktreePath` exists.
- the state file is inside recorded `artifactDir`.

If exactly one candidate exists, resume it. If multiple candidates exist, stop
and ask for explicit selection. On resume:

- Prefer resolving the skill by `skillName`; use stored `skillRoot` only as a
  hint. Version mismatch is a warning, not an automatic failure.
- Load relative `configPath` and `workflowPath`.
- Append `resumed` to history.

For a new run, initialize state in memory until `git-worktree` creates
`worktreePath` and `artifactDir`:

```json
{
  "runId": null,
  "workflowId": "<workflow id>",
  "createdAt": "<ISO 8601>",
  "projectRoot": "<absolute project root>",
  "worktreePath": null,
  "skillName": "ddo-code-flow",
  "skillVersion": "4.0.0",
  "skillRoot": "<hint only>",
  "configPath": ".ddo/config.json",
  "workflowPath": "workflows/<id>.json",
  "type": "<feat|fix>",
  "dateDescription": null,
  "artifactDir": null,
  "args": {},
  "currentStage": "context",
  "stages": {},
  "artifacts": {},
  "pendingOutputs": {},
  "history": [
    { "event": "created", "at": "<ISO 8601>", "note": "workflowId=<workflow id>" }
  ]
}
```

Validate every persisted state object against `state.schema.json`. The schema is
also the ownership contract for non-artifact state fields: each top-level field
has exactly one `x-ddo-writer`. Atom-tasks may read declared fallback fields such
as `.state.json.issueContext`, but they must not invent new top-level state
fields. Notable writers:

| Field | Writer | Notes |
|---|---|---|
| `runId` | `git-worktree` | Set to `<projectName>-<branchName-with-slashes-replaced>` when the branch is known. |
| `createdAt`, `workflowId`, `args`, `currentStage`, `stages`, `artifacts`, `pendingOutputs`, `history` | `runtime` | Runtime state machine fields. |
| `issueContext` | `issue-fetch` | Issue metadata for issue-driven runs. |
| `gatePending` | `remote-gate` | Remote gate reentry state. |
| `prInfo` | `create-pr` | Pull request metadata after PR creation. |

### Step 5 - Execute Nodes

For each workflow stage, skipping stages already marked done:

1. Prune disabled nodes using override priority:
   workflow `atomTaskOverrides` > project/global `atomTaskOverrides` >
   atom-task default `enabled`.
2. Topologically batch nodes with Kahn's algorithm.
3. For each node:
   - Load `atom-tasks/<effectiveName>/<effectiveName>.md`, where
     `effectiveName = taskRef || nodeName`.
   - Merge options:
     workflow override for node name > config override for node name >
     node `options` > atom-task defaults.
   - Resolve consumes into `{{inputs.<role>}}` bindings from `.state.json.artifacts`.
   - Execute the atom-task instruction and honor its constraints.
   - If `outputSchemaRef` exists, read it and use its sections/rules/example.
   - Write produced artifacts under `artifactDir` according to `artifacts.json`.
     If `worktreePath` is not yet available, hold text outputs in
     `pendingOutputs` and flush them after `git-worktree` sets `artifactDir`.
   - Register produced roles in `.state.json.artifacts`.
   - Append `node-start` and `node-done` or `node-failed` history events.
4. Validate `.state.json` against `state.schema.json` and persist it at every
   transition once `artifactDir` exists.

### Step 6 - Confirmation Gates

Confirmation gates live only in workflow JSON. A stage listed in
`confirmationGates` asks the user for approval after its terminal outputs unless
that stage contains a `remote-gate` node. Remote-gate stages use GitHub labels
and must not also trigger a local confirmation prompt.

On rejection, archive the previous artifact version to `_del`, append
`gate-rejected` with feedback, rerun the affected node or rollback target, and
request approval again.

### Step 7 - Recovery And Finalization

Follow recovery instructions in the current atom-task. The runtime does not
hardcode business recovery targets.

Before marking `done`, enforce:

- Every enabled non-terminal stage is done or legitimately skipped.
- Every required confirmation gate is approved.
- No node is running, failed, or pending rework.
- Verification, when enabled, ends with `ALL PASSED` and has no unanswered
  `human:` checks.
- No pending outputs, unresolved role bindings, or unresolved confirmations remain.

After `done`, run metrics finish when enabled and report:

- execution report path
- optional metrics report path
- worktree path

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
