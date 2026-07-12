from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

from .errors import InfrastructureError
from .models import Task
from .process import ProcessResult, run_command


_WORKTREE_SITECUSTOMIZE = """\
from pathlib import Path
import sys


def _repository_root(start: Path) -> Path | None:
    for candidate in (start, *start.parents):
        marker = candidate / ".git"
        if marker.is_dir() or marker.is_file():
            return candidate
    return None


try:
    _root = _repository_root(Path.cwd().resolve())
except OSError:
    _root = None

if _root is not None:
    # Editable installs record the checkout used during setup. Ddo runs in a
    # later git worktree, so prefer import roots from the process's worktree.
    _sources = (_root / "src", _root)
    sys.path[:0] = [str(path) for path in _sources if path.is_dir()]
"""


def repository_cache_path(cache_root: Path, url: str) -> Path:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:20]
    return cache_root / "repositories" / f"{digest}.git"


def _checked(command: list[str], cwd: Path | None = None) -> str:
    completed = subprocess.run(
        command,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        raise InfrastructureError(
            f"command failed ({completed.returncode}): {' '.join(command)}\n"
            f"{completed.stderr.strip()}"
        )
    return completed.stdout.strip()


def ensure_repository_cache(task: Task, cache_root: Path, *, offline: bool) -> Path:
    mirror = repository_cache_path(cache_root, task.repository_url)
    mirror.parent.mkdir(parents=True, exist_ok=True)
    if not mirror.exists():
        if offline:
            raise InfrastructureError(
                f"repository cache missing in offline mode for {task.id}: {mirror}"
            )
        _checked(["git", "clone", "--mirror", task.repository_url, str(mirror)])
    elif not offline:
        _checked(["git", "--git-dir", str(mirror), "fetch", "--prune", "origin"])

    _checked(
        ["git", "--git-dir", str(mirror), "cat-file", "-e", f"{task.base_commit}^{{commit}}"]
    )
    return mirror


def create_workspace(task: Task, run_dir: Path, cache_root: Path, *, offline: bool) -> Path:
    mirror = ensure_repository_cache(task, cache_root, offline=offline)
    workspace = run_dir / "repo"
    if workspace.exists():
        raise InfrastructureError(f"workspace already exists: {workspace}")
    _checked(["git", "clone", "--shared", str(mirror), str(workspace)])
    _checked(["git", "checkout", "--detach", task.base_commit], cwd=workspace)
    _checked(["git", "config", "user.name", "DdoFlow Eval"], cwd=workspace)
    _checked(["git", "config", "user.email", "eval@ddo-code-flow.invalid"], cwd=workspace)
    if _checked(["git", "status", "--porcelain"], cwd=workspace):
        raise InfrastructureError(f"fresh workspace is unexpectedly dirty: {workspace}")
    return workspace


def run_setup(task: Task, workspace: Path, run_dir: Path) -> list[ProcessResult]:
    results = []
    if task.data["language"] == "python":
        venv = run_dir / "runtime" / "python"
        result = run_command(
            [sys.executable, "-m", "venv", str(venv)],
            cwd=workspace,
            stdout_path=run_dir / "setup" / "00-venv.stdout.log",
            stderr_path=run_dir / "setup" / "00-venv.stderr.log",
            timeout_seconds=300,
        )
        results.append(result)
        if result.returncode != 0:
            raise InfrastructureError(f"failed to create Python venv; see {result.stderr_path}")

    environment = runtime_environment(task, run_dir)
    environment.update(
        {str(k): str(v) for k, v in task.data["setup"].get("environment", {}).items()}
    )
    for index, command in enumerate(task.data["setup"]["commands"], start=1):
        result = run_command(
            command,
            cwd=workspace,
            stdout_path=run_dir / "setup" / f"{index:02d}.stdout.log",
            stderr_path=run_dir / "setup" / f"{index:02d}.stderr.log",
            timeout_seconds=min(task.data["budgets"]["wallTimeSeconds"], 3600),
            environment=environment,
        )
        results.append(result)
        if result.returncode != 0:
            raise InfrastructureError(
                f"setup command failed for {task.id}: {' '.join(command)}; "
                f"see {result.stderr_path}"
            )
    if task.data["language"] == "typescript":
        installed = workspace / "node_modules"
        shared = run_dir / "node_modules"
        if not installed.is_dir():
            raise InfrastructureError(
                f"TypeScript setup did not create node_modules for {task.id}"
            )
        if not shared.exists():
            os.symlink(installed, shared, target_is_directory=True)
        hook = workspace / ".git" / "hooks" / "post-checkout"
        hook.write_text(
            "#!/bin/sh\n"
            "worktree=$(git rev-parse --show-toplevel)\n"
            f"modules={shlex_quote(str(installed.resolve()))}\n"
            'if [ ! -e "$worktree/node_modules" ]; then\n'
            '  ln -s "$modules" "$worktree/node_modules"\n'
            "fi\n",
            encoding="utf-8",
        )
        os.chmod(hook, 0o755)
    return results


def runtime_environment(task: Task, run_dir: Path) -> dict[str, str]:
    environment: dict[str, str] = {
        str(key): str(value)
        for key, value in task.data["setup"].get("environment", {}).items()
    }
    if task.data["language"] == "python":
        venv = (run_dir / "runtime" / "python").resolve()
        environment["VIRTUAL_ENV"] = str(venv)
        environment["PATH"] = f"{venv / 'bin'}{os.pathsep}{os.environ.get('PATH', '')}"
        shim_dir = run_dir / "runtime" / "python-worktree-imports"
        shim_dir.mkdir(parents=True, exist_ok=True)
        shim_path = shim_dir / "sitecustomize.py"
        if (
            not shim_path.exists()
            or shim_path.read_text(encoding="utf-8") != _WORKTREE_SITECUSTOMIZE
        ):
            shim_path.write_text(_WORKTREE_SITECUSTOMIZE, encoding="utf-8")
        configured_pythonpath = environment.get("PYTHONPATH")
        inherited_pythonpath = os.environ.get("PYTHONPATH")
        pythonpath = [str(shim_dir.resolve())]
        if configured_pythonpath:
            pythonpath.append(configured_pythonpath)
        elif inherited_pythonpath:
            pythonpath.append(inherited_pythonpath)
        environment["PYTHONPATH"] = os.pathsep.join(pythonpath)
    return environment


def shlex_quote(value: str) -> str:
    import shlex

    return shlex.quote(value)


def locate_ddo_worktree(original_workspace: Path, run_dir: Path) -> Path:
    output = _checked(["git", "worktree", "list", "--porcelain"], cwd=original_workspace)
    candidates = []
    for line in output.splitlines():
        if not line.startswith("worktree "):
            continue
        path = Path(line.removeprefix("worktree ")).resolve()
        if path == original_workspace.resolve():
            continue
        try:
            path.relative_to(run_dir.resolve())
        except ValueError:
            continue
        candidates.append(path)
    if len(candidates) != 1:
        raise InfrastructureError(
            f"expected exactly one Ddo worktree under {run_dir}, found {candidates}"
        )
    return candidates[0]


def collect_patch(workspace: Path, base_commit: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    completed = subprocess.run(
        ["git", "diff", "--binary", base_commit, "--"],
        cwd=workspace,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        raise InfrastructureError(completed.stderr.decode("utf-8", errors="replace"))
    output_path.write_bytes(completed.stdout)


def copy_skill_overlay(
    skill_root: Path, destination: Path, workflow: str | None
) -> Path:
    ignored = shutil.ignore_patterns(
        ".git", ".eval-private", "eval", "__pycache__", "*.pyc"
    )
    shutil.copytree(skill_root, destination, ignore=ignored)

    config_path = destination / "config.json"
    import json

    config = json.loads(config_path.read_text(encoding="utf-8"))
    if workflow is not None:
        config["workflows"]["default"] = workflow
        config["workflows"]["selection"]["rules"] = [
            {"workflow": workflow, "fallback": True}
        ]
    config["base"]["metrics"]["enabled"] = False
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    workflow_items = config["workflows"]["items"]
    if workflow is not None:
        workflow_items = [item for item in workflow_items if item["id"] == workflow]
    for item in workflow_items:
        workflow_path = destination / item["path"]
        workflow_data = json.loads(workflow_path.read_text(encoding="utf-8"))
        workflow_data["confirmationGates"] = []
        if "test-plan" in workflow_data.get("atomTaskOverrides", {}):
            workflow_data["atomTaskOverrides"]["test-plan"]["tdd"] = False
        workflow_path.write_text(
            json.dumps(workflow_data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    for path in destination.rglob("*"):
        if path.is_file():
            os.chmod(path, 0o444)
        elif path.is_dir():
            os.chmod(path, 0o555)
    os.chmod(destination, 0o555)
    return destination
