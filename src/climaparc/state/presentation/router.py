from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.state.application.commands import SaveStateCommand
from src.climaparc.state.application.use_cases.save_state import SaveStateUseCase
from src.climaparc.state.presentation.dependencies import get_save_state_use_case, get_session_repository


router = APIRouter()


class SaveStateRequest(BaseModel):
    state: dict | None = None
    changes: dict | None = None


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/state")
def save_state(
    request: Request,
    payload: SaveStateRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    use_case: SaveStateUseCase = Depends(get_save_state_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return use_case(SaveStateCommand(current_user, payload.state, payload.changes))
    except ApplicationError as error:
        raise HTTPException(status_code=int(error.status), detail=error.message)

