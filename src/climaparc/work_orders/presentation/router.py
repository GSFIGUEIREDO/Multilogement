from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.work_orders.application.use_cases.create_work_order import CreateWorkOrderUseCase
from src.climaparc.work_orders.application.use_cases.update_work_order import UpdateWorkOrderUseCase
from src.climaparc.work_orders.application.use_cases.complete_apartment import CompleteApartmentUseCase
from src.climaparc.work_orders.application.use_cases.close_work_order import CloseWorkOrderUseCase
from src.climaparc.work_orders.application.use_cases.reopen_work_order import ReopenWorkOrderUseCase
from src.climaparc.work_orders.application.commands import CompleteApartmentCommand, CloseWorkOrderCommand, ReopenWorkOrderCommand
from src.climaparc.work_orders.infrastructure.repositories import DatabaseWorkOrderLookupRepository
from src.climaparc.work_orders.presentation.dependencies import (
    get_create_work_order_use_case,
    get_session_repository,
    get_update_work_order_use_case,
    get_work_order_lookup_repository,
    get_complete_apartment_use_case,
    get_close_work_order_use_case,
    get_reopen_work_order_use_case,
)
from src.climaparc.work_orders.presentation.dispatch import save_work_order_with_use_cases


router = APIRouter()


class SaveWorkOrderRequest(BaseModel):
    workOrder: dict | None = None


class CompleteApartmentRequest(BaseModel):
    workOrderId: str
    apartmentId: str


class WorkOrderLifecycleRequest(BaseModel):
    workOrderId: str
    reason: str = ""


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


@router.post("/api/work-order/complete-apartment")
def complete_apartment(request: Request, payload: CompleteApartmentRequest, session_repository: DatabaseSessionRepository = Depends(get_session_repository), use_case: CompleteApartmentUseCase = Depends(get_complete_apartment_use_case)):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return use_case(CompleteApartmentCommand(current_user, payload.workOrderId, payload.apartmentId))
    except ApplicationError as error:
        raise_http(error)


@router.post("/api/work-order/close")
def close_work_order(request: Request, payload: WorkOrderLifecycleRequest, session_repository: DatabaseSessionRepository = Depends(get_session_repository), use_case: CloseWorkOrderUseCase = Depends(get_close_work_order_use_case)):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return use_case(CloseWorkOrderCommand(current_user, payload.workOrderId, payload.reason))
    except ApplicationError as error:
        raise_http(error)


@router.post("/api/work-order/reopen")
def reopen_work_order(request: Request, payload: WorkOrderLifecycleRequest, session_repository: DatabaseSessionRepository = Depends(get_session_repository), use_case: ReopenWorkOrderUseCase = Depends(get_reopen_work_order_use_case)):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return use_case(ReopenWorkOrderCommand(current_user, payload.workOrderId, payload.reason))
    except ApplicationError as error:
        raise_http(error)
