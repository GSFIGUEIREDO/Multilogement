from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CreateBuildingCommand:
    current_user: Any
    building: dict


@dataclass(frozen=True)
class UpdateBuildingCommand:
    current_user: Any
    building: dict


@dataclass(frozen=True)
class CreateApartmentCommand:
    current_user: Any
    apartment: dict


@dataclass(frozen=True)
class UpdateApartmentCommand:
    current_user: Any
    apartment: dict

