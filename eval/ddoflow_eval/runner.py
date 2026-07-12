from __future__ import annotations

import json
import platform
import re
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .adapters import CONDITIONS, run_agent
from .errors import EvalError, InfrastructureError
from .grader import bootstrap_workspace, grade_workspace
from .manifest import SCHEMA_ROOT, validate_instance
from .models import Suite, Task
from .workspace import collect_patch, create_workspace, run_setup


PROVIDER_FAILURE = re.compile(
    r"(?:rate.?limit|\b429\b|service unavailable|upstream error|"
    r"authentication failed|connection (?:failed|reset|refused))",
    re.IGNORECASE,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def command_version(command: list[str]) -> str | None:
    try:
        completed = subprocess.run(
            command,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=10,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    return completed.stdout.strip().splitlines()[0] if completed.stdout.strip() else None


def git_revision(project_root: Path) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=project_root, text=True
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def provider_failure(processes: tuple) -> str | None:
    for process in processes:
        if process.returncode == 0 or not process.stderr_path.exists():
            continue
        stderr = process.stderr_path.read_text(encoding="utf-8", errors="replace")
        match = PROVIDER_FAILURE.search(stderr)
        if match:
            return match.group(0)
    return None


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def append_jsonl(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n")


def _public_interactions(interactions: tuple[dict[str, Any], ...]) -> list[dict[str, Any]]:
    """Keep useful HITL metrics without publishing private oracle content."""
    return [
        {
            "turn": int(interaction["turn"]),
            "matchedFactCount": len(interaction.get("matchedFacts", [])),
            "usedFallback": not bool(interaction.get("matchedFacts")),
        }
        for interaction in interactions
    ]


def _public_external_result(task: Task, value: dict[str, Any]) -> dict[str, Any]:
    """Expose only public criterion outcomes; raw verifier logs stay in runs-root."""
    acceptance = value["acceptance"]
    return {
        "passed": bool(value["passed"]),
        "acceptance": {
            item["id"]: bool(acceptance[item["id"]])
            for item in task.data["acceptanceCriteria"]
        },
    }


def run_one(
    *,
    suite: Suite,
    task: Task,
    condition: str,
    repeat: int,
    model: str | None,
    project_root: Path,
    private_root: Path,
    cache_root: Path,
    runs_root: Path,
    results_jsonl: Path,
    offline: bool,
    setup: bool,
) -> dict[str, Any]:
    run_id = f"{task.id}-{condition}-r{repeat}-{uuid.uuid4().hex[:8]}"
    run_dir = runs_root / run_id
    run_dir.mkdir(parents=True, exist_ok=False)
    started = time.monotonic()
    result: dict[str, Any] = {
        "schemaVersion": "1.0",
        "runId": run_id,
        "suiteId": suite.id,
        "taskId": task.id,
        "track": task.data["track"],
        "language": task.data["language"],
        "difficulty": task.data["difficulty"],
        "condition": condition,
        "repeat": repeat,
        "model": model,
        "startedAt": utc_now(),
        "status": "infrastructure-failure",
        "taskBaseCommit": task.base_commit,
        "skillCommit": git_revision(project_root),
        "environment": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "codex": command_version(["codex", "--version"]),
            "node": command_version(["node", "--version"]),
        },
    }
    write_json(run_dir / "run-metadata.json", result)

    try:
        workspace = create_workspace(task, run_dir, cache_root, offline=offline)
        bootstrap_workspace(task=task, workspace=workspace, private_root=private_root)
        if setup:
            run_setup(task, workspace, run_dir)
        agent = run_agent(
            task=task,
            condition=condition,
            workspace=workspace,
            run_dir=run_dir,
            project_root=project_root,
            private_root=private_root,
            model=model,
        )
        provider_error = provider_failure(agent.processes)
        if provider_error:
            raise InfrastructureError(f"Codex provider failure: {provider_error}")
        collect_patch(agent.final_workspace, task.base_commit, run_dir / "agent" / "final.patch")
        grade = grade_workspace(
            task=task,
            workspace=agent.final_workspace,
            private_root=private_root,
            run_dir=run_dir,
        )
        externally_passed = bool(grade.result["passed"])
        result.update(
            {
                "status": (
                    "completed"
                    if agent.returncode == 0 and agent.protocol_error is None
                    else "agent-failure"
                ),
                "agentExitCode": agent.returncode,
                "agentDurationSeconds": round(agent.duration_seconds, 3),
                "agentTurns": len(agent.processes),
                "declaredStatus": agent.declared_status,
                "agentProtocolError": agent.protocol_error,
                "selectedWorkflow": agent.selected_workflow,
                "expectedWorkflow": task.data["expectedWorkflow"],
                "routingCorrect": (
                    agent.selected_workflow == task.data["expectedWorkflow"]
                    if condition == "ddo-auto"
                    else None
                ),
                "interactions": _public_interactions(agent.interactions),
                "usage": agent.usage,
                "external": _public_external_result(task, grade.result),
                "verifierExitCode": grade.process.returncode,
                "verifierDurationSeconds": round(grade.process.duration_seconds, 3),
                "falseCompletion": agent.declared_status == "completed" and not externally_passed,
            }
        )
    except EvalError as exc:
        result["error"] = str(exc)
    except Exception as exc:  # preserve unexpected failures as infrastructure evidence
        result["error"] = f"unexpected {type(exc).__name__}: {exc}"

    result["finishedAt"] = utc_now()
    result["durationSeconds"] = round(time.monotonic() - started, 3)
    validate_instance(result, SCHEMA_ROOT / "run-result.schema.json", f"run {run_id}")
    write_json(run_dir / "result.json", result)
    append_jsonl(results_jsonl, result)
    return result


def run_suite(
    *,
    suite: Suite,
    conditions: list[str],
    repeats: int,
    model: str | None,
    project_root: Path,
    private_root: Path,
    cache_root: Path,
    runs_root: Path,
    results_jsonl: Path,
    offline: bool,
    setup: bool,
    task_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    unknown = sorted(set(conditions) - set(CONDITIONS))
    if unknown:
        raise InfrastructureError(f"unknown conditions: {unknown}")
    if repeats < 1:
        raise InfrastructureError("repeats must be at least 1")
    tasks = [task for task in suite.tasks if task_ids is None or task.id in task_ids]
    if task_ids is not None:
        missing = sorted(task_ids - {task.id for task in tasks})
        if missing:
            raise InfrastructureError(f"tasks not present in suite: {missing}")

    schedule = []
    for repeat in range(1, repeats + 1):
        for task in tasks:
            ordered_conditions = conditions if (repeat + len(schedule)) % 2 else list(reversed(conditions))
            for condition in ordered_conditions:
                schedule.append((task, condition, repeat))

    results = []
    for task, condition, repeat in schedule:
        results.append(
            run_one(
                suite=suite,
                task=task,
                condition=condition,
                repeat=repeat,
                model=model,
                project_root=project_root,
                private_root=private_root,
                cache_root=cache_root,
                runs_root=runs_root,
                results_jsonl=results_jsonl,
                offline=offline,
                setup=setup,
            )
        )
    return results
