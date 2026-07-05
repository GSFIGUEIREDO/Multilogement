from __future__ import annotations

from http import HTTPStatus

from backend.security import filter_state_for_user
from src.climaparc.reminders.application.commands import DeleteReminderCommand
from src.climaparc.reminders.domain.policies import clear_ui_state, find_reminder_index, require_can_manage_reminders
from src.climaparc.reminders.domain.repositories import ReminderPayloadRepository, ReminderStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class DeleteReminderUseCase:
    def __init__(self, state_repository: ReminderStateRepository, payload_repository: ReminderPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: DeleteReminderCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        require_can_manage_reminders(command.current_user)
        reminder_id = str(command.reminder_id or "").strip()
        if not reminder_id:
            raise ApplicationError("Rappel invalide.")

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        reminders = state.setdefault("reminders", [])
        if not isinstance(reminders, list):
            raise ApplicationError("Rappels introuvables.", HTTPStatus.NOT_FOUND)
        index = find_reminder_index(reminders, reminder_id)
        if index < 0:
            raise ApplicationError("Rappel introuvable.", HTTPStatus.NOT_FOUND)

        reminders.pop(index)
        clear_ui_state(state)
        self.payload_repository.delete(reminder_id)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "deletedReminderId": reminder_id}
