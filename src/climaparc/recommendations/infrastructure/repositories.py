from __future__ import annotations

from backend.database import connect
from backend.repositories import PayloadTableRepository
from backend.repositories import StateRepository as LegacyStateRepository
from backend.sync_services import sync_intervention_children
from backend.sync_services import sync_work_order_technicians
from src.climaparc.work_orders.infrastructure.repositories import DatabaseWorkOrderPayloadRepository
from src.climaparc.interventions.infrastructure.repositories import load_interventions


class DatabaseRecommendationStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            state = self.legacy_repository.get(connection, lock=False) or {}
            state["interventions"] = load_interventions(connection)
            return state


class DatabaseRecommendationPayloadRepository:
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

    def upsert_intervention(self, intervention: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, intervention)
            sync_intervention_children(connection, [intervention])


class DatabaseRecommendationWorkflowRepository(DatabaseRecommendationPayloadRepository):
    def __init__(self):
        super().__init__()
        self.state_repository = LegacyStateRepository()
        self.work_order_repository = DatabaseWorkOrderPayloadRepository().legacy_repository

    def get_state(self) -> dict | None:
        with connect() as connection:
            return self.state_repository.get(connection, lock=False)

    def save_approval_with_work_order(self, intervention: dict, work_order: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, intervention)
            sync_intervention_children(connection, [intervention])
            self.work_order_repository.upsert(connection, work_order)
            sync_work_order_technicians(connection, [work_order])
