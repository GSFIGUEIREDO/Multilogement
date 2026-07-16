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
    "technicianPermissions",
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
    "storageLocations",
    "equipmentMovements",
    "equipmentReplacements",
    "hvacSystems",
    "hvacSystemTypes",
    "workOrderTargets",
    "workOrderCompletionAudits",
}

CONFIG_KEYS = {
    "serviceTypes",
    "interventionTypes",
    "formTemplates",
    "roleDefinitions",
    "dataFields",
    "hvacSystemTypes",
}

CLIENT_RIGHT_DEFAULTS = {
    "direction": ["portal", "lieux", "equipment", "tickets", "workorders", "recommendations", "documents", "reports", "alerts", "users", "recommendation_prices", "recommendation_approve"],
    "gestionnaire": ["portal", "lieux", "equipment", "tickets", "workorders", "recommendations", "documents", "reports", "alerts"],
    "maintenance": ["portal", "lieux", "equipment", "tickets", "workorders", "documents", "alerts"],
}

RIGHT_ALIASES = {
    "prices": "recommendation_prices",
    "approve_recommendations": "recommendation_approve",
}

SENSITIVE_PUBLIC_KEYS = {"password", "passwordHash", "password_hash", "salt", "token", "tokenHash"}


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
    remove_sensitive_fields(clean, remove_data_url=False)
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


def sanitize_state_for_response(state: dict | None) -> dict:
    clean = sanitize_state_for_storage(state)
    remove_sensitive_fields(clean, remove_data_url=True)
    return clean


def remove_sensitive_fields(value: Any, remove_data_url: bool) -> None:
    if isinstance(value, list):
        for item in value:
            remove_sensitive_fields(item, remove_data_url)
        return
    if not isinstance(value, dict):
        return
    for key in list(value.keys()):
        if key in SENSITIVE_PUBLIC_KEYS:
            value.pop(key, None)
            continue
        if key == "dataUrl" and (remove_data_url or value.get("storagePath")):
            value.pop(key, None)
            continue
        remove_sensitive_fields(value.get(key), remove_data_url)


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
        # Client accounts always use the portal. Older profiles were saved
        # without the technical ``portal`` flag, so keep them compatible.
        return {"portal", *normalize_rights(explicit)}
    return normalize_rights(CLIENT_RIGHT_DEFAULTS.get(user.get("clientAccessLevel") or "direction", CLIENT_RIGHT_DEFAULTS["gestionnaire"]))


def normalize_right(right: Any) -> str:
    value = str(right or "")
    return RIGHT_ALIASES.get(value, value)


def normalize_rights(rights: Any) -> set[str]:
    return {normalize_right(item) for item in rights if item}


def has_client_right(user: dict, right: str) -> bool:
    if user.get("role") != "client":
        return True
    rights = client_rights(user)
    return "portal" in rights and normalize_right(right) in rights


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
        if isinstance(equipment, dict)
        and (
            equipment.get("apartmentId") in apartment_ids
            or equipment.get("homeBuildingId") in building_ids
        )
    }
    return apartment_ids, equipment_ids


def visible_storage_scope(state: dict, user: dict, building_ids: set[str]) -> tuple[set[str], set[str]]:
    """Return visible depots and inventory IDs without leaking a central depot's global inventory."""
    role = user.get("role")
    client_id = user.get("clientId")
    storage_ids: set[str] = set()
    if role == "technicien":
        storage_ids = {
            item.get("id") for item in state.get("storageLocations", [])
            if isinstance(item, dict) and item.get("id") and item.get("active") is not False
        }
    else:
        for item in state.get("storageLocations", []):
            if not isinstance(item, dict) or not item.get("id") or item.get("active") is False:
                continue
            scope_type = item.get("scopeType") or ("client" if item.get("clientId") else "company")
            if scope_type == "company":
                continue
            if item.get("clientId") != client_id:
                continue
            if scope_type == "client" or item.get("buildingId") in building_ids:
                storage_ids.add(item.get("id"))
    inventory_ids = {
        item.get("id") for item in state.get("equipment", [])
        if isinstance(item, dict)
        and item.get("storageLocationId") in storage_ids
        and (
            role == "technicien"
            or item.get("homeBuildingId") in building_ids
            or (not item.get("homeBuildingId") and item.get("apartmentId") in {
                apartment.get("id") for apartment in state.get("apartments", [])
                if isinstance(apartment, dict) and apartment.get("buildingId") in building_ids
            })
        )
    }
    return storage_ids, inventory_ids


def order_assigned_to_user(order: dict, user_id: str | None) -> bool:
    if not user_id:
        return False
    assigned = set(str(item) for item in order.get("assignedTechnicianIds", []) if item)
    if order.get("technicianId"):
        assigned.add(str(order.get("technicianId")))
    return str(user_id) in assigned


def technician_assignment_scopes(state: dict, user: dict) -> tuple[set[str], set[str], set[str], set[str]]:
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


def technician_scopes(state: dict, user: dict) -> tuple[set[str], set[str], set[str], set[str]]:
    # Technicians need read access to the complete operational park. Mutation
    # rules remain enforced independently by can_save_collection and the
    # technician's explicit edit permissions.
    work_order_ids = {
        item.get("id") for item in state.get("workOrders", [])
        if isinstance(item, dict) and item.get("id")
    }
    building_ids = {
        item.get("id") for item in state.get("buildings", [])
        if isinstance(item, dict) and item.get("id")
    }
    apartment_ids = {
        item.get("id") for item in state.get("apartments", [])
        if isinstance(item, dict) and item.get("id")
    }
    equipment_ids = {
        item.get("id") for item in state.get("equipment", [])
        if isinstance(item, dict) and item.get("id")
    }
    return work_order_ids, building_ids, apartment_ids, equipment_ids


def technician_permissions(user: dict) -> set[str]:
    permissions = user.get("technicianPermissions")
    if not isinstance(permissions, list):
        return set()
    return {str(permission) for permission in permissions if permission}


def has_technician_permission(user: dict, permission: str) -> bool:
    return user.get("role") == "technicien" and permission in technician_permissions(user)


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
    clean = sanitize_state_for_response(state)
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
        storage_ids, storage_equipment_ids = visible_storage_scope(clean, user, building_ids)
        equipment_ids.update(storage_equipment_ids)
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
            response["storageLocations"] = [item for item in clean.get("storageLocations", []) if isinstance(item, dict) and item.get("id") in storage_ids]
            response["hvacSystems"] = [item for item in clean.get("hvacSystems", []) if isinstance(item, dict) and item.get("buildingId") in building_ids]
            response["equipmentMovements"] = [item for item in clean.get("equipmentMovements", []) if isinstance(item, dict) and item.get("equipmentId") in equipment_ids]
            response["equipmentReplacements"] = [
                item for item in clean.get("equipmentReplacements", [])
                if isinstance(item, dict) and (item.get("oldEquipmentId") in equipment_ids or item.get("newEquipmentId") in equipment_ids)
            ]
        if has_client_right(user, "tickets"):
            response["tickets"] = [item for item in clean.get("tickets", []) if isinstance(item, dict) and item.get("id") in visible_ticket_ids]
        if has_client_right(user, "workorders"):
            response["workOrders"] = [item for item in clean.get("workOrders", []) if isinstance(item, dict) and item.get("id") in visible_work_order_ids]
            response["workOrderTargets"] = [item for item in clean.get("workOrderTargets", []) if isinstance(item, dict) and item.get("workOrderId") in visible_work_order_ids]
            response["workOrderCompletionAudits"] = [item for item in clean.get("workOrderCompletionAudits", []) if isinstance(item, dict) and item.get("workOrderId") in visible_work_order_ids]
            response["interventions"] = [
                filtered_intervention_for_user(
                    item,
                    has_client_right(user, "recommendations"),
                    has_client_right(user, "recommendation_prices"),
                )
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
        visible_client_ids = {
            item.get("clientId") for item in response["clients"] if isinstance(item, dict) and item.get("clientId")
        }
        visible_client_ids.update(
            item.get("id") for item in response["clients"] if isinstance(item, dict) and item.get("id")
        )
        storage_ids, storage_equipment_ids = visible_storage_scope(clean, user, building_ids)
        equipment_ids.update(storage_equipment_ids)
        response["equipment"] = [item for item in clean.get("equipment", []) if isinstance(item, dict) and item.get("id") in equipment_ids]
        response["storageLocations"] = [item for item in clean.get("storageLocations", []) if isinstance(item, dict) and item.get("id") in storage_ids]
        response["hvacSystems"] = [item for item in clean.get("hvacSystems", []) if isinstance(item, dict) and item.get("buildingId") in building_ids]
        response["equipmentMovements"] = [item for item in clean.get("equipmentMovements", []) if isinstance(item, dict) and item.get("equipmentId") in equipment_ids]
        response["equipmentReplacements"] = [
            item for item in clean.get("equipmentReplacements", [])
            if isinstance(item, dict) and (item.get("oldEquipmentId") in equipment_ids or item.get("newEquipmentId") in equipment_ids)
        ]
        response["workOrders"] = [item for item in clean.get("workOrders", []) if isinstance(item, dict) and item.get("id") in work_order_ids]
        response["workOrderTargets"] = [item for item in clean.get("workOrderTargets", []) if isinstance(item, dict) and item.get("workOrderId") in work_order_ids]
        response["workOrderCompletionAudits"] = [item for item in clean.get("workOrderCompletionAudits", []) if isinstance(item, dict) and item.get("workOrderId") in work_order_ids]
        response["interventions"] = [
            item for item in clean.get("interventions", [])
            if isinstance(item, dict) and (item.get("workOrderId") in work_order_ids or item.get("equipmentId") in equipment_ids)
        ]
        response["reminders"] = [item for item in clean.get("reminders", []) if isinstance(item, dict) and item.get("equipmentId") in equipment_ids]
        return response

    response["users"] = [user]
    return response


def filtered_intervention_for_user(intervention: dict, can_see_recommendation: bool, can_see_prices: bool = True) -> dict:
    item = copy.deepcopy(intervention)
    if not can_see_recommendation:
        item.pop("recommendation", None)
    elif not can_see_prices and isinstance(item.get("recommendation"), dict):
        item["recommendation"].pop("price", None)
        item["recommendation"].pop("delay", None)
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
        assigned_work_order_ids, _, _, assigned_equipment_ids = technician_assignment_scopes(state, user)
        _, building_ids, apartment_ids, equipment_ids = technician_scopes(state, user)
        if collection_key == "interventions":
            return item.get("workOrderId") in assigned_work_order_ids and (
                not item.get("equipmentId") or item.get("equipmentId") in assigned_equipment_ids
            )
        if collection_key == "equipment":
            existing = next(
                (equipment for equipment in state.get("equipment", []) if isinstance(equipment, dict) and equipment.get("id") == item.get("id")),
                None,
            )
            protected_fields = {"apartmentId", "unitKind", "type", "brand", "model", "serial", "location", "installDate", "manufactureAgeInfo"}
            protected_change = bool(existing) and any((item.get(key) or "") != (existing.get(key) or "") for key in protected_fields)
            return item.get("apartmentId") in apartment_ids and (
                not existing or not protected_change or has_technician_permission(user, "edit_equipment")
            )
        if collection_key == "apartments":
            existing = next(
                (apartment for apartment in state.get("apartments", []) if isinstance(apartment, dict) and apartment.get("id") == item.get("id")),
                None,
            )
            return item.get("buildingId") in building_ids and (
                not existing or has_technician_permission(user, "edit_apartments")
            )
        if collection_key == "workOrders":
            existing = next((order for order in state.get("workOrders", []) if isinstance(order, dict) and order.get("id") == item.get("id")), None)
            return bool(existing and order_assigned_to_user(existing, user.get("id")))
    return False


def require_can_save_collection(state: dict, current_user_row: Any, collection_key: str, item: dict) -> None:
    if not can_save_collection(state, current_user_row, collection_key, item):
        raise AuthorizationError("Droits insuffisants.")
