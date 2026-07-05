from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.equipment.application.use_cases.create_equipment import CreateEquipmentUseCase
from src.climaparc.equipment.application.use_cases.update_equipment import UpdateEquipmentUseCase
from src.climaparc.equipment.infrastructure.repositories import DatabaseEquipmentLookupRepository
from src.climaparc.equipment.presentation.dependencies import (
    get_create_equipment_use_case,
    get_equipment_lookup_repository,
    get_session_repository,
    get_update_equipment_use_case,
)
from src.climaparc.equipment.presentation.dispatch import save_equipment_with_use_cases
from src.climaparc.shared.domain.errors import ApplicationError


router = APIRouter()


class SaveEquipmentRequest(BaseModel):
    equipment: dict | None = None


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/equipment")
def save_equipment(
    request: Request,
    payload: SaveEquipmentRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    lookup_repository: DatabaseEquipmentLookupRepository = Depends(get_equipment_lookup_repository),
    create_equipment_use_case: CreateEquipmentUseCase = Depends(get_create_equipment_use_case),
    update_equipment_use_case: UpdateEquipmentUseCase = Depends(get_update_equipment_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return save_equipment_with_use_cases(
            current_user,
            payload.equipment,
            lookup_repository,
            create_equipment_use_case,
            update_equipment_use_case,
        )
    except ApplicationError as error:
        raise_http(error)

