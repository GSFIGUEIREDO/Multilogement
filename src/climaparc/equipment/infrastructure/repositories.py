from __future__ import annotations

from backend.database import connect
from backend.repositories import EquipmentRepository as LegacyEquipmentRepository
from backend.repositories import StateRepository as LegacyStateRepository


class DatabaseEquipmentStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            return self.legacy_repository.get(connection, lock=lock)

    def save(self, state: dict) -> None:
        with connect() as connection:
            self.legacy_repository.save(connection, state)


class DatabaseEquipmentPayloadRepository:
    def __init__(self, legacy_repository: LegacyEquipmentRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyEquipmentRepository()

    def upsert(self, equipment: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, equipment)


class DatabaseEquipmentLookupRepository:
    def __init__(self, state_repository: DatabaseEquipmentStateRepository | None = None):
        self.state_repository = state_repository or DatabaseEquipmentStateRepository()

    def exists(self, equipment_id: str) -> bool:
        state = self.state_repository.get(lock=False) or {}
        return any(item.get("id") == equipment_id for item in state.get("equipment", []) if isinstance(item, dict))

