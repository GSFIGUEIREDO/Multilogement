from __future__ import annotations

from backend.database import connect, execute, row_get
from backend.repositories import PayloadTableRepository, decode_payload
from backend.repositories import StateRepository as LegacyStateRepository
from backend.sync_services import rel_table, sync_work_order_technicians


WORK_ORDERS_TABLE = "climaparc_work_orders"


def load_work_orders(connection) -> list[dict]:
    rows = execute(connection, f"select payload from {rel_table(WORK_ORDERS_TABLE)} order by updated_at desc").fetchall()
    return [payload for payload in (decode_payload(row_get(row, "payload")) for row in rows) if payload]


class DatabaseWorkOrderStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            state = self.legacy_repository.get(connection, lock=False) or {}
            state["workOrders"] = load_work_orders(connection)
            return state


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
            sync_work_order_technicians(connection, [work_order])


class DatabaseWorkOrderLookupRepository:
    def __init__(self, state_repository: DatabaseWorkOrderStateRepository | None = None):
        self.state_repository = state_repository or DatabaseWorkOrderStateRepository()

    def exists(self, work_order_id: str) -> bool:
        state = self.state_repository.get(lock=False) or {}
        return any(item.get("id") == work_order_id for item in state.get("workOrders", []) if isinstance(item, dict))
