# v4 Responsibility Boundary Rules

## Responsibility Matrix

| Layer | Owns | Must not contain |
|---|---|---|
| atom-task | Business instruction, `produces`, `consumes`, options, reject behavior | `stage`, concrete `run://` artifact paths, upstream atom-task names, global config reads |
| workflow | Stage order, DAG nodes, `taskRef`, node options, confirmation gates | Business instructions, artifact file paths |
| config | Defaults, project overrides, atom-task option overrides | Run state, generated artifacts, per-run effective config files |
| runtime | Config composition, role injection, artifact registration, `state.schema.json`, recovery | Business behavior owned by atom-tasks |

## Hard Rules

- New atom-task frontmatter must validate against `atom-tasks/_schema/atom-task-md.schema.json`.
- New artifact roles must be added to `atom-tasks/artifacts.json` before use.
- New `.state.json` top-level fields must be declared in `state.schema.json`
  with exactly one `x-ddo-writer` before any task reads or writes them.
- Atom-task instructions must consume upstream data through `{{inputs.<role>}}`.
- Confirmation gates belong only in workflow JSON.
- Runtime run artifacts belong under `.ddo/runs/<type>/<dateDescription>/`.
- Worktrees belong under `worktreeDir`; default is the project parent directory.
- The skill must not write to `skillRoot` during a run.
- The skill must not edit `.gitignore` or git exclude.

## Self-Check Before Changes

- Does this change add role reachability tests when it adds a role or workflow edge?
- Does this change update state field ownership tests when it adds state fields?
- Does it keep project config as `.ddo/config.json` and avoid materialized effective config copies?
- Does it keep `config.default.json`, workflow JSON, schemas, README, and tests in sync?
- Does it avoid reintroducing legacy `run://docs/{type}/{dateDescription}` paths?
