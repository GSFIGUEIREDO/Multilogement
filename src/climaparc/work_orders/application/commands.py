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


@dataclass(frozen=True)
class CompleteApartmentCommand:
    current_user: Any
    work_order_id: str
    apartment_id: str


@dataclass(frozen=True)
class CloseWorkOrderCommand:
    current_user: Any
    work_order_id: str
    reason: str


@dataclass(frozen=True)
class ReopenWorkOrderCommand:
    current_user: Any
    work_order_id: str
    reason: str
