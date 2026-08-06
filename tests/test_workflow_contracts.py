from __future__ import annotations

import copy
import json
import re
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
ATOM_NAMES = {
    "coding",
    "context",
    "create-pr",
    "delivery-doc",
    "git-worktree",
    "issue-fetch",
    "plan",
    "reflection",
    "remote-gate",
    "reporting",
    "requirement",
    "review",
    "spec",
    "tasking",
    "test-plan",
    "verification",
}
ALLOWED_STATE_FALLBACK_ROLES = {"stage-artifact"}
STATE_FIELD_RE = re.compile(r"\.state\.json\.([A-Za-z][A-Za-z0-9_]*)")
ALLOWED_OPTIONAL_MISSING = {
    ("guarded", "requirement", "issue-context"),
    ("guarded", "coding", "verification-log"),
    ("issue-driven", "coding", "verification-log"),
    ("lightweight", "requirement", "issue-context"),
    ("lightweight", "coding", "task-group"),
    ("lightweight", "coding", "tasks-dir"),
    ("lightweight", "coding", "test-plan"),
    ("lightweight", "coding", "verification-log"),
    ("lightweight", "verification", "test-plan"),
    ("lightweight", "reporting", "test-plan"),
    ("standard", "requirement", "issue-context"),
    ("standard", "coding", "verification-log"),
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_frontmatter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not match:
        raise AssertionError(f"missing YAML frontmatter: {path}")
    return yaml.safe_load(match.group(1))


def atom_tasks() -> dict[str, dict]:
    result = {}
    for path in sorted((ROOT / "atom-tasks").glob("*/*.md")):
        if path.name == "check-list.md":
            continue
        frontmatter = load_frontmatter(path)
        result[frontmatter["name"]] = frontmatter
    return result


def workflows() -> list[tuple[Path, dict]]:
    return [
        (path, load_json(path))
        for path in sorted((ROOT / "workflows").glob("*.json"))
    ]


def role_catalog() -> dict:
    return load_json(ROOT / "atom-tasks/artifacts.json")["roles"]


def state_schema() -> dict:
    return load_json(ROOT / "state.schema.json")


def schema_def(root_schema: dict, name: str) -> dict:
    return {
        "$schema": root_schema["$schema"],
        "$defs": root_schema["$defs"],
        **root_schema["$defs"][name],
    }


def task_for_node(tasks: dict[str, dict], node_name: str, node_def: dict) -> dict:
    task_name = node_def.get("taskRef", node_name)
    try:
        return tasks[task_name]
    except KeyError as exc:
        raise AssertionError(f"workflow references missing atom-task: {task_name}") from exc


def topo_layers(stage: dict) -> list[list[str]]:
    nodes = stage["atomTasks"]["nodes"]
    names = set(nodes)
    indegree = {name: 0 for name in names}
    for name, node in nodes.items():
        for nxt in node.get("next", []):
            if nxt in names:
                indegree[nxt] += 1

    queue = [name for name, degree in indegree.items() if degree == 0]
    seen: list[str] = []
    layers: list[list[str]] = []
    while queue:
        layer = sorted(queue)
        layers.append(layer)
        queue = []
        for name in layer:
            seen.append(name)
            for nxt in nodes[name].get("next", []):
                if nxt not in names:
                    continue
                indegree[nxt] -= 1
                if indegree[nxt] == 0:
                    queue.append(nxt)

    assert len(seen) == len(names), f"{stage['stage']}: cycle detected"
    return layers


def role_reachability_diagnostics(workflow: dict) -> list[dict]:
    tasks = atom_tasks()
    available: set[str] = set()
    diagnostics: list[dict] = []

    for stage in workflow["pipeline"]:
        if stage["stage"] == "done":
            continue
        stage_primary: str | None = None
        nodes = stage["atomTasks"]["nodes"]
        for layer in topo_layers(stage):
            for node_name in layer:
                task_name = nodes[node_name].get("taskRef", node_name)
                task = task_for_node(tasks, node_name, nodes[node_name])
                for consumed in task.get("consumes", []):
                    role = consumed["role"]
                    missing = False
                    if role == "stage-artifact":
                        missing = stage_primary is None
                    else:
                        missing = role not in available
                    if missing:
                        diagnostics.append(
                            {
                                "workflow": workflow["id"],
                                "stage": stage["stage"],
                                "node": node_name,
                                "task": task_name,
                                "role": role,
                                "required": consumed.get("required", False),
                            }
                        )
                for produced in task.get("produces", []):
                    available.add(produced["role"])
                    if produced.get("primary"):
                        stage_primary = produced["role"]

    return diagnostics


def test_default_config_and_workflows_validate() -> None:
    schema = load_json(ROOT / "config.schema.json")
    Draft202012Validator(schema).validate(load_json(ROOT / "config.default.json"))

    workflow_validator = Draft202012Validator(schema_def(schema, "workflowDefinition"))
    for path, workflow in workflows():
        workflow_validator.validate(workflow), path


def test_project_config_schema_accepts_minimal_project_config() -> None:
    schema = load_json(ROOT / "config.schema.json")
    project_config = {
        "$schema": "../config.schema.json#/$defs/projectConfig",
        "worktreeDir": "",
        "defaultRunType": "feat",
        "contextPaths": [],
        "atomTaskOverrides": {},
    }
    Draft202012Validator(schema_def(schema, "projectConfig")).validate(project_config)


def test_artifact_catalog_validates() -> None:
    validator = Draft202012Validator(
        load_json(ROOT / "atom-tasks/_schema/artifact-catalog.schema.json")
    )
    validator.validate(load_json(ROOT / "atom-tasks/artifacts.json"))


def test_state_schema_validates_runtime_states() -> None:
    schema = state_schema()
    validator = Draft202012Validator(schema)
    initial_state = {
        "runId": None,
        "workflowId": "standard",
        "createdAt": "2026-08-06T12:00:00Z",
        "projectRoot": "E:/code/demo-app",
        "worktreePath": None,
        "skillName": "ddo-code-flow",
        "skillVersion": "4.0.0",
        "skillRoot": "C:/Users/example/.claude/skills/ddo-code-flow",
        "configPath": ".ddo/config.json",
        "workflowPath": "workflows/standard.json",
        "type": "feat",
        "dateDescription": None,
        "artifactDir": None,
        "args": {},
        "currentStage": "context",
        "stages": {},
        "artifacts": {},
        "pendingOutputs": {},
        "history": [
            {
                "event": "created",
                "at": "2026-08-06T12:00:00Z",
                "note": "workflowId=standard",
            }
        ],
    }
    validator.validate(initial_state)

    worktree_state = {
        **initial_state,
        "runId": "demo-app-feat-2026-08-06-example",
        "worktreePath": "E:/code/demo-app-feat-2026-08-06-example",
        "dateDescription": "2026-08-06-example",
        "artifactDir": "E:/code/demo-app-feat-2026-08-06-example/.ddo/runs/feat/2026-08-06-example",
        "stages": {"requirement": {"status": "done"}},
        "artifacts": {
            "worktree-info": {
                "path": "run://.ddo/runs/feat/2026-08-06-example/worktree-info.json",
                "producer": "git-worktree",
                "stage": "requirement",
                "at": "2026-08-06T12:01:00Z",
            }
        },
        "issueContext": {
            "issueNumber": 28,
            "repo": "Djhhhhhh/Ddo-Code-Flow",
        },
    }
    validator.validate(worktree_state)


def test_state_fields_have_single_declared_writers() -> None:
    properties = state_schema()["properties"]
    expected_writers = {
        "runId": "git-worktree",
        "issueContext": "issue-fetch",
        "gatePending": "remote-gate",
        "prInfo": "create-pr",
        "currentStage": "runtime",
    }
    for field, definition in properties.items():
        writer = definition.get("x-ddo-writer")
        assert isinstance(writer, str) and writer, f"{field} needs one writer"
        assert not isinstance(writer, list), f"{field} writer must not be a list"
        assert "x-ddo-readers" in definition, f"{field} needs declared readers"
    for field, writer in expected_writers.items():
        assert properties[field]["x-ddo-writer"] == writer


def test_atom_task_frontmatter_validates_and_is_v4() -> None:
    validator = Draft202012Validator(
        load_json(ROOT / "atom-tasks/_schema/atom-task-md.schema.json")
    )
    tasks = atom_tasks()
    assert set(tasks) == ATOM_NAMES
    for path in sorted((ROOT / "atom-tasks").glob("*/*.md")):
        if path.name == "check-list.md":
            continue
        frontmatter = load_frontmatter(path)
        validator.validate(frontmatter)
        assert "stage" not in frontmatter
        assert "io" not in frontmatter
        assert "required" not in frontmatter["confirmation"]


def test_atom_task_roles_are_declared_in_catalog() -> None:
    roles = role_catalog()
    for task_name, task in atom_tasks().items():
        for item in task.get("produces", []):
            role = item["role"]
            assert role in roles, f"{task_name} produces unknown role {role}"
            assert item["kind"] == roles[role]["kind"]
        for item in task.get("consumes", []):
            role = item["role"]
            assert role in roles, f"{task_name} consumes unknown role {role}"


def test_workflow_nodes_use_pipeline_contract_only() -> None:
    tasks = atom_tasks()
    for path, workflow in workflows():
        for stage in workflow["pipeline"]:
            nodes = stage["atomTasks"]["nodes"]
            for node_name, node_def in nodes.items():
                assert "io" not in node_def, f"{path.name}: node {node_name} has io override"
                task_for_node(tasks, node_name, node_def)


@pytest.mark.parametrize("workflow_path,workflow", workflows())
def test_required_roles_are_reachable(workflow_path: Path, workflow: dict) -> None:
    missing_required = [
        item for item in role_reachability_diagnostics(workflow) if item["required"]
    ]
    assert not missing_required, f"{workflow_path.name}: {missing_required}"


@pytest.mark.parametrize("workflow_path,workflow", workflows())
def test_optional_roles_are_reachable_or_explicitly_allowed(
    workflow_path: Path, workflow: dict
) -> None:
    missing_optional = [
        item for item in role_reachability_diagnostics(workflow) if not item["required"]
    ]
    unexpected = [
        item
        for item in missing_optional
        if (item["workflow"], item["task"], item["role"]) not in ALLOWED_OPTIONAL_MISSING
    ]
    assert not unexpected, f"{workflow_path.name}: {unexpected}"


def test_required_role_reachability_rejects_missing_producer() -> None:
    broken = copy.deepcopy(load_json(ROOT / "workflows/standard.json"))
    broken["id"] = "broken-standard"
    broken["pipeline"][2]["atomTasks"]["entry"] = []
    broken["pipeline"][2]["atomTasks"]["nodes"] = {}
    missing_required = [
        item for item in role_reachability_diagnostics(broken) if item["required"]
    ]
    assert any(item["role"] == "spec" and item["task"] == "plan" for item in missing_required)


def test_decoupling_text_contracts() -> None:
    forbidden_concrete_run_path = re.compile(r"run://(?!$)(?!\s)(?!\{\{)")
    direct_task_read_verbs = r"(?:读取|打开|引用|加载|read|load|open)"
    for path in sorted((ROOT / "atom-tasks").glob("*/*.md")):
        if path.name == "check-list.md":
            continue
        text = path.read_text(encoding="utf-8")
        frontmatter = load_frontmatter(path)
        assert "stage" not in frontmatter
        assert "io" not in frontmatter
        body = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.DOTALL)
        assert not forbidden_concrete_run_path.search(body), path
        for other_task in ATOM_NAMES - {frontmatter["name"]}:
            pattern = re.compile(
                rf"{direct_task_read_verbs}[^。\n]*`?(?:skill://)?"
                rf"atom-tasks/{re.escape(other_task)}/{re.escape(other_task)}\.md`?",
                re.IGNORECASE,
            )
            assert not pattern.search(body), f"{path} points at {other_task}.md"


def test_runtime_docs_are_single_source_for_mechanics() -> None:
    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    assert "Artifact Blackboard" in skill
    assert "config.default.json <- .ddo/config.json <- run arguments" in skill
    assert ".ddo/runs/<type>/<dateDescription>" in skill
    assert "v2/v3 compatibility" in skill
    assert "state.schema.json" in skill

    forbidden_terms = [
        "pendingOutputs",
        "Artifact Blackboard",
        "config.default.json <- .ddo/config.json <- run arguments",
        "v2/v3 compatibility",
        "gatePending",
    ]
    for path in sorted((ROOT / "atom-tasks").glob("*/*.md")):
        if path.name == "check-list.md":
            continue
        body = re.sub(
            r"^---\n.*?\n---\n",
            "",
            path.read_text(encoding="utf-8"),
            flags=re.DOTALL,
        )
        for term in forbidden_terms:
            assert term not in body, f"{path} repeats runtime mechanism {term}"


def test_state_field_references_are_declared() -> None:
    declared = set(state_schema()["properties"])
    checked_paths = [ROOT / "SKILL.md", *sorted((ROOT / "atom-tasks").glob("**/*"))]
    for path in checked_paths:
        if not path.is_file() or path.suffix not in {".md", ".json"}:
            continue
        for field in STATE_FIELD_RE.findall(path.read_text(encoding="utf-8")):
            assert field in declared, f"{path} references undeclared .state.json.{field}"


def test_json_role_output_schemas_do_not_claim_unregistered_markdown() -> None:
    tasks = atom_tasks()
    json_task_schemas = {
        "git-worktree": "worktree-info",
        "tasking": "task-group",
    }
    for task_name, role in json_task_schemas.items():
        task = tasks[task_name]
        produced = next(item for item in task["produces"] if item["role"] == role)
        assert produced["kind"] == "json"
        schema_ref = task["outputSchemaRef"].removeprefix("skill://")
        output_schema = load_json(ROOT / schema_ref)
        assert output_schema["outputFormat"] == "json"
        assert "同时生成" not in output_schema["description"]


def test_root_show_case_is_current_v4_contract() -> None:
    root_show_case = (ROOT / "show_case.md").read_text(encoding="utf-8")
    feature_show_case = (
        ROOT / "docs/feat/2026-08-05-project-consistency-audit/show-case.md"
    ).read_text(encoding="utf-8")
    assert root_show_case == feature_show_case
    assert "state.schema.json" in root_show_case
    assert "atom-tasks/artifacts.json" in root_show_case
    assert "run://docs/{type}/{dateDescription}" not in root_show_case
    assert '"userRequirement"' not in root_show_case
    assert "worktree-info.json / .md" not in root_show_case
    assert "task-group.json / .md" not in root_show_case


def test_readme_describes_current_v4_contract() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    required_terms = [
        "show_case.md",
        "state.schema.json",
        "atom-tasks/artifacts.json",
        ".state.json.artifacts",
        "{{inputs.<role>}}",
        "`runId` starts as `null`",
        "`git-worktree`",
        "docs/feat/2026-08-05-project-consistency-audit/show-case.md",
    ]
    for term in required_terms:
        assert term in readme
    assert "run://docs/{type}/{dateDescription}" not in readme
    assert '"userRequirement"' not in readme
    assert "worktree-info.json / .md" not in readme
    assert "task-group.json / .md" not in readme


def test_ui_uses_default_config_without_legacy_pipeline_injection() -> None:
    studio = (ROOT / "ui/studio.js").read_text(encoding="utf-8")
    assert 'FS.readJSON("config.default.json")' in studio
    assert 'FS.writeJSON("config.default.json", state.config)' in studio
    assert "config.pipeline ||=" not in studio
    assert "base.confirmationGates ||=" not in studio


@pytest.mark.parametrize(
    ("requirement", "expected"),
    [
        ("Update the README documentation", "lightweight"),
        ("这是一个文档小修", "lightweight"),
        ("Prevent prototype pollution in the parser", "guarded"),
        ("Fix an async concurrency race", "guarded"),
        ("Security update with README documentation", "guarded"),
        ("Add a normal multi-file feature", "standard"),
    ],
)
def test_bilingual_workflow_routing(requirement: str, expected: str) -> None:
    config = load_json(ROOT / "config.default.json")
    normalized = requirement.lower()
    selected = None
    fallback = None
    for rule in config["workflows"]["selection"]["rules"]:
        if rule.get("fallback"):
            fallback = rule["workflow"]
            continue
        if any(keyword.lower() in normalized for keyword in rule.get("matchAny", [])):
            selected = rule["workflow"]
            break
    assert (selected or fallback or config["workflows"]["default"]) == expected
