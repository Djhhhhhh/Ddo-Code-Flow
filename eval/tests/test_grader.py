import json
from pathlib import Path

import pytest

from ddoflow_eval.errors import InfrastructureError
from ddoflow_eval.grader import bootstrap_workspace, grade_workspace
from ddoflow_eval.manifest import load_suite


ROOT = Path(__file__).resolve().parents[2]


def test_private_verifier_protocol(tmp_path: Path) -> None:
    task = load_suite(ROOT / "eval/suites/smoke.json").tasks[0]
    private = tmp_path / "private"
    verifier = private / "verifiers" / task.data["verifier"]["id"]
    verifier.mkdir(parents=True)
    (verifier / "verifier.json").write_text(
        json.dumps(
            {
                "schemaVersion": "1.0",
                "taskId": task.id,
                "command": ["python3", "verify.py"],
            }
        ),
        encoding="utf-8",
    )
    criteria = {item["id"]: True for item in task.data["acceptanceCriteria"]}
    (verifier / "verify.py").write_text(
        "import json, os\n"
        f"result = {{'passed': True, 'acceptance': {criteria!r}}}\n"
        "open(os.environ['DDOFLOW_RESULT_PATH'], 'w').write(json.dumps(result))\n",
        encoding="utf-8",
    )
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    grade = grade_workspace(
        task=task,
        workspace=workspace,
        private_root=private,
        run_dir=tmp_path / "run",
    )
    assert grade.result["passed"] is True
    assert grade.process.returncode == 0


def test_private_bootstrap_checks_hash_and_copies_only_declared_file(tmp_path: Path) -> None:
    import hashlib

    task = load_suite(ROOT / "eval/suites/smoke.json").tasks[0]
    private = tmp_path / "private"
    verifier = private / "verifiers" / task.data["verifier"]["id"]
    verifier.mkdir(parents=True)
    payload = b"locked\n"
    (verifier / "lock.txt").write_bytes(payload)
    (verifier / "verifier.json").write_text(
        json.dumps(
            {
                "schemaVersion": "1.0",
                "taskId": task.id,
                "command": ["python3", "verify.py"],
                "bootstrapFiles": [
                    {
                        "source": "lock.txt",
                        "target": "lock.txt",
                        "sha256": hashlib.sha256(payload).hexdigest(),
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    bootstrap_workspace(task=task, workspace=workspace, private_root=private)
    assert (workspace / "lock.txt").read_bytes() == payload


def test_private_verifier_acceptance_values_must_be_boolean(tmp_path: Path) -> None:
    task = load_suite(ROOT / "eval/suites/smoke.json").tasks[0]
    private = tmp_path / "private"
    verifier = private / "verifiers" / task.data["verifier"]["id"]
    verifier.mkdir(parents=True)
    (verifier / "verifier.json").write_text(
        json.dumps(
            {
                "schemaVersion": "1.0",
                "taskId": task.id,
                "command": ["python3", "verify.py"],
            }
        ),
        encoding="utf-8",
    )
    criteria = {
        item["id"]: ("yes" if index == 0 else True)
        for index, item in enumerate(task.data["acceptanceCriteria"])
    }
    (verifier / "verify.py").write_text(
        "import json, os\n"
        f"result = {{'passed': True, 'acceptance': {criteria!r}}}\n"
        "open(os.environ['DDOFLOW_RESULT_PATH'], 'w').write(json.dumps(result))\n",
        encoding="utf-8",
    )
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    with pytest.raises(InfrastructureError, match="must map criterion ids to booleans"):
        grade_workspace(
            task=task,
            workspace=workspace,
            private_root=private,
            run_dir=tmp_path / "run",
        )
