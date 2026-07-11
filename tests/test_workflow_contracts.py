from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_PREFIX = "run://docs/{type}/{dateDescription}/"
IMPLICIT_RUNTIME_OUTPUTS = {f"{ARTIFACT_PREFIX}.state.json"}


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


def test_default_config_and_workflows_validate() -> None:
    schema = load_json(ROOT / "config.schema.json")
    Draft202012Validator(schema).validate(load_json(ROOT / "config.json"))

    workflow_validator = Draft202012Validator(schema["$defs"]["workflowDefinition"])
    for path in sorted((ROOT / "workflows").glob("*.json")):
        workflow_validator.validate(load_json(path))


def test_atom_task_frontmatter_validates() -> None:
    validator = Draft202012Validator(
        load_json(ROOT / "atom-tasks/_schema/atom-task-md.schema.json")
    )
    for path in sorted((ROOT / "atom-tasks").glob("*/*.md")):
        if path.name == "check-list.md":
            continue
        validator.validate(load_frontmatter(path))


@pytest.mark.parametrize("workflow_path", sorted((ROOT / "workflows").glob("*.json")))
def test_required_run_inputs_are_available(workflow_path: Path) -> None:
    tasks = atom_tasks()
    workflow = load_json(workflow_path)
    produced = set(IMPLICIT_RUNTIME_OUTPUTS)
    missing: list[str] = []

    for stage in workflow["pipeline"]:
        if stage["stage"] == "done":
            continue
        for task_name in stage["atomTasks"]["nodes"]:
            task = tasks[task_name]
            for item in task["io"]["inputs"]:
                ref = item["ref"]
                if not item["required"] or not ref.startswith("run://"):
                    continue
                if ref.startswith("run://../"):
                    continue
                if ref not in produced:
                    missing.append(f"{stage['stage']}/{task_name}: {ref}")
            produced.update(item["ref"] for item in task["io"]["outputs"])

    assert missing == [], f"{workflow_path.name} has unavailable required inputs: {missing}"


def test_lightweight_does_not_require_skipped_artifacts() -> None:
    tasks = atom_tasks()
    coding_required = {
        item["ref"] for item in tasks["coding"]["io"]["inputs"] if item["required"]
    }
    verification_required = {
        item["ref"]
        for item in tasks["verification"]["io"]["inputs"]
        if item["required"]
    }

    assert f"{ARTIFACT_PREFIX}tasks/task-group.json" not in coding_required
    assert f"{ARTIFACT_PREFIX}test-plan.md" not in coding_required
    assert f"{ARTIFACT_PREFIX}test-plan.md" not in verification_required
    assert f"{ARTIFACT_PREFIX}spec.md" in coding_required
    assert f"{ARTIFACT_PREFIX}spec.md" in verification_required


def test_test_plan_has_no_self_referential_verification_command() -> None:
    files = [
        ROOT / "atom-tasks/test-plan/test-plan.md",
        ROOT / "atom-tasks/test-plan/test-plan.output.schema.json",
    ]
    forbidden = re.compile(r"tail\s+-n\s+1\s+verification\.log.*ALL PASSED")
    for path in files:
        assert not forbidden.search(path.read_text(encoding="utf-8")), path


def test_runtime_uses_single_artifact_state_path_and_worktree_cwd() -> None:
    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    assert "<artifactDir>/.state.json" in skill
    assert "--run-dir <artifactDir>" in skill
    assert "<worktreePath>/docs/<type>/.state.json" not in skill

    for relative in [
        "atom-tasks/coding/coding.md",
        "atom-tasks/verification/verification.md",
        "atom-tasks/review/review.md",
        "atom-tasks/reflection/reflection.md",
    ]:
        text = (ROOT / relative).read_text(encoding="utf-8")
        assert "worktreePath" in text


def test_done_is_a_terminal_sentinel_with_hard_invariants() -> None:
    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    assert 'stageDef.stage == "done"' in skill
    assert "terminal sentinel" in skill
    assert "unanswered `human:` checks" in skill
    assert "Never report the run as complete" in skill
