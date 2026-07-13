import json
import stat
from pathlib import Path

from ddoflow_eval.adapters import _oracle_reply, build_ddo_prompt, build_direct_prompt
from ddoflow_eval.manifest import load_suite
from ddoflow_eval.workspace import copy_skill_overlay


ROOT = Path(__file__).resolve().parents[2]


def test_treatment_prompts_share_verbatim_task_text() -> None:
    task = load_suite(ROOT / "eval/suites/smoke.json").tasks[0]
    direct = build_direct_prompt(task)
    ddo = build_ddo_prompt(task, Path("/tmp/skill"), "lightweight")
    assert task.prompt in direct
    assert task.prompt in ddo
    assert "Ddo-Code-Flow" not in direct
    assert "workflow=lightweight" in ddo


def test_skill_overlay_only_changes_evaluation_control_copy(tmp_path: Path) -> None:
    original = json.loads((ROOT / "workflows/standard.json").read_text())
    overlay = copy_skill_overlay(ROOT, tmp_path / "skill", "standard")
    copied = json.loads((overlay / "workflows/standard.json").read_text())
    current = json.loads((ROOT / "workflows/standard.json").read_text())

    assert current == original
    assert copied["confirmationGates"] == []
    assert copied["atomTaskOverrides"]["test-plan"]["tdd"] is False
    assert not (overlay.stat().st_mode & stat.S_IWUSR)
    assert not ((overlay / "SKILL.md").stat().st_mode & stat.S_IWUSR)


def test_auto_overlay_preserves_router_and_preapproves_every_workflow(tmp_path: Path) -> None:
    original = json.loads((ROOT / "config.json").read_text())
    overlay = copy_skill_overlay(ROOT, tmp_path / "skill", None)
    copied = json.loads((overlay / "config.json").read_text())
    assert copied["workflows"]["selection"] == original["workflows"]["selection"]
    for item in copied["workflows"]["items"]:
        workflow = json.loads((overlay / item["path"]).read_text())
        assert workflow["confirmationGates"] == []


def test_oracle_only_reveals_matched_unused_facts() -> None:
    oracle = {
        "facts": [
            {"id": "api", "patterns": ["constructor", "api"], "answer": "API answer"},
            {"id": "limit", "patterns": ["boundary"], "answer": "Limit answer"},
        ],
        "fallback": "fallback",
    }
    reply, matched = _oracle_reply(oracle, "Which constructor API and boundary?", set())
    assert matched == ["api", "limit"]
    assert "API answer" in reply and "Limit answer" in reply
    assert _oracle_reply(oracle, "constructor", {"api"}) == ("fallback", [])
