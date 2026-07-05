from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.users.application.commands import DeleteUserCommand
from src.climaparc.users.application.use_cases.create_user import CreateUserUseCase
from src.climaparc.users.application.use_cases.delete_user import DeleteUserUseCase
from src.climaparc.users.application.use_cases.update_user import UpdateUserUseCase
from src.climaparc.users.infrastructure.repositories import DatabaseUserLookupRepository
from src.climaparc.users.presentation.dependencies import (
    get_create_user_use_case,
    get_delete_user_use_case,
    get_session_repository,
    get_update_user_use_case,
    get_user_lookup_repository,
)
from src.climaparc.users.presentation.dispatch import save_user_with_use_cases


router = APIRouter()


class SaveUserRequest(BaseModel):
    user: dict | None = None


class DeleteUserRequest(BaseModel):
    userId: str = ""


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/user")
def save_user(
    request: Request,
    payload: SaveUserRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    lookup_repository: DatabaseUserLookupRepository = Depends(get_user_lookup_repository),
    create_user_use_case: CreateUserUseCase = Depends(get_create_user_use_case),
    update_user_use_case: UpdateUserUseCase = Depends(get_update_user_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return save_user_with_use_cases(
            current_user,
            payload.user,
            lookup_repository,
            create_user_use_case,
            update_user_use_case,
        )
    except ApplicationError as error:
        raise_http(error)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))


@router.post("/api/user-delete")
def delete_user(
    request: Request,
    payload: DeleteUserRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    delete_user_use_case: DeleteUserUseCase = Depends(get_delete_user_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return delete_user_use_case(DeleteUserCommand(current_user, payload.userId))
    except ApplicationError as error:
        raise_http(error)
