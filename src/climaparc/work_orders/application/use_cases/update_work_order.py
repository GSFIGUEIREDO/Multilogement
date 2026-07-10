from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.work_orders.application.commands import UpdateWorkOrderCommand
from src.climaparc.work_orders.domain.policies import (
    clear_ui_state,
    find_work_order_index,
    normalize_work_order_payload,
    require_can_save_work_order,
)
from src.climaparc.work_orders.domain.repositories import WorkOrderPayloadRepository, WorkOrderStateRepository


class UpdateWorkOrderUseCase:
    def __init__(self, state_repository: WorkOrderStateRepository, payload_repository: WorkOrderPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: UpdateWorkOrderCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        work_order = stamp_payload(normalize_work_order_payload(command.work_order))

        state = self.state_repository.get(lock=False)
        if not state:
            raise ApplicationError("Etat introuvable.")
        work_orders = state.setdefault("workOrders", [])
        if not isinstance(work_orders, list):
            work_orders = []
            state["workOrders"] = work_orders
        index = find_work_order_index(work_orders, work_order["id"])
        if index < 0:
            raise ApplicationError("Bon de travail introuvable.", HTTPStatus.NOT_FOUND)

        require_can_save_work_order(state, command.current_user, work_order)
        work_orders[index] = work_order
        clear_ui_state(state)
        self.payload_repository.upsert(work_order)
        state = self.state_repository.get(lock=False) or state
        clear_ui_state(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": work_order}
