from __future__ import annotations

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.work_orders.application.commands import ReopenWorkOrderCommand
from src.climaparc.work_orders.domain.completion import now_iso, require_executor, targets_for_order
from src.climaparc.work_orders.domain.repositories import WorkOrderOperationRepository


class ReopenWorkOrderUseCase:
    def __init__(self, repository: WorkOrderOperationRepository):
        self.repository = repository

    def __call__(self, command: ReopenWorkOrderCommand) -> dict:
        state = self.repository.get_state() or {}
        order = next((dict(item) for item in state.get("workOrders", []) if isinstance(item, dict) and item.get("id") == command.work_order_id), None)
        if not order:
            raise ApplicationError("Bon de travail introuvable.", 404)
        user = require_executor(state, command.current_user, order, internal_only=True)
        reason = str(command.reason or "").strip()
        if not reason:
            raise ApplicationError("Motif de reouverture obligatoire.")
        performed_at = now_iso()
        order.update({"status": "en_cours", "completedAt": "", "reopenedAt": performed_at, "forcedCloseReason": ""})
        targets = targets_for_order(state, order)
        audit = stamp_payload({"id": f"audit-{order['id']}-reopen-{performed_at}", "workOrderId": order["id"], "apartmentId": "", "action": "reopen", "reason": reason, "performedBy": user.get("id") or "", "performedAt": performed_at})
        self.repository.save_completion(stamp_payload(order), [stamp_payload(item) for item in targets], audit)
        return {"ok": True, "state": filter_state_for_user(self.repository.get_state() or state, command.current_user), "workOrder": order}
