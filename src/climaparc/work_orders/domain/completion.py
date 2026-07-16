from __future__ import annotations

from datetime import datetime, timezone

from backend.security import order_assigned_to_user, requester_from_state
from src.climaparc.shared.domain.errors import ApplicationError


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_executor(state: dict, current_user: object, order: dict, internal_only: bool = False) -> dict:
    user = requester_from_state(state, current_user)
    if user.get("role") in {"administrateur", "equipe_interne"}:
        return user
    if internal_only or user.get("role") != "technicien" or not order_assigned_to_user(order, user.get("id")):
        raise ApplicationError("Droits insuffisants.", 403)
    return user


def targets_for_order(state: dict, order: dict) -> list[dict]:
    targets = [
        dict(item) for item in state.get("workOrderTargets", [])
        if isinstance(item, dict) and item.get("workOrderId") == order.get("id")
    ]
    if targets:
        return targets
    apartment_ids: list[str] = []
    if order.get("buildingId"):
        apartment_ids = [
            str(item.get("id")) for item in state.get("apartments", [])
            if isinstance(item, dict) and item.get("buildingId") == order.get("buildingId") and item.get("id")
        ]
    elif order.get("equipmentId"):
        equipment = next((item for item in state.get("equipment", []) if isinstance(item, dict) and item.get("id") == order.get("equipmentId")), None)
        if equipment and equipment.get("apartmentId"):
            apartment_ids = [str(equipment.get("apartmentId"))]
    elif order.get("apartmentId"):
        apartment_ids = [str(order.get("apartmentId"))]
    return [
        {
            "id": f"target-{order['id']}-{apartment_id}",
            "workOrderId": order["id"],
            "buildingId": order.get("buildingId") or "",
            "apartmentId": apartment_id,
            "equipmentId": "",
            "activityTypeId": order.get("defaultActivityTypeId") or order.get("typeId") or "",
            "status": "a_faire",
            "approvalStatus": "not_required",
            "sourceRecommendationId": "",
            "completedAt": "",
        }
        for apartment_id in apartment_ids
    ]


def apartment_activities(state: dict, order_id: str, apartment_id: str) -> list[dict]:
    equipment_apartments = {
        item.get("id"): item.get("apartmentId")
        for item in state.get("equipment", []) if isinstance(item, dict)
    }
    return [
        item for item in state.get("interventions", [])
        if isinstance(item, dict)
        and item.get("workOrderId") == order_id
        and (item.get("apartmentId") or equipment_apartments.get(item.get("equipmentId"))) == apartment_id
    ]


def activity_is_complete(state: dict, intervention: dict) -> bool:
    value = intervention.get("activityStatus")
    field = next((item for item in state.get("dataFields", []) if isinstance(item, dict) and item.get("id") == "activity_status"), None)
    option = next((item for item in (field or {}).get("options", []) if isinstance(item, dict) and item.get("value") == value), None)
    behavior = (option or {}).get("behavior")
    return behavior == "completed" or value in {"completee", "completed"}
