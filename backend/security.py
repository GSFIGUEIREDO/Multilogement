from __future__ import annotations

import copy
from typing import Any

from .database import row_get


PUBLIC_USER_KEYS = {
    "id",
    "name",
    "email",
    "role",
    "clientId",
    "clientAccessLevel",
    "allowedBuildingIds",
    "portalRights",
    "parentUserId",
    "updatedAt",
    "serverUpdatedAt",
}

COLLECTION_KEYS = {
    "users",
    "clients",
    "buildings",
    "apartments",
    "equipment",
    "tickets",
    "workOrders",
    "interventions",
    "reminders",
    "clientDocuments",
    "serviceTypes",
    "interventionTypes",
    "formTemplates",
    "roleDefinitions",
    "dataFields",
    "passwordResetRequests",
}

CONFIG_KEYS = {
    "serviceTypes",
    "interventionTypes",
    "formTemplates",
    "roleDefinitions",
    "dataFields",
}

CLIENT_RIGHT_DEFAULTS = {
    "direction": ["portal", "lieux", "equipment", "tickets", "workorders", "recommendations", "documents", "reports", "alerts", "users", "prices", "approve_recommendations"],
    "gestionnaire": ["portal", "lieux", "equipment", "tickets", "workorders", "recommendations", "documents", "reports", "alerts"],
    "maintenance": ["portal", "lieux", "equipment", "tickets", "workorders", "documents", "alerts"],
}


class AuthorizationError(Exception):
    pass


def safe_row_get(row: Any, key: str) -> Any:
    if not row:
        return None
    try:
        return row_get(row, key)
    except Exception:
        if isinstance(row, dict):
            return row.get(key)
    return None


def public_user(user: dict | None) -> dict:
    if not isinstance(user, dict):
        return {}
    return {key: copy.deepcopy(value) for key, value in user.items() if key in PUBLIC_USER_KEYS}


def public_user_from_row(row: Any) -> dict:
    return {
        "id": safe_row_get(row, "id"),
        "email": safe_row_get(row, "email"),
        "name": safe_row_get(row, "name"),
        "role": safe_row_get(row, "role"),
        "clientId": safe_row_get(row, "client_id"),
    }


def sanitize_state_for_storage(state: dict | None) -> dict:
    clean = copy.deepcopy(state or {})
    users = clean.get("users")
    if isinstance(users, list):
        clean["users"] = [public_user(user) for user in users if isinstance(user, dict)]
    resets = clean.get("passwordResetRequests")
    if isinstance(resets, list):
        clean["passwordResetRequests"] = [
            {key: value for key, value in item.items() if key not in {"tokenHash", "token", "password"}}
            for item in resets
            if isinstance(item, dict)
        ]
    clean["sessionUserId"] = None
    clean["modal"] = None
    clean["toast"] = ""
    return clean


def requester_from_state(state: dict, current_user_row: Any) -> dict:
    requester_id = safe_row_get(current_user_row, "id")
    users = state.get("users", [])
    if isinstance(users, list):
        user = next((item for item in users if isinstance(item, dict) and item.get("id") == requester_id), None)
        if user:
            return public_user(user)
    return public_user_from_row(current_user_row)


def client_rights(user: dict) -> set[str]:
    explicit = user.get("portalRights")
    if isinstance(explicit, list) and explicit:
        return set(str(item) for item in explicit)
    return set(CLIENT_RIGHT_DEFAULTS.get(user.get("clientAccessLevel") or "direction", CLIENT_RIGHT_DEFAULTS["gestionnaire"]))


def has_client_right(user: dict, right: str) -> bool:
    if user.get("role") != "client":
        return True
    rights = client_rights(user)
    return "portal" in rights and right in rights


def client_building_scope(state: dict, user: dict) -> set[str]:
    client_id = user.get("clientId")
    all_ids = {
        building.get("id")
        for building in state.get("buildings", [])
        if isinstance(building, dict) and building.get("clientId") == client_id
    }
    explicit = user.get("allowedBuildingIds")
    if isinstance(explicit, list) and explicit:
        return {building_id for building_id in explicit if building_id in all_ids}
    return all_ids


def equipment_scope_for_buildings(state: dict, building_ids: set[str]) -> tuple[set[str], set[str]]:
    apartment_ids = {
        apartment.get("id")
        for apartment in state.get("apartments", [])
        if isinstance(apartment, dict) and apartment.get("buildingId") in building_ids
    }
    equipment_ids = {
        equipment.get("id")
        for equipment in state.get("equipment", [])
        if isinstance(equipment, dict) and equipment.get("apartmentId") in apartment_ids
    }
    return apartment_ids, equipment_ids


def order_assigned_to_user(order: dict, user_id: str | None) -> bool:
    if not user_id:
        return False
    assigned = set(str(item) for item in order.get("assignedTechnicianIds", []) if item)
    if order.get("technicianId"):
        assigned.add(str(order.get("technicianId")))
    return str(user_id) in assigned


def technician_scopes(state: dict, user: dict) -> tuple[set[str], set[str], set[str], set[str]]:
    work_order_ids: set[str] = set()
    building_ids: set[str] = set()
    equipment_ids: set[str] = set()
    apartment_ids: set[str] = set()
    for order in state.get("workOrders", []):
        if not isinstance(order, dict) or not order_assigned_to_user(order, user.get("id")):
            continue
        work_order_ids.add(order.get("id"))
        if order.get("buildingId"):
            building_ids.add(order.get("buildingId"))
        if order.get("equipmentId"):
            equipment_ids.add(order.get("equipmentId"))
    extra_apartment_ids, extra_equipment_ids = equipment_scope_for_buildings(state, building_ids)
    apartment_ids.update(extra_apartment_ids)
    equipment_ids.update(extra_equipment_ids)
    for equipment in state.get("equipment", []):
        if isinstance(equipment, dict) and equipment.get("id") in equipment_ids and equipment.get("apartmentId"):
            apartment_ids.add(equipment.get("apartmentId"))
    for apartment in state.get("apartments", []):
        if isinstance(apartment, dict) and apartment.get("id") in apartment_ids and apartment.get("buildingId"):
            building_ids.add(apartment.get("buildingId"))
    return work_order_ids, building_ids, apartment_ids, equipment_ids


def empty_response_state(state: dict) -> dict:
    response = copy.deepcopy(state)
    for key in COLLECTION_KEYS:
        response[key] = []
    for key in CONFIG_KEYS:
        response[key] = copy.deepcopy(state.get(key, []))
    response["sessionUserId"] = None
    response["modal"] = None
    response["toast"] = ""
    return response


def filter_state_for_user(state: dict | None, current_user_row: Any) -> dict:
    clean = sanitize_state_for_storage(state)
    user = requester_from_state(clean, current_user_row)
    role = user.get("role")
    if role in {"administrateur", "equipe_interne"}:
        return clean

    response = empty_response_state(clean)
    if not user.get("id"):
        return response

    if role == "client":
        client_id = user.get("clientId")
        building_ids = client_building_scope(clean, user)
        apartment_ids, equipment_ids = equipment_scope_for_buildings(clean, building_ids)
        visible_ticket_ids = {
            item.get("id")
            for item in clean.get("tickets", [])
            if isinstance(item, dict)
            and (
                item.get("clientId") == client_id
                or item.get("buildingId") in building_ids
                or item.get("apartmentId") in apartment_ids
                or item.get("equipmentId") in equipment_ids
            )
        }
        visible_work_order_ids = {
            item.get("id")
            for item in clean.get("workOrders", [])
            if isinstance(item, dict)
            and (
                item.get("ticketId") in visible_ticket_ids
                or item.get("buildingId") in building_ids
                or item.get("apartmentId") in apartment_ids
                or item.get("equipmentId") in equipment_ids
            )
        }
        response["clients"] = [item for item in clean.get("clients", []) if isinstance(item, dict) and item.get("id") == client_id]
        response["users"] = [
            item for item in clean.get("users", [])
            if isinstance(item, dict) and item.get("clientId") == client_id and (has_client_right(user, "users") or item.get("id") == user.get("id"))
        ]
        if has_client_right(user, "lieux"):
            response["buildings"] = [item for item in clean.get("buildings", []) if isinstance(item, dict) and item.get("id") in building_ids]
            response["apartments"] = [item for item in clean.get("apartments", []) if isinstance(item, dict) and item.get("id") in apartment_ids]
        if has_client_right(user, "equipment"):
            response["equipment"] = [item for item in clean.get("equipment", []) if isinstance(item, dict) and item.get("id") in equipment_ids]
        if has_client_right(user, "tickets"):
            response["tickets"] = [item for item in clean.get("tickets", []) if isinstance(item, dict) and item.get("id") in visible_ticket_ids]
        if has_client_right(user, "workorders"):
            response["workOrders"] = [item for item in clean.get("workOrders", []) if isinstance(item, dict) and item.get("id") in visible_work_order_ids]
            response["interventions"] = [
                filtered_intervention_for_user(item, has_client_right(user, "recommendations"))
                for item in clean.get("interventions", [])
                if isinstance(item, dict) and (item.get("workOrderId") in visible_work_order_ids or item.get("equipmentId") in equipment_ids)
            ]
        if has_client_right(user, "alerts"):
            response["reminders"] = [item for item in clean.get("reminders", []) if isinstance(item, dict) and item.get("equipmentId") in equipment_ids]
        if has_client_right(user, "documents"):
            response["clientDocuments"] = [
                item for item in clean.get("clientDocuments", [])
                if isinstance(item, dict)
                and item.get("clientId") == client_id
                and item.get("visibleToClient") is not False
                and (
                    not item.get("buildingId")
                    or item.get("buildingId") in building_ids
                    or item.get("apartmentId") in apartment_ids
                    or item.get("equipmentId") in equipment_ids
                )
            ]
        return response

    if role == "technicien":
        work_order_ids, building_ids, apartment_ids, equipment_ids = technician_scopes(clean, user)
        response["users"] = [item for item in clean.get("users", []) if isinstance(item, dict) and item.get("id") == user.get("id")]
        response["clients"] = [
            item for item in clean.get("clients", [])
            if isinstance(item, dict) and item.get("id") in {
                building.get("clientId")
                for building in clean.get("buildings", [])
                if isinstance(building, dict) and building.get("id") in building_ids
            }
        ]
        response["buildings"] = [item for item in clean.get("buildings", []) if isinstance(item, dict) and item.get("id") in building_ids]
        response["apartments"] = [item for item in clean.get("apartments", []) if isinstance(item, dict) and item.get("id") in apartment_ids]
        response["equipment"] = [item for item in clean.get("equipment", []) if isinstance(item, dict) and item.get("id") in equipment_ids]
        response["workOrders"] = [item for item in clean.get("workOrders", []) if isinstance(item, dict) and item.get("id") in work_order_ids]
        response["interventions"] = [
            item for item in clean.get("interventions", [])
            if isinstance(item, dict) and (item.get("workOrderId") in work_order_ids or item.get("equipmentId") in equipment_ids)
        ]
        response["reminders"] = [item for item in clean.get("reminders", []) if isinstance(item, dict) and item.get("equipmentId") in equipment_ids]
        return response

    response["users"] = [user]
    return response


def filtered_intervention_for_user(intervention: dict, can_see_recommendation: bool) -> dict:
    item = copy.deepcopy(intervention)
    if not can_see_recommendation:
        item.pop("recommendation", None)
    return item


def can_save_collection(state: dict, current_user_row: Any, collection_key: str, item: dict) -> bool:
    user = requester_from_state(sanitize_state_for_storage(state), current_user_row)
    role = user.get("role")
    if role in {"administrateur", "equipe_interne"}:
        return True
    if role == "client":
        building_ids = client_building_scope(state, user)
        apartment_ids, equipment_ids = equipment_scope_for_buildings(state, building_ids)
        if collection_key == "tickets" and has_client_right(user, "tickets"):
            return (
                item.get("clientId") == user.get("clientId")
                and (not item.get("buildingId") or item.get("buildingId") in building_ids)
                and (not item.get("apartmentId") or item.get("apartmentId") in apartment_ids)
                and (not item.get("equipmentId") or item.get("equipmentId") in equipment_ids)
            )
        return False
    if role == "technicien":
        work_order_ids, building_ids, apartment_ids, equipment_ids = technician_scopes(state, user)
        if collection_key == "interventions":
            return item.get("workOrderId") in work_order_ids and (
                not item.get("equipmentId") or item.get("equipmentId") in equipment_ids
            )
        if collection_key == "equipment":
            return item.get("apartmentId") in apartment_ids
        if collection_key == "workOrders":
            existing = next((order for order in state.get("workOrders", []) if isinstance(order, dict) and order.get("id") == item.get("id")), None)
            return bool(existing and order_assigned_to_user(existing, user.get("id")))
    return False


def require_can_save_collection(state: dict, current_user_row: Any, collection_key: str, item: dict) -> None:
    if not can_save_collection(state, current_user_row, collection_key, item):
        raise AuthorizationError("Droits insuffisants.")
