from __future__ import annotations

from backend.database import connect
from backend.repositories import EquipmentRepository, PayloadTableRepository, StateRepository
from backend.sync_services import sync_equipment_attachments, sync_intervention_children, sync_work_order_technicians


class DatabaseFieldOperationRepository:
    def __init__(self):
        self.state_repository = StateRepository()
        self.apartment_repository = PayloadTableRepository("climaparc_apartments", [("building_id", "buildingId"), ("number", "number"), ("occupant", "occupant")])
        self.equipment_repository = EquipmentRepository()
        self.intervention_repository = PayloadTableRepository(
            "climaparc_interventions",
            [("work_order_id", "workOrderId"), ("apartment_id", "apartmentId"), ("equipment_id", "equipmentId"), ("technician_id", "technicianId"), ("form_template_id", "formTemplateId"), ("type_id", "typeId"), ("target_id", "targetId"), ("status", "status"), ("activity_status", "activityStatus"), ("machine_status", "machineStatus"), ("date_text", "date")],
        )
        self.work_order_repository = PayloadTableRepository(
            "climaparc_work_orders",
            [("number", "number"), ("ticket_id", "ticketId"), ("building_id", "buildingId"), ("apartment_id", "apartmentId"), ("equipment_id", "equipmentId"), ("type_id", "typeId"), ("default_activity_type_id", "defaultActivityTypeId"), ("object_text", "object"), ("status", "status"), ("scheduled_date", "scheduledDate"), ("technician_id", "technicianId")],
        )
        self.movement_repository = PayloadTableRepository("climaparc_equipment_movements", [("equipment_id", "equipmentId"), ("movement_type", "movementType"), ("from_apartment_id", "fromApartmentId"), ("to_apartment_id", "toApartmentId"), ("from_storage_location_id", "fromStorageLocationId"), ("to_storage_location_id", "toStorageLocationId"), ("work_order_id", "workOrderId"), ("intervention_id", "interventionId"), ("performed_by", "performedBy"), ("performed_at_text", "performedAt"), ("from_home_building_id", "fromHomeBuildingId"), ("to_home_building_id", "toHomeBuildingId"), ("from_system_id", "fromSystemId"), ("to_system_id", "toSystemId")])
        self.replacement_repository = PayloadTableRepository("climaparc_equipment_replacements", [("old_equipment_id", "oldEquipmentId"), ("new_equipment_id", "newEquipmentId"), ("work_order_id", "workOrderId"), ("intervention_id", "interventionId"), ("completed_at_text", "completedAt")])

    def get_state(self) -> dict | None:
        with connect() as connection:
            return self.state_repository.get(connection, lock=False)

    def save_bundle(self, apartment: dict | None, equipment: dict, intervention: dict, work_order: dict, replacement: dict | None = None) -> None:
        with connect() as connection:
            if apartment:
                self.apartment_repository.upsert(connection, apartment)
            self.equipment_repository.upsert(connection, equipment)
            sync_equipment_attachments(connection, [equipment])
            self.intervention_repository.upsert(connection, intervention)
            sync_intervention_children(connection, [intervention])
            self.work_order_repository.upsert(connection, work_order)
            sync_work_order_technicians(connection, [work_order])
            if replacement:
                new_equipment = replacement["newEquipment"]
                self.equipment_repository.upsert(connection, new_equipment)
                sync_equipment_attachments(connection, [new_equipment])
                self.movement_repository.upsert(connection, replacement["movement"])
                if replacement.get("newEquipmentMovement"):
                    self.movement_repository.upsert(connection, replacement["newEquipmentMovement"])
                self.replacement_repository.upsert(connection, replacement["relation"])
