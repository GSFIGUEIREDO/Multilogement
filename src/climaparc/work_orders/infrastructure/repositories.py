from __future__ import annotations

from backend.database import connect
from backend.repositories import PayloadTableRepository
from backend.repositories import StateRepository as LegacyStateRepository


class DatabaseWorkOrderStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            return self.legacy_repository.get(connection, lock=lock)

    def save(self, state: dict) -> None:
        with connect() as connection:
            self.legacy_repository.save(connection, state)


class DatabaseWorkOrderPayloadRepository:
    def __init__(self, legacy_repository: PayloadTableRepository | None = None):
        self.legacy_repository = legacy_repository or PayloadTableRepository(
            "climaparc_work_orders",
            [
                ("number", "number"),
                ("ticket_id", "ticketId"),
                ("building_id", "buildingId"),
                ("apartment_id", "apartmentId"),
                ("equipment_id", "equipmentId"),
                ("type_id", "typeId"),
                ("status", "status"),
                ("scheduled_date", "scheduledDate"),
                ("technician_id", "technicianId"),
            ],
        )

    def upsert(self, work_order: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, work_order)


class DatabaseWorkOrderLookupRepository:
    def __init__(self, state_repository: DatabaseWorkOrderStateRepository | None = None):
        self.state_repository = state_repository or DatabaseWorkOrderStateRepository()

    def exists(self, work_order_id: str) -> bool:
        state = self.state_repository.get(lock=False) or {}
        return any(item.get("id") == work_order_id for item in state.get("workOrders", []) if isinstance(item, dict))

