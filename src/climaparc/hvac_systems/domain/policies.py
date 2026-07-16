from __future__ import annotations

from backend.security import order_assigned_to_user, requester_from_state
from src.climaparc.shared.domain.errors import ApplicationError


def normalize_hvac_system(state: dict, payload: dict) -> dict:
    if not isinstance(payload, dict) or not payload.get("id") or not payload.get("apartmentId"):
        raise ApplicationError("Systeme HVAC invalide.")
    apartment = next((item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id") == payload.get("apartmentId")), None)
    building = next((item for item in state.get("buildings", []) if isinstance(item, dict) and item.get("id") == (apartment or {}).get("buildingId")), None)
    if not apartment or not building:
        raise ApplicationError("Appartement introuvable.", 404)
    item = dict(payload)
    item["buildingId"] = building.get("id")
    item["clientId"] = building.get("clientId") or ""
    item["name"] = str(item.get("name") or "Systeme HVAC").strip()
    item["active"] = item.get("active") is not False
    return item


def require_can_manage_hvac_system(state: dict, current_user: object, system: dict, work_order_id: str) -> None:
    user = requester_from_state(state, current_user)
    if user.get("role") in {"administrateur", "equipe_interne"}:
        return
    order = next((item for item in state.get("workOrders", []) if isinstance(item, dict) and item.get("id") == work_order_id), None)
    order_equipment = next((item for item in state.get("equipment", []) if isinstance(item, dict) and item.get("id") == (order or {}).get("equipmentId")), None)
    order_apartment = next((item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id") == (order_equipment or {}).get("apartmentId")), None)
    order_building_id = (order or {}).get("buildingId") or (order_equipment or {}).get("homeBuildingId") or (order_apartment or {}).get("buildingId")
    if user.get("role") == "technicien" and order and order_assigned_to_user(order, user.get("id")) and order_building_id == system.get("buildingId"):
        return
    raise ApplicationError("Droits insuffisants.", 403)
