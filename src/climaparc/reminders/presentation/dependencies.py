from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.reminders.application.use_cases.delete_reminder import DeleteReminderUseCase
from src.climaparc.reminders.application.use_cases.save_reminder import SaveReminderUseCase
from src.climaparc.reminders.application.use_cases.save_reminder_batch import SaveReminderBatchUseCase
from src.climaparc.reminders.infrastructure.repositories import DatabaseReminderPayloadRepository, DatabaseReminderStateRepository


def get_reminder_state_repository() -> DatabaseReminderStateRepository:
    return DatabaseReminderStateRepository()


def get_reminder_payload_repository() -> DatabaseReminderPayloadRepository:
    return DatabaseReminderPayloadRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_save_reminder_use_case() -> SaveReminderUseCase:
    return SaveReminderUseCase(get_reminder_state_repository(), get_reminder_payload_repository())


def get_save_reminder_batch_use_case() -> SaveReminderBatchUseCase:
    return SaveReminderBatchUseCase(get_reminder_state_repository(), get_reminder_payload_repository())


def get_delete_reminder_use_case() -> DeleteReminderUseCase:
    return DeleteReminderUseCase(get_reminder_state_repository(), get_reminder_payload_repository())
