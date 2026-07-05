from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CreateWorkOrderCommand:
    current_user: Any
    work_order: dict


@dataclass(frozen=True)
class UpdateWorkOrderCommand:
    current_user: Any
    work_order: dict

