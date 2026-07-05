from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.tickets.application.use_cases.create_ticket import CreateTicketUseCase
from src.climaparc.tickets.application.use_cases.update_ticket import UpdateTicketUseCase
from src.climaparc.tickets.infrastructure.repositories import DatabaseTicketLookupRepository
from src.climaparc.tickets.presentation.dependencies import (
    get_create_ticket_use_case,
    get_session_repository,
    get_ticket_lookup_repository,
    get_update_ticket_use_case,
)
from src.climaparc.tickets.presentation.dispatch import save_ticket_with_use_cases


router = APIRouter()


class SaveTicketRequest(BaseModel):
    ticket: dict | None = None


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/ticket")
def save_ticket(
    request: Request,
    payload: SaveTicketRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    lookup_repository: DatabaseTicketLookupRepository = Depends(get_ticket_lookup_repository),
    create_ticket_use_case: CreateTicketUseCase = Depends(get_create_ticket_use_case),
    update_ticket_use_case: UpdateTicketUseCase = Depends(get_update_ticket_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return save_ticket_with_use_cases(
            current_user,
            payload.ticket,
            lookup_repository,
            create_ticket_use_case,
            update_ticket_use_case,
        )
    except ApplicationError as error:
        raise_http(error)

