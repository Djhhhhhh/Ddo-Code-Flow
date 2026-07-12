from __future__ import annotations

import json
import random
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSONL at {path}:{number}: {exc}") from exc
        if not isinstance(value, dict):
            raise ValueError(f"expected object at {path}:{number}")
        rows.append(value)
    return rows


def externally_passed(row: dict[str, Any]) -> bool:
    external = row.get("external")
    return isinstance(external, dict) and external.get("passed") is True


def condition_summary(
    rows: Iterable[dict[str, Any]],
) -> dict[str, dict[str, float | int | None]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[str(row.get("condition", "unknown"))].append(row)
    result = {}
    for condition, values in sorted(groups.items()):
        valid = [value for value in values if value.get("status") != "infrastructure-failure"]
        passed = sum(externally_passed(value) for value in valid)
        false_completions = sum(bool(value.get("falseCompletion")) for value in valid)
        input_tokens = sum(int(value.get("usage", {}).get("input_tokens", 0)) for value in valid)
        output_tokens = sum(int(value.get("usage", {}).get("output_tokens", 0)) for value in valid)
        result[condition] = {
            "scheduled": len(values),
            "valid": len(valid),
            "infrastructureFailures": len(values) - len(valid),
            "passed": passed,
            "passRate": passed / len(valid) if valid else None,
            "falseCompletions": false_completions,
            "falseCompletionRate": false_completions / len(valid) if valid else None,
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "tokensPerResolved": (input_tokens + output_tokens) / passed if passed else None,
        }
    return result


def task_condition_rates(rows: Iterable[dict[str, Any]]) -> dict[str, dict[str, float]]:
    grouped: dict[tuple[str, str], list[bool]] = defaultdict(list)
    for row in rows:
        if row.get("status") == "infrastructure-failure":
            continue
        grouped[(str(row["taskId"]), str(row["condition"]))].append(externally_passed(row))
    result: dict[str, dict[str, float]] = defaultdict(dict)
    for (task_id, condition), outcomes in grouped.items():
        result[task_id][condition] = sum(outcomes) / len(outcomes)
    return dict(result)


def paired_delta(
    rows: Iterable[dict[str, Any]], treatment: str, baseline: str
) -> tuple[float | None, dict[str, float]]:
    rates = task_condition_rates(rows)
    deltas = {
        task_id: values[treatment] - values[baseline]
        for task_id, values in rates.items()
        if treatment in values and baseline in values
    }
    if not deltas:
        return None, {}
    return sum(deltas.values()) / len(deltas), deltas


def cluster_bootstrap_ci(
    deltas: dict[str, float], *, samples: int = 10_000, seed: int = 20260711
) -> tuple[float | None, float | None]:
    if not deltas:
        return None, None
    values = list(deltas.values())
    rng = random.Random(seed)
    estimates = []
    for _ in range(samples):
        draw = [rng.choice(values) for _ in values]
        estimates.append(sum(draw) / len(draw))
    estimates.sort()
    low = estimates[int(0.025 * (samples - 1))]
    high = estimates[int(0.975 * (samples - 1))]
    return low, high


def build_report(
    rows: list[dict[str, Any]], treatment: str, baseline: str
) -> dict[str, Any]:
    delta, task_deltas = paired_delta(rows, treatment, baseline)
    low, high = cluster_bootstrap_ci(task_deltas)
    wins = sum(value > 0 for value in task_deltas.values())
    ties = sum(value == 0 for value in task_deltas.values())
    losses = sum(value < 0 for value in task_deltas.values())
    by_track = {}
    tracks = sorted({str(row.get("track")) for row in rows if row.get("track")})
    for track in tracks:
        by_track[track] = condition_summary(
            row for row in rows if str(row.get("track")) == track
        )
    routing_rows = [
        row
        for row in rows
        if row.get("condition") == "ddo-auto" and isinstance(row.get("routingCorrect"), bool)
    ]
    return {
        "schemaVersion": "1.0",
        "conditions": condition_summary(rows),
        "byTrack": by_track,
        "routing": {
            "count": len(routing_rows),
            "correct": sum(bool(row["routingCorrect"]) for row in routing_rows),
            "accuracy": (
                sum(bool(row["routingCorrect"]) for row in routing_rows) / len(routing_rows)
                if routing_rows
                else None
            ),
        },
        "pairedComparison": {
            "treatment": treatment,
            "baseline": baseline,
            "taskCount": len(task_deltas),
            "deltaPassAt1": delta,
            "clusterBootstrap95CI": [low, high],
            "wins": wins,
            "ties": ties,
            "losses": losses,
            "taskDeltas": task_deltas,
        },
    }
