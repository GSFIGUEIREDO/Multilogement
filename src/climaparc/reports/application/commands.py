from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class GetReportContextCommand:
    current_user: Any
    filters: dict

