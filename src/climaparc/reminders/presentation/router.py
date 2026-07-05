from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.reminders.application.use_cases.delete_reminder import DeleteReminderUseCase
from src.climaparc.reminders.application.use_cases.save_reminder import SaveReminderUseCase
from src.climaparc.reminders.application.use_cases.save_reminder_batch import SaveReminderBatchUseCase
from src.climaparc.reminders.presentation.dependencies import (
    get_delete_reminder_use_case,
    get_save_reminder_batch_use_case,
    get_save_reminder_use_case,
    get_session_repository,
)
from src.climaparc.reminders.presentation.dispatch import (
    delete_reminder_with_use_case,
    save_reminder_batch_with_use_case,
    save_reminder_with_use_case,
)
from src.climaparc.shared.domain.errors import ApplicationError


router = APIRouter()


class SaveReminderRequest(BaseModel):
    reminder: dict | None = None
    reminders: list[dict] | None = None


class DeleteReminderRequest(BaseModel):
    reminderId: str = ""


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/reminder")
def save_reminder(
    request: Request,
    payload: SaveReminderRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    save_use_case: SaveReminderUseCase = Depends(get_save_reminder_use_case),
    batch_use_case: SaveReminderBatchUseCase = Depends(get_save_reminder_batch_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        if payload.reminders:
            return save_reminder_batch_with_use_case(current_user, payload.reminders, batch_use_case)
        return save_reminder_with_use_case(current_user, payload.reminder, save_use_case)
    except ApplicationError as error:
        raise_http(error)


@router.post("/api/reminder-delete")
def delete_reminder(
    request: Request,
    payload: DeleteReminderRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    use_case: DeleteReminderUseCase = Depends(get_delete_reminder_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return delete_reminder_with_use_case(current_user, payload.reminderId, use_case)
    except ApplicationError as error:
        raise_http(error)
