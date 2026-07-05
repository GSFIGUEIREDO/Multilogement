from __future__ import annotations

from src.climaparc.work_orders.application.commands import CreateWorkOrderCommand, UpdateWorkOrderCommand
from src.climaparc.work_orders.application.use_cases.create_work_order import CreateWorkOrderUseCase
from src.climaparc.work_orders.application.use_cases.update_work_order import UpdateWorkOrderUseCase
from src.climaparc.work_orders.infrastructure.repositories import DatabaseWorkOrderLookupRepository


def save_work_order_with_use_cases(
    current_user: dict,
    work_order_payload: dict | None,
    lookup_repository: DatabaseWorkOrderLookupRepository,
    create_work_order_use_case: CreateWorkOrderUseCase,
    update_work_order_use_case: UpdateWorkOrderUseCase,
) -> dict:
    work_order = work_order_payload or {}
    work_order_id = str(work_order.get("id") or "") if isinstance(work_order, dict) else ""
    if work_order_id and lookup_repository.exists(work_order_id):
        return update_work_order_use_case(UpdateWorkOrderCommand(current_user, work_order))
    return create_work_order_use_case(CreateWorkOrderCommand(current_user, work_order))

