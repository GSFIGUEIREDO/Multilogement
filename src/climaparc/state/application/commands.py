from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SaveStateCommand:
    current_user: Any
    state: dict | None = None
    changes: dict | None = None

