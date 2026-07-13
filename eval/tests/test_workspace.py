from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from ddoflow_eval.models import Task
from ddoflow_eval.workspace import run_setup, runtime_environment


def _task(*, environment: dict[str, str] | None = None) -> Task:
    return Task(
        manifest_path=Path("task.json"),
        data={
            "id": "python-worktree-test",
            "language": "python",
            "setup": {"commands": [], "environment": environment or {}},
            "budgets": {"wallTimeSeconds": 60},
        },
    )


def _git(*args: str, cwd: Path) -> None:
    subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def _import_value(python: Path, cwd: Path, environment: dict[str, str]) -> str:
    completed = subprocess.run(
        [str(python), "-c", "import sample_package; print(sample_package.VALUE)"],
        cwd=cwd,
        env=environment,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return completed.stdout.strip()


def test_python_runtime_prefers_current_worktree_over_editable_checkout(
    tmp_path: Path,
) -> None:
    base = tmp_path / "base"
    package = base / "src" / "sample_package"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("VALUE = 'base'\n", encoding="utf-8")
    _git("init", cwd=base)
    _git("config", "user.name", "DdoFlow Eval Test", cwd=base)
    _git("config", "user.email", "eval-test@example.invalid", cwd=base)
    _git("add", ".", cwd=base)
    _git("commit", "-m", "base", cwd=base)

    worktree = tmp_path / "worktree"
    _git("worktree", "add", "-b", "test-worktree", str(worktree), cwd=base)
    worktree_package = worktree / "src" / "sample_package"
    (worktree_package / "__init__.py").write_text(
        "VALUE = 'worktree'\n", encoding="utf-8"
    )
    nested_cwd = worktree / "tests" / "unit"
    nested_cwd.mkdir(parents=True)

    task = _task()
    run_dir = tmp_path / "run"
    run_setup(task, base, run_dir)
    venv_python = run_dir / "runtime" / "python" / "bin" / "python"
    purelib = Path(
        subprocess.check_output(
            [
                str(venv_python),
                "-c",
                "import sysconfig; print(sysconfig.get_paths()['purelib'])",
            ],
            text=True,
        ).strip()
    )
    # Model the .pth file produced by an editable install in the setup checkout.
    (purelib / "sample-editable.pth").write_text(
        str((base / "src").resolve()) + "\n", encoding="utf-8"
    )

    uncorrected = os.environ.copy()
    uncorrected.pop("PYTHONPATH", None)
    assert _import_value(venv_python, nested_cwd, uncorrected) == "base"

    corrected = os.environ.copy()
    corrected.update(runtime_environment(task, run_dir))
    assert _import_value(venv_python, nested_cwd, corrected) == "worktree"


def test_python_runtime_preserves_configured_pythonpath(tmp_path: Path) -> None:
    configured = os.pathsep.join(("custom-one", "custom-two"))
    environment = runtime_environment(
        _task(environment={"PYTHONPATH": configured}), tmp_path / "run"
    )
    entries = environment["PYTHONPATH"].split(os.pathsep)
    assert entries[0].endswith("runtime/python-worktree-imports")
    assert entries[1:] == ["custom-one", "custom-two"]
    assert (Path(entries[0]) / "sitecustomize.py").is_file()
