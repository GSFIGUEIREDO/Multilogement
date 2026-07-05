from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.reminders.application.commands import SaveReminderBatchCommand
from src.climaparc.reminders.domain.policies import (
    clear_ui_state,
    find_reminder_index,
    normalize_reminder_batch,
    reminder_equipment_exists,
    require_can_manage_reminders,
)
from src.climaparc.reminders.domain.repositories import ReminderPayloadRepository, ReminderStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class SaveReminderBatchUseCase:
    def __init__(self, state_repository: ReminderStateRepository, payload_repository: ReminderPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: SaveReminderBatchCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        require_can_manage_reminders(command.current_user)
        incoming = [stamp_payload(item) for item in normalize_reminder_batch(command.reminders)]

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        for reminder in incoming:
            if not reminder_equipment_exists(state, reminder):
                raise ApplicationError("Machine introuvable.", HTTPStatus.NOT_FOUND)

        reminders = state.setdefault("reminders", [])
        if not isinstance(reminders, list):
            reminders = []
            state["reminders"] = reminders
        for reminder in reversed(incoming):
            index = find_reminder_index(reminders, reminder["id"])
            if index >= 0:
                reminders[index] = reminder
            else:
                reminders.insert(0, reminder)
        clear_ui_state(state)
        for reminder in incoming:
            self.payload_repository.upsert(reminder)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "items": incoming}
