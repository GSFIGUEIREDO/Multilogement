from __future__ import annotations

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.work_orders.application.commands import CompleteApartmentCommand
from src.climaparc.work_orders.domain.completion import activity_is_complete, apartment_activities, now_iso, require_executor, targets_for_order
from src.climaparc.work_orders.domain.repositories import WorkOrderOperationRepository


class CompleteApartmentUseCase:
    def __init__(self, repository: WorkOrderOperationRepository):
        self.repository = repository

    def __call__(self, command: CompleteApartmentCommand) -> dict:
        state = self.repository.get_state() or {}
        order = next((dict(item) for item in state.get("workOrders", []) if isinstance(item, dict) and item.get("id") == command.work_order_id), None)
        if not order:
            raise ApplicationError("Bon de travail introuvable.", 404)
        user = require_executor(state, command.current_user, order)
        activities = apartment_activities(state, order["id"], command.apartment_id)
        if not activities:
            raise ApplicationError("Ajoutez au moins une activite avant de terminer cet appartement.")
        if any(not activity_is_complete(state, item) for item in activities):
            raise ApplicationError("Toutes les activites de l'appartement doivent etre completees.")
        targets = targets_for_order(state, order)
        apartment_targets = [item for item in targets if item.get("apartmentId") == command.apartment_id]
        if not apartment_targets:
            raise ApplicationError("Appartement hors du perimetre du BT.", 403)
        if any(item.get("approvalStatus") == "pending" for item in apartment_targets):
            raise ApplicationError("Cet appartement contient une cible bloquee par une approbation.", 409)
        required_equipment_ids = {item.get("equipmentId") for item in apartment_targets if item.get("equipmentId") and item.get("approvalStatus") != "refused"}
        completed_equipment_ids = {item.get("equipmentId") for item in activities if activity_is_complete(state, item)}
        if not required_equipment_ids.issubset(completed_equipment_ids):
            raise ApplicationError("Chaque machine ciblee doit avoir une activite completee.")
        completed_at = now_iso()
        for target in apartment_targets:
            if target.get("approvalStatus") != "refused":
                target.update({"status": "termine", "completedAt": completed_at, "completedBy": user.get("id") or ""})
        if targets and all(item.get("status") in {"termine", "annule"} for item in targets):
            order.update({"status": "termine", "completedAt": completed_at, "autoClosed": True})
        elif order.get("status") in {"brouillon", "planifie"}:
            order["status"] = "en_cours"
        audit = stamp_payload({"id": f"audit-{order['id']}-{command.apartment_id}-{completed_at}", "workOrderId": order["id"], "apartmentId": command.apartment_id, "action": "complete_apartment", "reason": "", "performedBy": user.get("id") or "", "performedAt": completed_at})
        self.repository.save_completion(stamp_payload(order), [stamp_payload(item) for item in targets], audit)
        fresh = self.repository.get_state() or state
        return {"ok": True, "state": filter_state_for_user(fresh, command.current_user), "workOrder": order, "targets": targets}
