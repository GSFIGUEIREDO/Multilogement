from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.settings.application.use_cases.delete_setting_item import DeleteSettingItemUseCase
from src.climaparc.settings.application.use_cases.save_setting_item import SaveSettingItemUseCase
from src.climaparc.settings.presentation.dependencies import (
    get_delete_setting_item_use_case,
    get_save_setting_item_use_case,
    get_session_repository,
)
from src.climaparc.settings.presentation.dispatch import delete_setting_item_with_use_case, save_setting_item_with_use_case
from src.climaparc.shared.domain.errors import ApplicationError


router = APIRouter()


class SaveSettingItemRequest(BaseModel):
    collectionKey: str
    item: dict


class DeleteSettingItemRequest(BaseModel):
    collectionKey: str
    itemId: str


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/setting-item")
def save_setting_item(
    request: Request,
    payload: SaveSettingItemRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    use_case: SaveSettingItemUseCase = Depends(get_save_setting_item_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return save_setting_item_with_use_case(current_user, payload.collectionKey, payload.item, use_case)
    except ApplicationError as error:
        raise_http(error)


@router.post("/api/setting-item-delete")
def delete_setting_item(
    request: Request,
    payload: DeleteSettingItemRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    use_case: DeleteSettingItemUseCase = Depends(get_delete_setting_item_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return delete_setting_item_with_use_case(current_user, payload.collectionKey, payload.itemId, use_case)
    except ApplicationError as error:
        raise_http(error)

