from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.reminders.application.commands import SaveReminderCommand
from src.climaparc.reminders.domain.policies import (
    clear_ui_state,
    find_reminder_index,
    normalize_reminder_payload,
    reminder_equipment_exists,
    require_can_manage_reminders,
)
from src.climaparc.reminders.domain.repositories import ReminderPayloadRepository, ReminderStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class SaveReminderUseCase:
    def __init__(self, state_repository: ReminderStateRepository, payload_repository: ReminderPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: SaveReminderCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        require_can_manage_reminders(command.current_user)
        reminder = stamp_payload(normalize_reminder_payload(command.reminder))

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        if not reminder_equipment_exists(state, reminder):
            raise ApplicationError("Machine introuvable.", HTTPStatus.NOT_FOUND)

        reminders = state.setdefault("reminders", [])
        if not isinstance(reminders, list):
            reminders = []
            state["reminders"] = reminders
        index = find_reminder_index(reminders, reminder["id"])
        if index >= 0:
            reminders[index] = reminder
        else:
            reminders.insert(0, reminder)
        clear_ui_state(state)
        self.payload_repository.upsert(reminder)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": reminder}
