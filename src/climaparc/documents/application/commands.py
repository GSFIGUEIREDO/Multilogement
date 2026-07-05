from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class UploadFileCommand:
    current_user: Any
    fields: dict[str, str]
    file_part: dict[str, Any]


@dataclass(frozen=True)
class GenerateFileUrlCommand:
    current_user: Any
    file_id: str


@dataclass(frozen=True)
class DeleteFileCommand:
    current_user: Any
    file_id: str
