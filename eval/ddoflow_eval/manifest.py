from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from .errors import ManifestError
from .models import Suite, Task


EVAL_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_ROOT = EVAL_ROOT / "schema"


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ManifestError(f"manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ManifestError(f"invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ManifestError(f"manifest must contain a JSON object: {path}")
    return value


def validate_instance(instance: dict[str, Any], schema_path: Path, label: str) -> None:
    schema = read_json(schema_path)
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(instance), key=lambda error: list(error.path))
    if not errors:
        return
    details = []
    for error in errors:
        location = ".".join(str(part) for part in error.path) or "$"
        details.append(f"{location}: {error.message}")
    raise ManifestError(f"{label} failed schema validation:\n" + "\n".join(details))


def load_task(path: Path) -> Task:
    path = path.resolve()
    data = read_json(path)
    validate_instance(data, SCHEMA_ROOT / "task.schema.json", str(path))
    task = Task(path, data)
    if not task.prompt_path.is_file():
        raise ManifestError(f"task {task.id} prompt not found: {task.prompt_path}")

    criteria = [item["id"] for item in data["acceptanceCriteria"]]
    if len(criteria) != len(set(criteria)):
        raise ManifestError(f"task {task.id} has duplicate acceptance criterion ids")
    interaction = data["interaction"]
    if interaction["mode"] == "scripted" and not interaction.get("oracleId"):
        raise ManifestError(f"task {task.id} uses scripted interaction without oracleId")
    if interaction["mode"] == "none" and interaction.get("oracleId"):
        raise ManifestError(f"task {task.id} declares oracleId while interaction is disabled")
    return task


def load_suite(path: Path) -> Suite:
    path = path.resolve()
    data = read_json(path)
    validate_instance(data, SCHEMA_ROOT / "suite.schema.json", str(path))
    tasks = tuple(load_task(path.parent / task_path) for task_path in data["tasks"])
    task_ids = [task.id for task in tasks]
    if len(task_ids) != len(set(task_ids)):
        raise ManifestError(f"suite {data['id']} contains duplicate task ids")
    return Suite(path, data, tasks)


def private_verifier_dir(private_root: Path, verifier_id: str) -> Path:
    return (private_root.resolve() / "verifiers" / verifier_id).resolve()


def load_private_verifier(private_root: Path, task: Task) -> tuple[Path, dict[str, Any]]:
    verifier_dir = private_verifier_dir(private_root, task.data["verifier"]["id"])
    manifest_path = verifier_dir / "verifier.json"
    data = read_json(manifest_path)
    validate_instance(
        data,
        SCHEMA_ROOT / "private-verifier.schema.json",
        str(manifest_path),
    )
    if data["taskId"] != task.id:
        raise ManifestError(
            f"private verifier taskId {data['taskId']!r} does not match {task.id!r}"
        )
    return verifier_dir, data


def load_oracle(private_root: Path, task: Task) -> dict[str, Any] | None:
    interaction = task.data["interaction"]
    if interaction["mode"] != "scripted":
        return None
    oracle_id = interaction["oracleId"]
    oracle_path = private_root.resolve() / "oracles" / f"{oracle_id}.json"
    data = read_json(oracle_path)
    validate_instance(data, SCHEMA_ROOT / "oracle.schema.json", str(oracle_path))
    if data["id"] != oracle_id:
        raise ManifestError(
            f"oracle id {data['id']!r} does not match requested {oracle_id!r}"
        )
    return data


def validate_suite(path: Path, private_root: Path | None = None) -> Suite:
    suite = load_suite(path)
    if private_root is not None:
        for task in suite.tasks:
            load_private_verifier(private_root, task)
            load_oracle(private_root, task)
    return suite
