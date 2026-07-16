from __future__ import annotations

from backend.database import connect
from backend.repositories import PayloadTableRepository
from backend.repositories import StateRepository as LegacyStateRepository
from backend.sync_services import sync_intervention_children
from backend.sync_services import sync_work_order_technicians
from src.climaparc.work_orders.infrastructure.repositories import DatabaseWorkOrderPayloadRepository
from src.climaparc.interventions.infrastructure.repositories import load_interventions
from src.climaparc.work_orders.infrastructure.repositories import ensure_work_order_targets


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
                ("type_id", "typeId"),
                ("target_id", "targetId"),
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

    def upsert_intervention_with_targets(self, intervention: dict, targets: list[dict]) -> None:
        target_repository = PayloadTableRepository(
            "climaparc_work_order_targets",
            [("work_order_id", "workOrderId"), ("building_id", "buildingId"), ("apartment_id", "apartmentId"), ("equipment_id", "equipmentId"), ("activity_type_id", "activityTypeId"), ("status", "status"), ("approval_status", "approvalStatus"), ("source_recommendation_id", "sourceRecommendationId"), ("completed_at_text", "completedAt")],
        )
        with connect() as connection:
            self.legacy_repository.upsert(connection, intervention)
            sync_intervention_children(connection, [intervention])
            for target in targets:
                target_repository.upsert(connection, target)


class DatabaseRecommendationWorkflowRepository(DatabaseRecommendationPayloadRepository):
    def __init__(self):
        super().__init__()
        self.state_repository = LegacyStateRepository()
        self.work_order_repository = DatabaseWorkOrderPayloadRepository().legacy_repository
        self.target_repository = PayloadTableRepository(
            "climaparc_work_order_targets",
            [("work_order_id", "workOrderId"), ("building_id", "buildingId"), ("apartment_id", "apartmentId"), ("equipment_id", "equipmentId"), ("activity_type_id", "activityTypeId"), ("status", "status"), ("approval_status", "approvalStatus"), ("source_recommendation_id", "sourceRecommendationId"), ("completed_at_text", "completedAt")],
        )

    def get_state(self) -> dict | None:
        with connect() as connection:
            return self.state_repository.get(connection, lock=False)

    def save_approval_with_work_order(self, intervention: dict, work_order: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, intervention)
            sync_intervention_children(connection, [intervention])
            self.work_order_repository.upsert(connection, work_order)
            sync_work_order_technicians(connection, [work_order])

    def save_route(self, intervention: dict, work_order: dict, target: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, intervention)
            sync_intervention_children(connection, [intervention])
            self.work_order_repository.upsert(connection, work_order)
            sync_work_order_technicians(connection, [work_order])
            self.target_repository.upsert(connection, target)
