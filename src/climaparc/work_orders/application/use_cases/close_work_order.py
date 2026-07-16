from __future__ import annotations

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.work_orders.application.commands import CloseWorkOrderCommand
from src.climaparc.work_orders.domain.completion import now_iso, require_executor, targets_for_order
from src.climaparc.work_orders.domain.repositories import WorkOrderOperationRepository


class CloseWorkOrderUseCase:
    def __init__(self, repository: WorkOrderOperationRepository):
        self.repository = repository

    def __call__(self, command: CloseWorkOrderCommand) -> dict:
        state = self.repository.get_state() or {}
        order = next((dict(item) for item in state.get("workOrders", []) if isinstance(item, dict) and item.get("id") == command.work_order_id), None)
        if not order:
            raise ApplicationError("Bon de travail introuvable.", 404)
        user = require_executor(state, command.current_user, order, internal_only=True)
        targets = targets_for_order(state, order)
        incomplete = any(item.get("status") not in {"termine", "annule"} for item in targets)
        reason = str(command.reason or "").strip()
        if incomplete and not reason:
            raise ApplicationError("Un motif est obligatoire pour une cloture forcee.")
        performed_at = now_iso()
        order.update({"status": "termine", "completedAt": performed_at, "forcedCloseReason": reason, "autoClosed": False})
        audit = stamp_payload({"id": f"audit-{order['id']}-close-{performed_at}", "workOrderId": order["id"], "apartmentId": "", "action": "force_close" if incomplete else "close", "reason": reason, "performedBy": user.get("id") or "", "performedAt": performed_at})
        self.repository.save_completion(stamp_payload(order), [stamp_payload(item) for item in targets], audit)
        return {"ok": True, "state": filter_state_for_user(self.repository.get_state() or state, command.current_user), "workOrder": order}
