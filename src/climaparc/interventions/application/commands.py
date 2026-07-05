from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CreateInterventionCommand:
    current_user: Any
    intervention: dict


@dataclass(frozen=True)
class UpdateInterventionCommand:
    current_user: Any
    intervention: dict

