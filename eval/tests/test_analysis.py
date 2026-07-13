from ddoflow_eval.analysis import build_report, cluster_bootstrap_ci, condition_summary


def row(task: str, condition: str, passed: bool, tokens: int = 100) -> dict:
    return {
        "taskId": task,
        "condition": condition,
        "status": "completed",
        "external": {"passed": passed},
        "falseCompletion": not passed,
        "usage": {"input_tokens": tokens, "output_tokens": 10},
    }


def test_condition_and_paired_statistics_are_task_level() -> None:
    rows = [
        row("t1", "direct", False),
        row("t1", "ddo-standard", True),
        row("t2", "direct", True),
        row("t2", "ddo-standard", True),
    ]
    summary = condition_summary(rows)
    assert summary["direct"]["passRate"] == 0.5
    assert summary["ddo-standard"]["passRate"] == 1.0

    report = build_report(rows, "ddo-standard", "direct")
    paired = report["pairedComparison"]
    assert paired["taskCount"] == 2
    assert paired["deltaPassAt1"] == 0.5


def test_bootstrap_is_deterministic() -> None:
    deltas = {"a": 1.0, "b": 0.0, "c": -1.0}
    assert cluster_bootstrap_ci(deltas, samples=1000, seed=7) == cluster_bootstrap_ci(
        deltas, samples=1000, seed=7
    )


def test_report_includes_routing_and_standard_json_nulls() -> None:
    rows = [
        {
            **row("t1", "ddo-auto", True),
            "track": "routing",
            "routingCorrect": True,
        }
    ]
    report = build_report(rows, "ddo-standard", "direct")
    assert report["routing"] == {"count": 1, "correct": 1, "accuracy": 1.0}
    assert report["pairedComparison"]["deltaPassAt1"] is None
