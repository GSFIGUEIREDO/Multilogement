from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.hvac_systems.application.commands import CreateHvacSystemCommand
from src.climaparc.hvac_systems.application.use_cases.create_hvac_system import CreateHvacSystemUseCase
from src.climaparc.hvac_systems.presentation.dependencies import get_create_hvac_system_use_case, get_session_repository
from src.climaparc.shared.domain.errors import ApplicationError


router = APIRouter()


class HvacSystemRequest(BaseModel):
    system: dict
    workOrderId: str = ""


@router.post("/api/hvac-system")
def create_hvac_system(request: Request, payload: HvacSystemRequest, session_repository: DatabaseSessionRepository = Depends(get_session_repository), use_case: CreateHvacSystemUseCase = Depends(get_create_hvac_system_use_case)):
    token = request.cookies.get(SESSION_COOKIE)
    current_user = session_repository.get_user_by_token(token or "") if token else None
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return use_case(CreateHvacSystemCommand(current_user, payload.system, payload.workOrderId))
    except ApplicationError as error:
        raise HTTPException(status_code=int(error.status), detail=error.message) from None
