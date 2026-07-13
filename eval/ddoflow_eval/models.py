from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Task:
    manifest_path: Path
    data: dict[str, Any]

    @property
    def id(self) -> str:
        return str(self.data["id"])

    @property
    def prompt_path(self) -> Path:
        return (self.manifest_path.parent / self.data["promptPath"]).resolve()

    @property
    def prompt(self) -> str:
        return self.prompt_path.read_text(encoding="utf-8").strip()

    @property
    def base_commit(self) -> str:
        return str(self.data["repository"]["baseCommit"])

    @property
    def repository_url(self) -> str:
        return str(self.data["repository"]["url"])


@dataclass(frozen=True)
class Suite:
    manifest_path: Path
    data: dict[str, Any]
    tasks: tuple[Task, ...]

    @property
    def id(self) -> str:
        return str(self.data["id"])
