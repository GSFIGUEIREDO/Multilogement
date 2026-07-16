from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from http import HTTPStatus

from backend.database import row_get
from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.recommendations.application.commands import RouteRecommendationCommand
from src.climaparc.recommendations.domain.policies import recommendation_behavior
from src.climaparc.recommendations.domain.repositories import RecommendationWorkflowRepository
from src.climaparc.shared.domain.errors import ApplicationError


class RouteRecommendationUseCase:
    def __init__(self, repository: RecommendationWorkflowRepository):
        self.repository = repository

    def __call__(self, command: RouteRecommendationCommand) -> dict:
        role = row_get(command.current_user, "role") if command.current_user else None
        if role not in {"administrateur", "equipe_interne"}:
            raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)
        if command.mode not in {"new", "existing"}:
            raise ApplicationError("Destination du BT invalide.")

        state = self.repository.get_state() or {}
        intervention = next((item for item in state.get("interventions", []) if item.get("id") == command.intervention_id), None)
        if not intervention or not isinstance(intervention.get("recommendation"), dict):
            raise ApplicationError("Recommandation introuvable.", HTTPStatus.NOT_FOUND)
        recommendation = dict(intervention["recommendation"])
        apartment = next((item for item in state.get("apartments", []) if item.get("id") == intervention.get("apartmentId")), None)
        equipment = next((item for item in state.get("equipment", []) if item.get("id") == intervention.get("equipmentId")), None)
        building_id = (apartment or {}).get("buildingId") or (equipment or {}).get("homeBuildingId") or ""
        if not building_id:
            raise ApplicationError("Lieu de la recommandation introuvable.")

        existing_target = next(
            (item for item in state.get("workOrderTargets", []) if item.get("sourceRecommendationId") == command.intervention_id),
            None,
        )
        if existing_target:
            order = next((item for item in state.get("workOrders", []) if item.get("id") == existing_target.get("workOrderId")), None)
            return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": intervention, "workOrder": order, "target": existing_target}

        activity_type = self._activity_type(state, intervention, recommendation)
        if command.mode == "existing":
            order = next((item for item in state.get("workOrders", []) if item.get("id") == command.work_order_id), None)
            if not order:
                raise ApplicationError("Bon de travail introuvable.", HTTPStatus.NOT_FOUND)
            order_building_id = order.get("buildingId")
            if not order_building_id and order.get("equipmentId"):
                order_equipment = next((item for item in state.get("equipment", []) if item.get("id") == order.get("equipmentId")), None)
                order_building_id = (order_equipment or {}).get("homeBuildingId")
            if order_building_id != building_id:
                raise ApplicationError("Les recommandations peuvent seulement etre regroupees dans le meme lieu.", HTTPStatus.CONFLICT)
        else:
            order = stamp_payload({
                "id": f"wo-{uuid.uuid4().hex[:12]}",
                "number": self._next_number(state),
                "ticketId": None,
                "scope": "equipment",
                "buildingId": building_id,
                "apartmentId": intervention.get("apartmentId") or "",
                "equipmentId": intervention.get("equipmentId") or "",
                "typeId": activity_type.get("id") or "",
                "defaultActivityTypeId": activity_type.get("id") or "",
                "formTemplateId": activity_type.get("defaultFormTemplateId") or "",
                "object": f"Suivi de recommandation - {recommendation.get('description') or 'Intervention'}",
                "technicianId": "",
                "assignedTechnicianIds": [],
                "scheduledDate": "",
                "status": "brouillon",
                "priority": recommendation.get("priority") or "normale",
                "approvedPrice": recommendation.get("price") or "",
                "approvedDelay": recommendation.get("delay") or recommendation.get("time") or "",
                "requiredPart": recommendation.get("part") or "",
                "notes": recommendation.get("description") or "",
            })

        requires_approval = recommendation.get("requiresClientApproval") is not False
        status = recommendation.get("status")
        approval_status = "not_required" if not requires_approval else "approved" if status == "approuvee" else "refused" if status == "refusee" else "pending"
        target = stamp_payload({
            "id": f"target-{uuid.uuid4().hex[:12]}",
            "workOrderId": order["id"],
            "buildingId": building_id,
            "apartmentId": intervention.get("apartmentId") or "",
            "equipmentId": intervention.get("equipmentId") or "",
            "activityTypeId": activity_type.get("id") or intervention.get("typeId") or "",
            "status": "annule" if approval_status == "refused" else "a_faire",
            "approvalStatus": approval_status,
            "sourceRecommendationId": command.intervention_id,
            "completedAt": "",
        })
        work_order_ids = list(dict.fromkeys([*(recommendation.get("workOrderIds") or []), order["id"]]))
        recommendation["workOrderIds"] = work_order_ids
        recommendation["workOrderId"] = recommendation.get("workOrderId") or order["id"]
        intervention = stamp_payload({**intervention, "recommendation": recommendation})
        self.repository.save_route(intervention, order, target)
        fresh = self.repository.get_state() or state
        return {"ok": True, "state": filter_state_for_user(fresh, command.current_user), "item": intervention, "workOrder": order, "target": target}

    @staticmethod
    def _next_number(state: dict) -> str:
        values = []
        for item in state.get("workOrders", []):
            match = re.search(r"(\d+)$", str(item.get("number") or ""))
            if match:
                values.append(int(match.group(1)))
        return f"BT-{datetime.now(timezone.utc).year}-{max(values, default=0) + 1:03d}"

    @staticmethod
    def _activity_type(state: dict, intervention: dict, recommendation: dict) -> dict:
        behavior = recommendation_behavior(state, recommendation.get("type"))
        if behavior == "replacement":
            return next((item for item in state.get("interventionTypes", []) if item.get("behavior") == "replacement" or item.get("id") == "remplacement_unite"), {})
        return next((item for item in state.get("interventionTypes", []) if item.get("id") == intervention.get("typeId")), {})
