from pathlib import Path

from ddoflow_eval.manifest import load_suite
from ddoflow_eval.runner import _public_external_result, _public_interactions


ROOT = Path(__file__).resolve().parents[2]


def test_public_interactions_redact_questions_answers_and_fact_ids() -> None:
    public = _public_interactions(
        (
            {
                "turn": 1,
                "question": "private question",
                "answer": "private answer",
                "matchedFacts": ["secret-policy"],
            },
            {
                "turn": 2,
                "question": "another question",
                "answer": "fallback answer",
                "matchedFacts": [],
            },
        )
    )

    assert public == [
        {"turn": 1, "matchedFactCount": 1, "usedFallback": False},
        {"turn": 2, "matchedFactCount": 0, "usedFallback": True},
    ]
    serialized = repr(public)
    assert "private" not in serialized
    assert "secret-policy" not in serialized


def test_public_external_result_redacts_hidden_verifier_details() -> None:
    task = load_suite(ROOT / "eval/suites/smoke.json").tasks[0]
    acceptance = {item["id"]: True for item in task.data["acceptanceCriteria"]}
    public = _public_external_result(
        task,
        {
            "passed": True,
            "acceptance": acceptance,
            "checks": [{"stdout": "hidden assertion details"}],
        },
    )

    assert public == {"passed": True, "acceptance": acceptance}
    assert "checks" not in public
