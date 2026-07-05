from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.equipment.application.commands import UpdateEquipmentCommand
from src.climaparc.equipment.domain.policies import (
    clear_ui_state,
    find_equipment_index,
    normalize_equipment_payload,
    preserve_existing_attachments,
    require_can_save_equipment,
)
from src.climaparc.equipment.domain.repositories import EquipmentPayloadRepository, EquipmentStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class UpdateEquipmentUseCase:
    def __init__(self, state_repository: EquipmentStateRepository, payload_repository: EquipmentPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: UpdateEquipmentCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        equipment = stamp_payload(normalize_equipment_payload(command.equipment))

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.")
        items = state.setdefault("equipment", [])
        if not isinstance(items, list):
            items = []
            state["equipment"] = items
        index = find_equipment_index(items, equipment["id"])
        if index < 0:
            raise ApplicationError("Machine introuvable.", HTTPStatus.NOT_FOUND)

        require_can_save_equipment(state, command.current_user, equipment)
        equipment = preserve_existing_attachments(items[index], equipment)
        items[index] = equipment
        clear_ui_state(state)
        self.payload_repository.upsert(equipment)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "equipment": equipment}

