from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.interventions.application.use_cases.create_intervention import CreateInterventionUseCase
from src.climaparc.interventions.application.use_cases.update_intervention import UpdateInterventionUseCase
from src.climaparc.interventions.infrastructure.repositories import DatabaseInterventionLookupRepository
from src.climaparc.interventions.presentation.dependencies import (
    get_create_intervention_use_case,
    get_intervention_lookup_repository,
    get_session_repository,
    get_update_intervention_use_case,
)
from src.climaparc.interventions.presentation.dispatch import save_intervention_with_use_cases
from src.climaparc.shared.domain.errors import ApplicationError


router = APIRouter()


class SaveInterventionRequest(BaseModel):
    intervention: dict | None = None


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/intervention")
def save_intervention(
    request: Request,
    payload: SaveInterventionRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    lookup_repository: DatabaseInterventionLookupRepository = Depends(get_intervention_lookup_repository),
    create_intervention_use_case: CreateInterventionUseCase = Depends(get_create_intervention_use_case),
    update_intervention_use_case: UpdateInterventionUseCase = Depends(get_update_intervention_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return save_intervention_with_use_cases(
            current_user,
            payload.intervention,
            lookup_repository,
            create_intervention_use_case,
            update_intervention_use_case,
        )
    except ApplicationError as error:
        raise_http(error)
