from __future__ import annotations

from typing import Callable

from src.climaparc.field_operations.application.commands import ExecuteReplacementCommand
from src.climaparc.field_operations.domain.policies import normalize_replacement_bundle
from src.climaparc.shared.domain.errors import ApplicationError


class ExecuteReplacementUseCase:
    def __init__(
        self,
        transfer_equipment: Callable[[ExecuteReplacementCommand], tuple[dict, dict | None]],
        send_to_storage: Callable[[ExecuteReplacementCommand], tuple[dict, dict | None]],
        dispose_equipment: Callable[[ExecuteReplacementCommand], tuple[dict, dict | None]],
    ):
        self.transfer_equipment = transfer_equipment
        self.send_to_storage = send_to_storage
        self.dispose_equipment = dispose_equipment

    def __call__(self, command: ExecuteReplacementCommand) -> tuple[dict, dict | None]:
        action = str((command.replacement or {}).get("action") or "")
        if action == "transfer_apartment":
            return self.transfer_equipment(command)
        if action == "storage":
            return self.send_to_storage(command)
        if action == "dispose":
            return self.dispose_equipment(command)
        if command.replacement is None:
            return normalize_replacement_bundle(
                command.state,
                command.current_user,
                command.old_equipment,
                command.intervention,
                command.work_order,
                command.replacement,
            )
        raise ApplicationError("Destination de l'ancienne unite obligatoire.")
