from __future__ import annotations

from backend.database import connect, execute, row_get
from backend.repositories import decode_payload
from backend.repositories import EquipmentRepository as LegacyEquipmentRepository
from backend.repositories import StateRepository as LegacyStateRepository
from backend.sync_services import rel_table, sync_equipment_attachments


EQUIPMENT_TABLE = "climaparc_equipment"


def load_equipment(connection) -> list[dict]:
    rows = execute(connection, f"select payload from {rel_table(EQUIPMENT_TABLE)} order by updated_at desc").fetchall()
    return [payload for payload in (decode_payload(row_get(row, "payload")) for row in rows) if payload]


class DatabaseEquipmentStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            state = self.legacy_repository.get(connection, lock=False) or {}
            state["equipment"] = load_equipment(connection)
            return state


class DatabaseEquipmentPayloadRepository:
    def __init__(self, legacy_repository: LegacyEquipmentRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyEquipmentRepository()

    def upsert(self, equipment: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, equipment)
            sync_equipment_attachments(connection, [equipment])


class DatabaseEquipmentLookupRepository:
    def __init__(self, state_repository: DatabaseEquipmentStateRepository | None = None):
        self.state_repository = state_repository or DatabaseEquipmentStateRepository()

    def exists(self, equipment_id: str) -> bool:
        state = self.state_repository.get(lock=False) or {}
        return any(item.get("id") == equipment_id for item in state.get("equipment", []) if isinstance(item, dict))
