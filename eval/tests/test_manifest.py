import json
from pathlib import Path

import pytest

from ddoflow_eval.errors import ManifestError
from ddoflow_eval.manifest import load_suite, validate_suite


ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "eval/suites/smoke.json"


def _auto_selected_workflow(requirement: str) -> str:
    """Mirror the public routing contract in SKILL.md Step 2."""
    config = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    normalized = requirement.lower()
    fallback = config["workflows"]["default"]
    for rule in config["workflows"]["selection"]["rules"]:
        if rule.get("fallback"):
            fallback = rule["workflow"]
            continue
        if any(keyword.lower() in normalized for keyword in rule.get("matchAny", [])):
            return rule["workflow"]
    return fallback


def test_smoke_suite_has_six_unique_tasks_covering_all_tracks() -> None:
    suite = load_suite(SUITE)
    assert len(suite.tasks) == 6
    assert len({task.id for task in suite.tasks}) == 6
    assert {task.data["track"] for task in suite.tasks} == {
        "negative-control",
        "long-horizon",
        "ambiguous-hitl",
        "guarded-risk",
        "recovery",
        "routing",
    }
    assert {task.data["language"] for task in suite.tasks} == {"python", "typescript"}


def test_smoke_expected_workflows_match_configured_auto_routing() -> None:
    suite = load_suite(SUITE)
    mismatches = {
        task.id: {
            "expected": task.data["expectedWorkflow"],
            "selected": _auto_selected_workflow(task.prompt),
        }
        for task in suite.tasks
        if _auto_selected_workflow(task.prompt) != task.data["expectedWorkflow"]
    }
    assert mismatches == {}


def test_private_validation_fails_when_hidden_root_is_missing(tmp_path: Path) -> None:
    with pytest.raises(ManifestError, match="manifest not found"):
        validate_suite(SUITE, tmp_path)
