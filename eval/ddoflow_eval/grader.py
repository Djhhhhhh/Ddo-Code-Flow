from __future__ import annotations

import json
import hashlib
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .errors import InfrastructureError
from .manifest import load_private_verifier
from .models import Task
from .process import ProcessResult, run_command
from .workspace import runtime_environment


@dataclass(frozen=True)
class Grade:
    process: ProcessResult
    result: dict[str, Any]


def bootstrap_workspace(*, task: Task, workspace: Path, private_root: Path) -> None:
    verifier_dir, manifest = load_private_verifier(private_root, task)
    for item in manifest.get("bootstrapFiles", []):
        source = (verifier_dir / item["source"]).resolve()
        target = (workspace / item["target"]).resolve()
        try:
            source.relative_to(verifier_dir)
            target.relative_to(workspace.resolve())
        except ValueError as exc:
            raise InfrastructureError(
                f"bootstrap path escapes its allowed root for task {task.id}"
            ) from exc
        if not source.is_file():
            raise InfrastructureError(f"bootstrap source is missing: {source}")
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if digest != item["sha256"]:
            raise InfrastructureError(
                f"bootstrap checksum mismatch for {source}: {digest}"
            )
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def grade_workspace(
    *,
    task: Task,
    workspace: Path,
    private_root: Path,
    run_dir: Path,
    setup_workspace: Path | None = None,
) -> Grade:
    verifier_dir, manifest = load_private_verifier(private_root, task)
    result_path = run_dir / "grader" / "result.json"
    setup_workspace = (setup_workspace or (run_dir / "repo")).resolve()
    setup_node_modules = setup_workspace / "node_modules"
    final_node_modules = workspace / "node_modules"
    if (
        task.data["language"] == "typescript"
        and setup_node_modules.exists()
        and not final_node_modules.exists()
    ):
        os.symlink(setup_node_modules, final_node_modules, target_is_directory=True)
    environment = {
        "DDOFLOW_TASK_WORKSPACE": str(workspace.resolve()),
        "DDOFLOW_SETUP_WORKSPACE": str(setup_workspace),
        "DDOFLOW_RESULT_PATH": str(result_path.resolve()),
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    environment.update(runtime_environment(task, run_dir))
    environment.update({str(k): str(v) for k, v in manifest.get("environment", {}).items()})
    process = run_command(
        manifest["command"],
        cwd=verifier_dir,
        stdout_path=run_dir / "grader" / "stdout.log",
        stderr_path=run_dir / "grader" / "stderr.log",
        timeout_seconds=task.data["verifier"]["timeoutSeconds"],
        environment=environment,
    )
    if not result_path.exists():
        raise InfrastructureError(
            f"verifier for {task.id} did not write DDOFLOW_RESULT_PATH: {result_path}"
        )
    try:
        result = json.loads(result_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise InfrastructureError(f"invalid verifier result for {task.id}: {exc}") from exc
    if not isinstance(result, dict) or not isinstance(result.get("passed"), bool):
        raise InfrastructureError(
            f"verifier result for {task.id} must be an object with boolean passed"
        )

    acceptance = result.get("acceptance")
    if not isinstance(acceptance, dict) or any(
        not isinstance(value, bool) for value in acceptance.values()
    ):
        raise InfrastructureError(
            f"verifier acceptance for {task.id} must map criterion ids to booleans"
        )

    expected = {item["id"] for item in task.data["acceptanceCriteria"]}
    actual = set(acceptance)
    if actual != expected:
        raise InfrastructureError(
            f"verifier acceptance ids for {task.id} differ: expected={sorted(expected)}, "
            f"actual={sorted(actual)}"
        )
    if process.returncode == 0 and not result["passed"]:
        raise InfrastructureError(
            f"verifier for {task.id} exited 0 while reporting passed=false"
        )
    if process.returncode != 0 and result["passed"]:
        raise InfrastructureError(
            f"verifier for {task.id} exited {process.returncode} while reporting passed=true"
        )
    return Grade(process=process, result=result)
