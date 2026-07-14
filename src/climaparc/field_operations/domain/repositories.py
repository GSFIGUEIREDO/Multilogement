from __future__ import annotations

from typing import Protocol


class FieldOperationRepository(Protocol):
    def get_state(self) -> dict | None:
        ...

    def save_bundle(self, apartment: dict | None, equipment: dict, intervention: dict, work_order: dict, replacement: dict | None = None) -> None:
        ...
