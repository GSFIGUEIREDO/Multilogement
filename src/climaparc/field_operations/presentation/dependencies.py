from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.field_operations.application.use_cases.dispose_equipment import DisposeEquipmentUseCase
from src.climaparc.field_operations.application.use_cases.execute_replacement import ExecuteReplacementUseCase
from src.climaparc.field_operations.application.use_cases.save_field_intervention import SaveFieldInterventionUseCase
from src.climaparc.field_operations.application.use_cases.send_equipment_to_storage import SendEquipmentToStorageUseCase
from src.climaparc.field_operations.application.use_cases.transfer_equipment import TransferEquipmentUseCase
from src.climaparc.field_operations.infrastructure.repositories import DatabaseFieldOperationRepository


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_save_field_intervention_use_case() -> SaveFieldInterventionUseCase:
    replacement = ExecuteReplacementUseCase(
        TransferEquipmentUseCase(),
        SendEquipmentToStorageUseCase(),
        DisposeEquipmentUseCase(),
    )
    return SaveFieldInterventionUseCase(DatabaseFieldOperationRepository(), replacement)
