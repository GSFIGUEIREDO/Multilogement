from __future__ import annotations

from backend.database import connect
from backend.repositories import PayloadTableRepository
from backend.repositories import StateRepository as LegacyStateRepository


class DatabaseInterventionStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            return self.legacy_repository.get(connection, lock=lock)

    def save(self, state: dict) -> None:
        with connect() as connection:
            self.legacy_repository.save(connection, state)


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


class DatabaseInterventionLookupRepository:
    def __init__(self, state_repository: DatabaseInterventionStateRepository | None = None):
        self.state_repository = state_repository or DatabaseInterventionStateRepository()

    def exists(self, intervention_id: str) -> bool:
        state = self.state_repository.get(lock=False) or {}
        return any(item.get("id") == intervention_id for item in state.get("interventions", []) if isinstance(item, dict))

