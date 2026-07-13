from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .errors import InfrastructureError
from .manifest import load_oracle
from .models import Task
from .process import ProcessResult, run_command
from .workspace import copy_skill_overlay, locate_ddo_worktree, runtime_environment


CONDITIONS = ("direct", "ddo-lightweight", "ddo-standard", "ddo-guarded", "ddo-auto")


@dataclass(frozen=True)
class AgentRun:
    processes: tuple[ProcessResult, ...]
    final_workspace: Path
    declared_status: str
    final_message: dict[str, Any] | None
    usage: dict[str, int]
    interactions: tuple[dict[str, Any], ...]
    protocol_error: str | None = None
    selected_workflow: str | None = None

    @property
    def returncode(self) -> int:
        return self.processes[-1].returncode

    @property
    def duration_seconds(self) -> float:
        return sum(process.duration_seconds for process in self.processes)


def _agent_contract() -> str:
    return (
        "When you stop, return the required structured result. Use status=completed only "
        "when you believe the requested implementation is finished; otherwise use status=blocked. "
        "If blocked on user clarification, put every concrete question in summary before making "
        "any repository edit."
    )


def build_direct_prompt(task: Task) -> str:
    return (
        "Work on the software-engineering task below in the current Git repository. "
        "You may inspect the repository, edit files, run existing tests, add appropriate tests, "
        "and iterate until confident. Preserve unrelated behavior. Do not access the hidden "
        "evaluation verifier.\n\n"
        f"TASK\n{task.prompt}\n\n{_agent_contract()}"
    )


def build_ddo_prompt(task: Task, skill_root: Path, workflow: str | None) -> str:
    selection = (
        f"with workflow={workflow}"
        if workflow is not None
        else "and let its configured routing rules select the workflow automatically"
    )
    return (
        f"Use the Ddo-Code-Flow skill at {skill_root}/SKILL.md {selection}. "
        "Read and follow that skill and its referenced config, workflow, atom-task, and schema "
        "files. The current Git repository is the target projectRoot; the supplied skill "
        "directory is skillRoot. An evaluation overlay has already approved confirmation gates, "
        "so complete every enabled stage without pausing for confirmation. Never edit skillRoot. "
        "Do not access the hidden evaluation verifier.\n\n"
        f"TASK\n{task.prompt}\n\n{_agent_contract()}"
    )


def _parse_usage(transcript_paths: list[Path]) -> dict[str, int]:
    total: dict[str, int] = {}
    for transcript_path in transcript_paths:
        latest: dict[str, int] = {}
        if not transcript_path.exists():
            continue
        for line in transcript_path.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            usage = event.get("usage")
            if not isinstance(usage, dict):
                continue
            for key in ("input_tokens", "cached_input_tokens", "output_tokens"):
                value = usage.get(key)
                if isinstance(value, int):
                    latest[key] = value
        for key, value in latest.items():
            total[key] = total.get(key, 0) + value
    return total


def _thread_id(transcript_path: Path) -> str | None:
    if not transcript_path.exists():
        return None
    for line in transcript_path.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        value = event.get("thread_id")
        if isinstance(value, str) and value:
            return value
    return None


def _load_final_message(path: Path) -> tuple[str, dict[str, Any] | None]:
    if not path.exists():
        return "missing", None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return "invalid", None
    if not isinstance(data, dict):
        return "invalid", None
    return str(data.get("status", "invalid")), data


def _codex_command(
    *,
    workspace: Path,
    run_dir: Path,
    prompt: str,
    model: str | None,
    agent_schema: Path,
    final_message_path: Path,
    ephemeral: bool,
) -> list[str]:
    command = [
        "codex",
        "exec",
        "--json",
        "--sandbox",
        "workspace-write",
        "--ask-for-approval",
        "never",
        "--cd",
        str(workspace),
        "--add-dir",
        str(run_dir),
        "--output-schema",
        str(agent_schema),
        "--output-last-message",
        str(final_message_path),
    ]
    if ephemeral:
        command.insert(3, "--ephemeral")
    if model:
        command.extend(["--model", model])
    command.append(prompt)
    return command


def _resume_command(
    *,
    thread_id: str,
    reply: str,
    model: str | None,
    agent_schema: Path,
    final_message_path: Path,
) -> list[str]:
    command = [
        "codex",
        "exec",
        "resume",
        "--json",
        "--output-schema",
        str(agent_schema),
        "--output-last-message",
        str(final_message_path),
    ]
    if model:
        command.extend(["--model", model])
    command.extend([thread_id, reply])
    return command


def _oracle_reply(
    oracle: dict[str, Any], question: str, used_facts: set[str]
) -> tuple[str, list[str]]:
    answers = []
    matched = []
    for fact in oracle["facts"]:
        if fact["id"] in used_facts:
            continue
        if any(re.search(pattern, question, re.IGNORECASE) for pattern in fact["patterns"]):
            matched.append(fact["id"])
            answers.append(f"{fact['id']}: {fact['answer']}")
    if not answers:
        return str(oracle["fallback"]), []
    return "\n".join(answers), matched


def _selected_workflow(workspace: Path) -> str | None:
    states = sorted(workspace.glob("docs/*/*/.state.json"))
    if len(states) != 1:
        return None
    try:
        state = json.loads(states[0].read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    value = state.get("workflowId")
    return str(value) if isinstance(value, str) else None


def run_agent(
    *,
    task: Task,
    condition: str,
    workspace: Path,
    run_dir: Path,
    project_root: Path,
    private_root: Path,
    model: str | None,
) -> AgentRun:
    if condition not in CONDITIONS:
        raise InfrastructureError(f"unsupported condition: {condition}")

    agent_schema = project_root / "eval/schema/agent-result.schema.json"
    oracle = load_oracle(private_root, task)

    if condition == "direct":
        prompt = build_direct_prompt(task)
        expected_final_workspace = workspace
    else:
        requested = condition.removeprefix("ddo-")
        workflow = None if requested == "auto" else requested
        skill_overlay = copy_skill_overlay(
            project_root,
            run_dir / "control" / "ddo-code-flow",
            workflow,
        )
        prompt = build_ddo_prompt(task, skill_overlay, workflow)
        expected_final_workspace = None

    transcript_paths = [run_dir / "agent" / "turn-01.jsonl"]
    final_message_paths = [run_dir / "agent" / "turn-01-final.json"]
    command = _codex_command(
        workspace=workspace,
        run_dir=run_dir,
        prompt=prompt,
        model=model,
        agent_schema=agent_schema,
        final_message_path=final_message_paths[0],
        ephemeral=oracle is None,
    )
    processes = [
        run_command(
            command,
            cwd=workspace,
            stdout_path=transcript_paths[0],
            stderr_path=run_dir / "agent" / "turn-01.stderr.log",
            timeout_seconds=task.data["budgets"]["wallTimeSeconds"],
            environment=runtime_environment(task, run_dir),
        )
    ]

    declared_status, final_message = _load_final_message(final_message_paths[0])
    interactions: list[dict[str, Any]] = []
    if oracle is not None and processes[0].returncode == 0:
        thread_id = _thread_id(transcript_paths[0])
        if not thread_id:
            raise InfrastructureError("scripted interaction run did not emit a thread_id")
        used_facts: set[str] = set()
        for turn in range(2, int(oracle["maxTurns"]) + 2):
            if declared_status != "blocked" or not final_message:
                break
            question = str(final_message.get("summary", ""))
            answer, matched = _oracle_reply(oracle, question, used_facts)
            used_facts.update(matched)
            interactions.append(
                {
                    "turn": turn - 1,
                    "question": question,
                    "answer": answer,
                    "matchedFacts": matched,
                }
            )
            reply = (
                "Scripted user response:\n"
                f"{answer}\n\n"
                "Continue the same task. Ask only for any still-missing decision; otherwise "
                "finish the implementation and verification."
            )
            transcript_path = run_dir / "agent" / f"turn-{turn:02d}.jsonl"
            final_path = run_dir / "agent" / f"turn-{turn:02d}-final.json"
            transcript_paths.append(transcript_path)
            final_message_paths.append(final_path)
            remaining = task.data["budgets"]["wallTimeSeconds"] - int(
                sum(process.duration_seconds for process in processes)
            )
            if remaining < 60:
                break
            resumed = run_command(
                _resume_command(
                    thread_id=thread_id,
                    reply=reply,
                    model=model,
                    agent_schema=agent_schema,
                    final_message_path=final_path,
                ),
                cwd=workspace,
                stdout_path=transcript_path,
                stderr_path=run_dir / "agent" / f"turn-{turn:02d}.stderr.log",
                timeout_seconds=remaining,
                environment=runtime_environment(task, run_dir),
            )
            processes.append(resumed)
            declared_status, final_message = _load_final_message(final_path)
            if resumed.returncode != 0:
                break

    (run_dir / "agent" / "interactions.json").write_text(
        json.dumps(interactions, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    protocol_error = None
    if expected_final_workspace is None:
        try:
            expected_final_workspace = locate_ddo_worktree(workspace, run_dir)
        except InfrastructureError as exc:
            # A missing or ambiguous Ddo worktree is a treatment failure, not a
            # harness failure. Grade the untouched project checkout so the run
            # remains in the denominator.
            protocol_error = str(exc)
            expected_final_workspace = workspace
    if declared_status in {"missing", "invalid"}:
        protocol_error = protocol_error or f"invalid structured final status: {declared_status}"
    return AgentRun(
        processes=tuple(processes),
        final_workspace=expected_final_workspace,
        declared_status=declared_status,
        final_message=final_message,
        usage=_parse_usage(transcript_paths),
        interactions=tuple(interactions),
        protocol_error=protocol_error,
        selected_workflow=(
            _selected_workflow(expected_final_workspace)
            if condition.startswith("ddo-")
            else None
        ),
    )
