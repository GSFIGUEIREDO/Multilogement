from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CreateHvacSystemCommand:
    current_user: Any
    system: dict
    work_order_id: str = ""
