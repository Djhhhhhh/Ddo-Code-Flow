# ddo-code-flow

**ddo-code-flow** is a configurable AI coding pipeline skill. v4 makes the
layers deliberately separate:

- atom-tasks declare only artifact roles they consume and produce.
- workflows are the only integration layer and own stage order, DAG edges,
  `taskRef`, options, and confirmation gates.
- config is composed in memory from read-only skill defaults, project config,
  and run arguments.
- the runtime owns state, artifact role injection, worktree creation, recovery,
  and metrics hooks.

![Studio screenshot](assets/image.png)

## What Changed In v4

- `config.json` was renamed to `config.default.json`; it is a read-only skill
  default edited only at design time.
- Each project owns a single `.ddo/config.json`; first run creates `.ddo/` and
  `.ddo/runs/` when missing.
- Worktrees are created under `worktreeDir`; empty `worktreeDir` means the
  project parent directory, so the default worktree is a sibling of the project.
- Run artifacts live under `.ddo/runs/<type>/<dateDescription>/` inside the
  worktree and are merged back to the project with the branch.
- atom-task frontmatter uses `produces` and `consumes`; concrete paths are
  resolved by the runtime through `atom-tasks/artifacts.json`.
- The skill never writes `.gitignore` or git exclude. `.ddo/` visibility is the
  user's responsibility.

## Layout

```text
SKILL.md                                  # v4 instruction-driven runtime
config.default.json                       # read-only global defaults
config.schema.json                        # default, workflow, project config schemas
state.schema.json                         # run state schema and field ownership
show_case.md                              # current v4 end-to-end run example
workflows/*.json                          # pipeline definitions
atom-tasks/artifacts.json                 # artifact role catalog
atom-tasks/<name>/<name>.md               # atom-task v4 frontmatter + instruction
atom-tasks/<name>/*.output.schema.json    # document output contracts
scripts/metrics/                          # optional run-level metrics plugin
ui/index.html + ui/studio.js              # design-time static Studio
.claude/rules/                            # repository coding rules
```

## Run Model

Default run structure:

```text
<project-parent>/
├── <projectName>/                         # projectRoot
│   └── .ddo/
│       ├── config.json                    # project-owned config
│       └── runs/                          # merged run artifacts only
│           └── feat/YYYY-MM-DD-slug/
│               ├── worktree-info.json
│               ├── context-summary.md
│               ├── requirement.md
│               ├── spec.md
│               ├── plan.md
│               ├── test-plan.md
│               ├── tasks/task-group.json
│               ├── tasks/task-01.md
│               ├── verification.log
│               ├── execution-report.md
│               └── reflection-report.md
└── <projectName>-feat-YYYY-MM-DD-slug/    # worktreePath
    ├── source files
    └── .ddo/runs/feat/YYYY-MM-DD-slug/
        ├── .state.json
        ├── worktree-info.json
        ├── context-summary.md
        ├── requirement.md
        ├── spec.md
        ├── plan.md
        ├── test-plan.md
        ├── tasks/task-group.json
        ├── tasks/task-01.md
        ├── verification.log
        ├── execution-report.md
        └── reflection-report.md
```

Set `.ddo/config.json` to change where worktrees are created:

```json
{
  "$schema": "../config.schema.json#/$defs/projectConfig",
  "worktreeDir": "",
  "defaultRunType": "feat",
  "contextPaths": [],
  "atomTaskOverrides": {}
}
```

`show_case.md` is the canonical end-to-end v4 example for this layout. The
feature-delivery copy under
`docs/feat/2026-08-05-project-consistency-audit/show-case.md` is kept identical
by contract tests.

## State And Artifacts

Runtime artifact flow is role-based:

- atom-tasks declare `produces` and `consumes` roles.
- `atom-tasks/artifacts.json` maps each role to the file or directory written
  under `.ddo/runs/<type>/<dateDescription>/`.
- `.state.json.artifacts` is the blackboard that records concrete role paths
  such as `run://.ddo/runs/feat/YYYY-MM-DD-slug/spec.md`.
- downstream tasks receive paths through `{{inputs.<role>}}`; they should not
  guess upstream filenames.

Runtime state is owned separately:

- `state.schema.json` defines every `.state.json` top-level field.
- each state field has exactly one `x-ddo-writer`.
- `runId` starts as `null` and is set by `git-worktree` to
  `<projectName>-<branchName-with-slashes-replaced>`.
- `createdAt`, `workflowId`, `args`, `currentStage`, `stages`, `artifacts`,
  `pendingOutputs`, and `history` are runtime-owned.
- `issueContext`, `gatePending`, and `prInfo` are the only task-owned top-level
  state fields, written by `issue-fetch`, `remote-gate`, and `create-pr`
  respectively.

## Invocation Arguments

- `--model <workflow-id>`: explicitly selects a workflow.
- `--feature`: marks the run as `feat`.
- `--bugfix`: marks the run as `fix`.

`--model` is the only workflow-selection argument. `--feature` and `--bugfix`
do not participate in workflow selection; they only choose the run type and thus
the branch prefix and `.ddo/runs/<type>/...` artifact directory. If `--model` is
not an exact workflow id, workflow selection falls back to selection rules and
then the default workflow. If neither run type flag is present, run type is
inferred from text or `defaultRunType`.

## Workflows

Current workflows:

- `standard`: full requirement/spec/plan/test-plan/tasking/coding/verification/reporting/reflection flow.
- `lightweight`: skips test-plan and tasking for small changes and docs.
- `guarded`: enables review for sensitive changes.
- `issue-driven`: fetches an issue, uses remote gates, then prepares delivery and PR metadata.

## Atom-Task Contract

Example:

```yaml
---
name: spec
version: "4.0.0"
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
consumes:
  - role: requirement
    required: true
  - role: context-summary
    required: false
produces:
  - role: spec
    kind: markdown
    primary: true
outputSchemaRef: "skill://atom-tasks/spec/spec.output.schema.json"
---
```

Rules:

- no `stage` field in atom-task frontmatter
- no concrete `run://...` paths in atom-task frontmatter or task instructions
- no upstream atom-task names in atom-task instructions
- confirmation gates live in workflow JSON only
- new `.state.json` top-level fields must be declared in `state.schema.json`
  before any task reads or writes them

## Metrics

Metrics is optional, run-level only, and is not an atom-task. See
[docs/metrics.md](docs/metrics.md).

## Studio

Open `ui/index.html` in a Chromium-based browser and select the skill folder.
Studio is design-time only: it edits `config.default.json` and workflow JSON.
It does not edit project `.ddo/config.json` and does not implement full v4 role
visualization yet.

## Versioning

- `SKILL.md` metadata version is the main runtime contract version.
- `config.default.json` version is the default config contract version.
- workflow `version` tracks workflow definition revisions.
- atom-task `version` tracks each task's frontmatter/instruction contract.

## Contributing

- Change schemas, default config, task definitions, tests, and docs together.
- Add new artifact roles to `atom-tasks/artifacts.json` before using them.
- Add or change `.state.json` top-level fields in `state.schema.json` before
  any atom-task reads or writes them.
- Keep runtime mechanisms in `SKILL.md`, not in atom-task instructions.
- Keep `.ddo/` git visibility under user control; never write `.gitignore` or
  git exclude from the skill.

## License

[MIT License](LICENSE)
