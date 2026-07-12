from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .analysis import build_report, load_jsonl
from .errors import EvalError
from .grader import grade_workspace
from .manifest import load_suite, validate_suite
from .runner import run_suite
from .workspace import ensure_repository_cache


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PRIVATE_ROOT = PROJECT_ROOT / ".eval-private"
DEFAULT_CACHE_ROOT = Path("/private/tmp/ddoflow-eval-cache")
DEFAULT_RUNS_ROOT = Path("/private/tmp/ddoflow-eval-runs")


def path(value: str) -> Path:
    return Path(value).expanduser().resolve()


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="ddoflow-eval")
    commands = root.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate", help="validate public and private manifests")
    validate.add_argument("--suite", type=path, required=True)
    validate.add_argument("--private-root", type=path)

    prepare = commands.add_parser("prepare", help="populate repository mirrors")
    prepare.add_argument("--suite", type=path, required=True)
    prepare.add_argument("--cache-root", type=path, default=DEFAULT_CACHE_ROOT)
    prepare.add_argument("--offline", action="store_true")

    run = commands.add_parser("run", help="run Codex conditions and hidden verifiers")
    run.add_argument("--suite", type=path, required=True)
    run.add_argument("--private-root", type=path, default=DEFAULT_PRIVATE_ROOT)
    run.add_argument("--cache-root", type=path, default=DEFAULT_CACHE_ROOT)
    run.add_argument("--runs-root", type=path, default=DEFAULT_RUNS_ROOT)
    run.add_argument("--results", type=path, required=True)
    run.add_argument("--conditions", default="direct,ddo-standard")
    run.add_argument("--repeats", type=int, default=1)
    run.add_argument("--model")
    run.add_argument("--tasks", help="comma-separated task ids")
    run.add_argument("--offline", action="store_true")
    run.add_argument("--skip-setup", action="store_true")

    reference = commands.add_parser(
        "grade-reference", help="run hidden verifiers against reference workspaces"
    )
    reference.add_argument("--suite", type=path, required=True)
    reference.add_argument("--private-root", type=path, default=DEFAULT_PRIVATE_ROOT)
    reference.add_argument("--workspaces-root", type=path, required=True)
    reference.add_argument("--runs-root", type=path, required=True)
    reference.add_argument("--tasks", help="comma-separated task ids")

    audit = commands.add_parser(
        "audit-verifiers",
        help="require every reference workspace to pass and every base workspace to fail",
    )
    audit.add_argument("--suite", type=path, required=True)
    audit.add_argument("--private-root", type=path, default=DEFAULT_PRIVATE_ROOT)
    audit.add_argument("--base-root", type=path, required=True)
    audit.add_argument("--reference-root", type=path, required=True)
    audit.add_argument("--runs-root", type=path, required=True)
    audit.add_argument("--tasks", help="comma-separated task ids")

    analyze = commands.add_parser("analyze", help="aggregate JSONL results")
    analyze.add_argument("--results", type=path, required=True)
    analyze.add_argument("--treatment", default="ddo-standard")
    analyze.add_argument("--baseline", default="direct")
    analyze.add_argument("--output", type=path)
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "validate":
            suite = validate_suite(args.suite, args.private_root)
            print(f"VALID {suite.id}: {len(suite.tasks)} tasks")
            return 0

        if args.command == "prepare":
            suite = load_suite(args.suite)
            for task in suite.tasks:
                mirror = ensure_repository_cache(task, args.cache_root, offline=args.offline)
                print(f"READY {task.id}: {mirror}")
            return 0

        if args.command == "run":
            suite = validate_suite(args.suite, args.private_root)
            conditions = [item.strip() for item in args.conditions.split(",") if item.strip()]
            task_ids = (
                {item.strip() for item in args.tasks.split(",") if item.strip()}
                if args.tasks
                else None
            )
            results = run_suite(
                suite=suite,
                conditions=conditions,
                repeats=args.repeats,
                model=args.model,
                project_root=PROJECT_ROOT,
                private_root=args.private_root,
                cache_root=args.cache_root,
                runs_root=args.runs_root,
                results_jsonl=args.results,
                offline=args.offline,
                setup=not args.skip_setup,
                task_ids=task_ids,
            )
            failures = sum(result["status"] == "infrastructure-failure" for result in results)
            print(f"FINISHED {len(results)} runs; infrastructure failures={failures}")
            return 2 if failures else 0

        if args.command == "grade-reference":
            suite = validate_suite(args.suite, args.private_root)
            selected = set(args.tasks.split(",")) if args.tasks else None
            failed = 0
            for task in suite.tasks:
                if selected is not None and task.id not in selected:
                    continue
                workspace = args.workspaces_root / task.id
                grade = grade_workspace(
                    task=task,
                    workspace=workspace,
                    setup_workspace=workspace,
                    private_root=args.private_root,
                    run_dir=args.runs_root / task.id,
                )
                print(f"{'PASS' if grade.result['passed'] else 'FAIL'} {task.id}")
                failed += not grade.result["passed"]
            return 1 if failed else 0

        if args.command == "audit-verifiers":
            suite = validate_suite(args.suite, args.private_root)
            selected = set(args.tasks.split(",")) if args.tasks else None
            invalid = 0
            for task in suite.tasks:
                if selected is not None and task.id not in selected:
                    continue
                base_workspace = args.base_root / task.id
                reference_workspace = args.reference_root / task.id
                base = grade_workspace(
                    task=task,
                    workspace=base_workspace,
                    setup_workspace=base_workspace,
                    private_root=args.private_root,
                    run_dir=args.runs_root / "base" / task.id,
                )
                reference = grade_workspace(
                    task=task,
                    workspace=reference_workspace,
                    setup_workspace=reference_workspace,
                    private_root=args.private_root,
                    run_dir=args.runs_root / "reference" / task.id,
                )
                valid = not base.result["passed"] and reference.result["passed"]
                print(
                    f"{'VALID' if valid else 'INVALID'} {task.id}: "
                    f"base={base.result['passed']} reference={reference.result['passed']}"
                )
                invalid += not valid
            return 1 if invalid else 0

        if args.command == "analyze":
            report = build_report(load_jsonl(args.results), args.treatment, args.baseline)
            payload = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(payload, encoding="utf-8")
            else:
                print(payload, end="")
            return 0
    except (EvalError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    return 2
