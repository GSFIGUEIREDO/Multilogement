from __future__ import annotations

from src.climaparc.field_operations.application.commands import ExecuteReplacementCommand
from src.climaparc.field_operations.domain.policies import normalize_replacement_bundle
from src.climaparc.shared.domain.errors import ApplicationError


class SendEquipmentToStorageUseCase:
    def __call__(self, command: ExecuteReplacementCommand) -> tuple[dict, dict | None]:
        if (command.replacement or {}).get("action") != "storage":
            raise ApplicationError("Envoi au depot invalide.")
        return normalize_replacement_bundle(
            command.state,
            command.current_user,
            command.old_equipment,
            command.intervention,
            command.work_order,
            command.replacement,
        )
