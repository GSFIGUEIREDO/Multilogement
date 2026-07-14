from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SaveFieldInterventionCommand:
    current_user: Any
    apartment: dict | None
    equipment: dict
    intervention: dict
    work_order: dict
    replacement: dict | None = None


@dataclass(frozen=True)
class ExecuteReplacementCommand:
    state: dict
    current_user: Any
    old_equipment: dict
    intervention: dict
    work_order: dict
    replacement: dict | None
