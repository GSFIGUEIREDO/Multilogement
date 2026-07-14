from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.field_operations.application.commands import SaveFieldInterventionCommand
from src.climaparc.field_operations.application.use_cases.save_field_intervention import SaveFieldInterventionUseCase
from src.climaparc.field_operations.presentation.dependencies import get_save_field_intervention_use_case, get_session_repository
from src.climaparc.shared.domain.errors import ApplicationError


router = APIRouter()


class SaveFieldInterventionRequest(BaseModel):
    apartment: dict | None = None
    equipment: dict
    intervention: dict
    workOrder: dict
    replacement: dict | None = None


@router.post("/api/field-intervention")
def save_field_intervention(
    request: Request,
    payload: SaveFieldInterventionRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    use_case: SaveFieldInterventionUseCase = Depends(get_save_field_intervention_use_case),
):
    token = request.cookies.get(SESSION_COOKIE)
    current_user = session_repository.get_user_by_token(token or "") if token else None
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return use_case(SaveFieldInterventionCommand(current_user, payload.apartment, payload.equipment, payload.intervention, payload.workOrder, payload.replacement))
    except ApplicationError as error:
        raise HTTPException(status_code=int(error.status), detail=error.message) from None
