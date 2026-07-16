from __future__ import annotations

import hashlib


def migrate_operational_state(state: dict) -> set[str]:
    """Backfill the normalized operational model without changing business history."""
    changed: set[str] = set()
    apartments = {str(item.get("id")): item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id")}
    buildings = {str(item.get("id")): item for item in state.get("buildings", []) if isinstance(item, dict) and item.get("id")}

    systems = state.setdefault("hvacSystems", [])
    systems_by_apartment: dict[str, list[dict]] = {}
    for system in systems:
        if isinstance(system, dict) and system.get("apartmentId"):
            systems_by_apartment.setdefault(str(system["apartmentId"]), []).append(system)

    equipment_by_apartment: dict[str, list[dict]] = {}
    for equipment in state.setdefault("equipment", []):
        if not isinstance(equipment, dict):
            continue
        apartment_id = str(equipment.get("apartmentId") or "")
        apartment = apartments.get(apartment_id)
        building = buildings.get(str((apartment or {}).get("buildingId") or equipment.get("homeBuildingId") or ""))
        updates = {
            "homeBuildingId": equipment.get("homeBuildingId") or (apartment or {}).get("buildingId") or "",
            "clientId": equipment.get("clientId") or (building or {}).get("clientId") or "",
        }
        for key, value in updates.items():
            if equipment.get(key) != value:
                equipment[key] = value
                changed.add("equipment")
        if apartment_id:
            equipment_by_apartment.setdefault(apartment_id, []).append(equipment)

    for apartment_id, items in equipment_by_apartment.items():
        unassigned = [item for item in items if not item.get("systemId")]
        if not unassigned:
            continue
        existing_systems = systems_by_apartment.get(apartment_id, [])
        if existing_systems:
            system = existing_systems[0]
        else:
            apartment = apartments.get(apartment_id) or {}
            building = buildings.get(str(apartment.get("buildingId") or "")) or {}
            system = {
                "id": _stable_id("system", apartment_id),
                "clientId": building.get("clientId") or "",
                "buildingId": apartment.get("buildingId") or "",
                "apartmentId": apartment_id,
                "name": "Systeme existant",
                "active": True,
                "migrated": True,
            }
            systems.append(system)
            systems_by_apartment.setdefault(apartment_id, []).append(system)
            changed.add("hvacSystems")
        for equipment in unassigned:
            equipment["systemId"] = system["id"]
            changed.add("equipment")

    for storage in state.setdefault("storageLocations", []):
        if not isinstance(storage, dict):
            continue
        scope = storage.get("scopeType") or ("building" if storage.get("buildingId") else "client" if storage.get("clientId") else "company")
        if storage.get("scopeType") != scope:
            storage["scopeType"] = scope
            changed.add("storageLocations")

    targets = state.setdefault("workOrderTargets", [])
    targeted_orders = {str(item.get("workOrderId")) for item in targets if isinstance(item, dict) and item.get("workOrderId")}
    apartments_by_building: dict[str, list[dict]] = {}
    for apartment in apartments.values():
        apartments_by_building.setdefault(str(apartment.get("buildingId") or ""), []).append(apartment)
    equipment_map = {str(item.get("id")): item for item in state.get("equipment", []) if isinstance(item, dict) and item.get("id")}
    for order in state.setdefault("workOrders", []):
        if not isinstance(order, dict) or not order.get("id"):
            continue
        default_type = order.get("defaultActivityTypeId") or order.get("typeId") or ""
        if order.get("defaultActivityTypeId") != default_type:
            order["defaultActivityTypeId"] = default_type
            changed.add("workOrders")
        if "object" not in order:
            order["object"] = order.get("notes") or "Intervention HVAC"
            changed.add("workOrders")
        order_id = str(order["id"])
        if order_id in targeted_orders:
            continue
        candidates: list[tuple[str, str]] = []
        if order.get("buildingId") and order.get("scope") != "equipment":
            candidates = [(str(item["id"]), "") for item in apartments_by_building.get(str(order["buildingId"]), [])]
        else:
            equipment = equipment_map.get(str(order.get("equipmentId") or ""))
            apartment_id = str(order.get("apartmentId") or (equipment or {}).get("apartmentId") or "")
            if apartment_id:
                candidates = [(apartment_id, str(order.get("equipmentId") or ""))]
        for apartment_id, equipment_id in candidates:
            apartment = apartments.get(apartment_id) or {}
            targets.append({
                "id": _stable_id("target", order_id, apartment_id, equipment_id),
                "workOrderId": order_id,
                "buildingId": order.get("buildingId") or apartment.get("buildingId") or "",
                "apartmentId": apartment_id,
                "equipmentId": equipment_id,
                "activityTypeId": default_type,
                "status": "termine" if order.get("status") == "termine" else "a_faire",
                "approvalStatus": "not_required",
                "sourceRecommendationId": "",
                "completedAt": order.get("completedAt") or "",
                "migrated": True,
            })
            changed.add("workOrderTargets")
    return changed


def _stable_id(prefix: str, *values: str) -> str:
    digest = hashlib.sha1("|".join(values).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}-{digest}"
