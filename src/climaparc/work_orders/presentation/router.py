from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.work_orders.application.use_cases.create_work_order import CreateWorkOrderUseCase
from src.climaparc.work_orders.application.use_cases.update_work_order import UpdateWorkOrderUseCase
from src.climaparc.work_orders.infrastructure.repositories import DatabaseWorkOrderLookupRepository
from src.climaparc.work_orders.presentation.dependencies import (
    get_create_work_order_use_case,
    get_session_repository,
    get_update_work_order_use_case,
    get_work_order_lookup_repository,
)
from src.climaparc.work_orders.presentation.dispatch import save_work_order_with_use_cases


router = APIRouter()


class SaveWorkOrderRequest(BaseModel):
    workOrder: dict | None = None


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/work-order")
def save_work_order(
    request: Request,
    payload: SaveWorkOrderRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    lookup_repository: DatabaseWorkOrderLookupRepository = Depends(get_work_order_lookup_repository),
    create_work_order_use_case: CreateWorkOrderUseCase = Depends(get_create_work_order_use_case),
    update_work_order_use_case: UpdateWorkOrderUseCase = Depends(get_update_work_order_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return save_work_order_with_use_cases(
            current_user,
            payload.workOrder,
            lookup_repository,
            create_work_order_use_case,
            update_work_order_use_case,
        )
    except ApplicationError as error:
        raise_http(error)

