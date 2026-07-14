from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.recommendations.application.commands import CreateReplacementDraftCommand
from src.climaparc.recommendations.domain.policies import recommendation_behavior
from src.climaparc.recommendations.domain.repositories import RecommendationWorkflowRepository


class CreateReplacementDraftUseCase:
    def __init__(self, repository: RecommendationWorkflowRepository):
        self.repository = repository

    def __call__(self, command: CreateReplacementDraftCommand) -> dict:
        state = command.state
        intervention = dict(command.intervention)
        recommendation = dict(intervention.get("recommendation") or {})
        if recommendation.get("workOrderId"):
            return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": intervention}
        if recommendation_behavior(state, recommendation.get("type")) != "replacement":
            self.repository.upsert_intervention(intervention)
            return {"ok": True, "state": filter_state_for_user(self.repository.get_state() or state, command.current_user), "item": intervention}

        replacement_type = next(
            (item for item in state.get("interventionTypes", []) if isinstance(item, dict) and (item.get("behavior") == "replacement" or item.get("id") == "remplacement_unite")),
            {"id": "remplacement_unite", "defaultFormTemplateId": "form_remplacement_unite"},
        )
        apartment = next((item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id") == intervention.get("apartmentId")), None)
        existing_numbers = []
        for item in state.get("workOrders", []):
            match = re.search(r"(\d+)$", str(item.get("number") or "")) if isinstance(item, dict) else None
            if match:
                existing_numbers.append(int(match.group(1)))
        year = datetime.now(timezone.utc).year
        order = stamp_payload({
            "id": f"wo-{uuid.uuid4().hex[:12]}",
            "number": f"BT-{year}-{max(existing_numbers, default=0) + 1:03d}",
            "ticketId": None,
            "scope": "equipment",
            "buildingId": apartment.get("buildingId") if apartment else "",
            "apartmentId": intervention.get("apartmentId") or "",
            "equipmentId": intervention.get("equipmentId") or "",
            "typeId": replacement_type.get("id") or "remplacement_unite",
            "formTemplateId": replacement_type.get("defaultFormTemplateId") or "form_remplacement_unite",
            "technicianId": "",
            "assignedTechnicianIds": [],
            "scheduledDate": "",
            "status": "brouillon",
            "sourceRecommendationInterventionId": intervention.get("id"),
            "priority": recommendation.get("priority") or "normale",
            "approvedPrice": recommendation.get("price") or "",
            "approvedDelay": recommendation.get("delay") or recommendation.get("time") or "",
            "requiredPart": recommendation.get("part") or "",
            "notes": f"Recommandation approuvee: {recommendation.get('description') or ''}".strip(),
        })
        recommendation["workOrderId"] = order["id"]
        recommendation["workOrderCreatedAt"] = datetime.now(timezone.utc).date().isoformat()
        intervention["recommendation"] = recommendation
        intervention = stamp_payload(intervention)
        self.repository.save_approval_with_work_order(intervention, order)
        fresh_state = self.repository.get_state() or state
        return {"ok": True, "state": filter_state_for_user(fresh_state, command.current_user), "item": intervention, "workOrder": order}
