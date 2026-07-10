from __future__ import annotations

from typing import Protocol


class EquipmentStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...


class EquipmentPayloadRepository(Protocol):
    def upsert(self, equipment: dict) -> None:
        ...


class EquipmentLookupRepository(Protocol):
    def exists(self, equipment_id: str) -> bool:
        ...
