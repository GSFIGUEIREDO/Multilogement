from __future__ import annotations

from src.climaparc.equipment.application.commands import CreateEquipmentCommand, UpdateEquipmentCommand
from src.climaparc.equipment.application.use_cases.create_equipment import CreateEquipmentUseCase
from src.climaparc.equipment.application.use_cases.update_equipment import UpdateEquipmentUseCase
from src.climaparc.equipment.infrastructure.repositories import DatabaseEquipmentLookupRepository


def save_equipment_with_use_cases(
    current_user: dict,
    equipment_payload: dict | None,
    lookup_repository: DatabaseEquipmentLookupRepository,
    create_equipment_use_case: CreateEquipmentUseCase,
    update_equipment_use_case: UpdateEquipmentUseCase,
) -> dict:
    equipment = equipment_payload or {}
    equipment_id = str(equipment.get("id") or "") if isinstance(equipment, dict) else ""
    if equipment_id and lookup_repository.exists(equipment_id):
        return update_equipment_use_case(UpdateEquipmentCommand(current_user, equipment))
    return create_equipment_use_case(CreateEquipmentCommand(current_user, equipment))

