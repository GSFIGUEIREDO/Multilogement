from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.equipment.application.use_cases.create_equipment import CreateEquipmentUseCase
from src.climaparc.equipment.application.use_cases.update_equipment import UpdateEquipmentUseCase
from src.climaparc.equipment.infrastructure.repositories import (
    DatabaseEquipmentLookupRepository,
    DatabaseEquipmentPayloadRepository,
    DatabaseEquipmentStateRepository,
)


def get_equipment_state_repository() -> DatabaseEquipmentStateRepository:
    return DatabaseEquipmentStateRepository()


def get_equipment_payload_repository() -> DatabaseEquipmentPayloadRepository:
    return DatabaseEquipmentPayloadRepository()


def get_equipment_lookup_repository() -> DatabaseEquipmentLookupRepository:
    return DatabaseEquipmentLookupRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_create_equipment_use_case() -> CreateEquipmentUseCase:
    return CreateEquipmentUseCase(get_equipment_state_repository(), get_equipment_payload_repository())


def get_update_equipment_use_case() -> UpdateEquipmentUseCase:
    return UpdateEquipmentUseCase(get_equipment_state_repository(), get_equipment_payload_repository())

