from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.work_orders.application.use_cases.create_work_order import CreateWorkOrderUseCase
from src.climaparc.work_orders.application.use_cases.update_work_order import UpdateWorkOrderUseCase
from src.climaparc.work_orders.infrastructure.repositories import (
    DatabaseWorkOrderLookupRepository,
    DatabaseWorkOrderPayloadRepository,
    DatabaseWorkOrderStateRepository,
)


def get_work_order_state_repository() -> DatabaseWorkOrderStateRepository:
    return DatabaseWorkOrderStateRepository()


def get_work_order_payload_repository() -> DatabaseWorkOrderPayloadRepository:
    return DatabaseWorkOrderPayloadRepository()


def get_work_order_lookup_repository() -> DatabaseWorkOrderLookupRepository:
    return DatabaseWorkOrderLookupRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_create_work_order_use_case() -> CreateWorkOrderUseCase:
    return CreateWorkOrderUseCase(get_work_order_state_repository(), get_work_order_payload_repository())


def get_update_work_order_use_case() -> UpdateWorkOrderUseCase:
    return UpdateWorkOrderUseCase(get_work_order_state_repository(), get_work_order_payload_repository())

