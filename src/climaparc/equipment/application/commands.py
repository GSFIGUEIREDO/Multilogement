from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CreateEquipmentCommand:
    current_user: Any
    equipment: dict


@dataclass(frozen=True)
class UpdateEquipmentCommand:
    current_user: Any
    equipment: dict

