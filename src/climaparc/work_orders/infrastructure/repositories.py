from __future__ import annotations

from backend.database import connect, execute, row_get
from backend.repositories import PayloadTableRepository, decode_payload
from backend.repositories import StateRepository as LegacyStateRepository
from backend.sync_services import rel_table, sync_work_order_technicians


WORK_ORDERS_TABLE = "climaparc_work_orders"


def load_work_orders(connection) -> list[dict]:
    rows = execute(connection, f"select payload from {rel_table(WORK_ORDERS_TABLE)} order by updated_at desc").fetchall()
    return [payload for payload in (decode_payload(row_get(row, "payload")) for row in rows) if payload]


def ensure_work_order_targets(connection, work_order: dict) -> None:
    repository = PayloadTableRepository(
        "climaparc_work_order_targets",
        [("work_order_id", "workOrderId"), ("building_id", "buildingId"), ("apartment_id", "apartmentId"), ("equipment_id", "equipmentId"), ("activity_type_id", "activityTypeId"), ("status", "status"), ("approval_status", "approvalStatus"), ("source_recommendation_id", "sourceRecommendationId"), ("completed_at_text", "completedAt")],
    )
    apartment_ids: list[str] = []
    if work_order.get("buildingId") and work_order.get("scope") != "equipment":
        rows = execute(connection, "select id from climaparc_apartments where building_id = ?", (work_order.get("buildingId"),)).fetchall()
        apartment_ids = [str(row_get(row, "id")) for row in rows if row_get(row, "id")]
    elif work_order.get("equipmentId"):
        row = execute(connection, "select apartment_id from climaparc_equipment where id = ?", (work_order.get("equipmentId"),)).fetchone()
        if row and row_get(row, "apartment_id"):
            apartment_ids = [str(row_get(row, "apartment_id"))]
    elif work_order.get("apartmentId"):
        apartment_ids = [str(work_order.get("apartmentId"))]
    for apartment_id in apartment_ids:
        apartment_row = execute(connection, "select building_id from climaparc_apartments where id = ?", (apartment_id,)).fetchone()
        target_id = f"target-{work_order['id']}-{apartment_id}"
        existing = execute(connection, "select payload from climaparc_work_order_targets where id = ?", (target_id,)).fetchone()
        payload = decode_payload(row_get(existing, "payload")) if existing else None
        repository.upsert(connection, payload or {
            "id": target_id,
            "workOrderId": work_order["id"],
            "buildingId": work_order.get("buildingId") or (row_get(apartment_row, "building_id") if apartment_row else "") or "",
            "apartmentId": apartment_id,
            "equipmentId": work_order.get("equipmentId") or "",
            "activityTypeId": work_order.get("defaultActivityTypeId") or work_order.get("typeId") or "",
            "status": "a_faire",
            "approvalStatus": "not_required",
            "sourceRecommendationId": "",
            "completedAt": "",
        })


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
                ("default_activity_type_id", "defaultActivityTypeId"),
                ("object_text", "object"),
                ("status", "status"),
                ("scheduled_date", "scheduledDate"),
                ("technician_id", "technicianId"),
            ],
        )

    def upsert(self, work_order: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, work_order)
            sync_work_order_technicians(connection, [work_order])
            ensure_work_order_targets(connection, work_order)


class DatabaseWorkOrderLookupRepository:
    def __init__(self, state_repository: DatabaseWorkOrderStateRepository | None = None):
        self.state_repository = state_repository or DatabaseWorkOrderStateRepository()

    def exists(self, work_order_id: str) -> bool:
        state = self.state_repository.get(lock=False) or {}
        return any(item.get("id") == work_order_id for item in state.get("workOrders", []) if isinstance(item, dict))


class DatabaseWorkOrderOperationRepository:
    def __init__(self):
        self.state_repository = LegacyStateRepository()
        self.order_repository = DatabaseWorkOrderPayloadRepository().legacy_repository
        self.target_repository = PayloadTableRepository(
            "climaparc_work_order_targets",
            [("work_order_id", "workOrderId"), ("building_id", "buildingId"), ("apartment_id", "apartmentId"), ("equipment_id", "equipmentId"), ("activity_type_id", "activityTypeId"), ("status", "status"), ("approval_status", "approvalStatus"), ("source_recommendation_id", "sourceRecommendationId"), ("completed_at_text", "completedAt")],
        )
        self.audit_repository = PayloadTableRepository(
            "climaparc_work_order_completion_audits",
            [("work_order_id", "workOrderId"), ("apartment_id", "apartmentId"), ("action", "action"), ("reason", "reason"), ("performed_by", "performedBy"), ("performed_at_text", "performedAt")],
        )

    def get_state(self) -> dict | None:
        with connect() as connection:
            return self.state_repository.get(connection, lock=False)

    def save_completion(self, work_order: dict, targets: list[dict], audit: dict) -> None:
        with connect() as connection:
            self.order_repository.upsert(connection, work_order)
            sync_work_order_technicians(connection, [work_order])
            for target in targets:
                self.target_repository.upsert(connection, target)
            self.audit_repository.upsert(connection, audit)
