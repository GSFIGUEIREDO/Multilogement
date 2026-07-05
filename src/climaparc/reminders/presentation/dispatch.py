from __future__ import annotations

from src.climaparc.reminders.application.commands import DeleteReminderCommand, SaveReminderBatchCommand, SaveReminderCommand
from src.climaparc.reminders.application.use_cases.delete_reminder import DeleteReminderUseCase
from src.climaparc.reminders.application.use_cases.save_reminder import SaveReminderUseCase
from src.climaparc.reminders.application.use_cases.save_reminder_batch import SaveReminderBatchUseCase


def save_reminder_with_use_case(current_user: dict, reminder: dict | None, use_case: SaveReminderUseCase) -> dict:
    return use_case(SaveReminderCommand(current_user, reminder or {}))


def save_reminder_batch_with_use_case(current_user: dict, reminders: list[dict] | None, use_case: SaveReminderBatchUseCase) -> dict:
    return use_case(SaveReminderBatchCommand(current_user, reminders or []))


def delete_reminder_with_use_case(current_user: dict, reminder_id: str, use_case: DeleteReminderUseCase) -> dict:
    return use_case(DeleteReminderCommand(current_user, reminder_id))
