from __future__ import annotations

from backend.database import connect, execute, row_get
from backend.repositories import PayloadTableRepository, decode_payload
from backend.repositories import StateRepository as LegacyStateRepository
from backend.sync_services import rel_table, sync_intervention_children


INTERVENTIONS_TABLE = "climaparc_interventions"


def load_interventions(connection) -> list[dict]:
    rows = execute(connection, f"select payload from {rel_table(INTERVENTIONS_TABLE)} order by updated_at desc").fetchall()
    return [payload for payload in (decode_payload(row_get(row, "payload")) for row in rows) if payload]


class DatabaseInterventionStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            state = self.legacy_repository.get(connection, lock=False) or {}
            state["interventions"] = load_interventions(connection)
            return state


class DatabaseInterventionPayloadRepository:
    def __init__(self, legacy_repository: PayloadTableRepository | None = None):
        self.legacy_repository = legacy_repository or PayloadTableRepository(
            "climaparc_interventions",
            [
                ("work_order_id", "workOrderId"),
                ("apartment_id", "apartmentId"),
                ("equipment_id", "equipmentId"),
                ("technician_id", "technicianId"),
                ("form_template_id", "formTemplateId"),
                ("status", "status"),
                ("activity_status", "activityStatus"),
                ("machine_status", "machineStatus"),
                ("date_text", "date"),
            ],
        )

    def upsert(self, intervention: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, intervention)
            sync_intervention_children(connection, [intervention])


class DatabaseInterventionLookupRepository:
    def __init__(self, state_repository: DatabaseInterventionStateRepository | None = None):
        self.state_repository = state_repository or DatabaseInterventionStateRepository()

    def exists(self, intervention_id: str) -> bool:
        state = self.state_repository.get(lock=False) or {}
        return any(item.get("id") == intervention_id for item in state.get("interventions", []) if isinstance(item, dict))
