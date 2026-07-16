from __future__ import annotations

import hashlib
import unicodedata


DEFAULT_HVAC_SYSTEM_TYPES = [
    {"id": "system_type_ptac", "name": "PTAC", "topology": "monobloc", "sortOrder": 10, "active": True},
    {"id": "system_type_ttw", "name": "TTW", "topology": "monobloc", "sortOrder": 20, "active": True},
    {"id": "system_type_thermopompe_murale", "name": "Thermopompe murale", "topology": "split", "sortOrder": 30, "active": True},
    {"id": "system_type_climatiseur_mural", "name": "Air climatise mural", "topology": "split", "sortOrder": 40, "active": True},
    {"id": "system_type_thermopompe_centrale", "name": "Thermopompe centrale", "topology": "split", "sortOrder": 50, "active": True},
    {"id": "system_type_climatiseur_central", "name": "Air climatise central", "topology": "split", "sortOrder": 60, "active": True},
]


def migrate_operational_state(state: dict) -> set[str]:
    """Backfill the normalized operational model without changing business history."""
    changed: set[str] = set()
    apartments = {str(item.get("id")): item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id")}
    buildings = {str(item.get("id")): item for item in state.get("buildings", []) if isinstance(item, dict) and item.get("id")}

    system_types = state.setdefault("hvacSystemTypes", [])
    known_type_ids = {str(item.get("id")) for item in system_types if isinstance(item, dict) and item.get("id")}
    for default_type in DEFAULT_HVAC_SYSTEM_TYPES:
        if default_type["id"] not in known_type_ids:
            system_types.append(dict(default_type))
            changed.add("hvacSystemTypes")
    system_type_map = {str(item.get("id")): item for item in system_types if isinstance(item, dict) and item.get("id")}

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

    equipment_by_system: dict[str, list[dict]] = {}
    for item in state.get("equipment", []):
        if isinstance(item, dict) and item.get("systemId"):
            equipment_by_system.setdefault(str(item["systemId"]), []).append(item)

    for system in systems:
        if not isinstance(system, dict) or not system.get("id"):
            continue
        members = equipment_by_system.get(str(system["id"]), [])
        inferred_type_id = system.get("systemTypeId") or _infer_system_type_id(members)
        system_type = system_type_map.get(str(inferred_type_id)) or {}
        brands = _distinct_values(item.get("brand") for item in members)
        inferred_brand = system.get("brand") or (brands[0] if len(brands) == 1 else "")
        updates = {
            "systemTypeId": inferred_type_id or "system_type_thermopompe_murale",
            "topology": system.get("topology") or system_type.get("topology") or "split",
            "brand": inferred_brand or "A confirmer",
            "brandConflict": len(brands) > 1,
            "sortOrder": int(system.get("sortOrder") or 0),
            "active": system.get("active") is not False,
        }
        for key, value in updates.items():
            if system.get(key) != value:
                system[key] = value
                changed.add("hvacSystems")

    for apartment_id, items in equipment_by_apartment.items():
        unassigned = [item for item in items if not item.get("systemId")]
        if not unassigned:
            continue
        apartment = apartments.get(apartment_id) or {}
        building = buildings.get(str(apartment.get("buildingId") or "")) or {}

        monobloc_items = [item for item in unassigned if _is_monobloc_equipment(item)]
        for item in monobloc_items:
            system = _new_migrated_system(apartment_id, building, item, [item], "Systeme individuel")
            if not any(existing.get("id") == system["id"] for existing in systems if isinstance(existing, dict)):
                systems.append(system)
                systems_by_apartment.setdefault(apartment_id, []).append(system)
                changed.add("hvacSystems")
            item["systemId"] = system["id"]
            item["unitKind"] = "monobloc"
            changed.add("equipment")

        split_items = [item for item in unassigned if item not in monobloc_items]
        exterior = [item for item in split_items if item.get("unitKind") == "exterieure"]
        if split_items and len(exterior) == 1:
            system = _new_migrated_system(apartment_id, building, exterior[0], split_items, "Systeme existant")
            if not any(existing.get("id") == system["id"] for existing in systems if isinstance(existing, dict)):
                systems.append(system)
                systems_by_apartment.setdefault(apartment_id, []).append(system)
                changed.add("hvacSystems")
            for item in split_items:
                item["systemId"] = system["id"]
                changed.add("equipment")
        else:
            for item in split_items:
                system = _new_migrated_system(apartment_id, building, item, [item], "Systeme a confirmer")
                system["needsConfirmation"] = True
                if not any(existing.get("id") == system["id"] for existing in systems if isinstance(existing, dict)):
                    systems.append(system)
                    systems_by_apartment.setdefault(apartment_id, []).append(system)
                    changed.add("hvacSystems")
                item["systemId"] = system["id"]
                changed.add("equipment")

    current_systems = {
        str(item.get("id")): item
        for item in systems
        if isinstance(item, dict) and item.get("id")
    }
    for equipment in state.get("equipment", []):
        if not isinstance(equipment, dict):
            continue
        system = current_systems.get(str(equipment.get("systemId") or ""))
        if not system:
            continue
        system_type = system_type_map.get(str(system.get("systemTypeId") or "")) or {}
        canonical_type = str(system_type.get("name") or "").strip()
        canonical_brand = str(system.get("brand") or "").strip()
        if not system.get("brandConflict") and canonical_type and equipment.get("type") != canonical_type:
            equipment["type"] = canonical_type
            changed.add("equipment")
        if not system.get("brandConflict") and canonical_brand and canonical_brand != "A confirmer" and equipment.get("brand") != canonical_brand:
            equipment["brand"] = canonical_brand
            changed.add("equipment")

    for template in state.setdefault("formTemplates", []):
        if not isinstance(template, dict):
            continue
        for field in template.get("fields", []):
            if not isinstance(field, dict):
                continue
            legacy_scope = str(field.get("unitScope") or "all")
            scopes = field.get("unitScopes")
            normalized_scopes = [str(value) for value in scopes if value] if isinstance(scopes, list) else [legacy_scope]
            if "all" in normalized_scopes or not normalized_scopes:
                normalized_scopes = ["all"]
            else:
                normalized_scopes = list(dict.fromkeys(normalized_scopes))
            system_type_ids = field.get("systemTypeIds")
            normalized_type_ids = [str(value) for value in system_type_ids if value] if isinstance(system_type_ids, list) else []
            if field.get("unitScopes") != normalized_scopes:
                field["unitScopes"] = normalized_scopes
                changed.add("formTemplates")
            if field.get("systemTypeIds") != normalized_type_ids:
                field["systemTypeIds"] = normalized_type_ids
                changed.add("formTemplates")
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


def _normalized(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or "").strip().lower())
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def _is_monobloc_equipment(item: dict) -> bool:
    value = _normalized(item.get("type"))
    return "ptac" in value or "ttw" in value


def _infer_system_type_id(items: list[dict]) -> str:
    sample = next((item for item in items if item.get("type")), {})
    value = _normalized(sample.get("type"))
    if "ptac" in value:
        return "system_type_ptac"
    if "ttw" in value:
        return "system_type_ttw"
    if "centr" in value and "thermopompe" in value:
        return "system_type_thermopompe_centrale"
    if "centr" in value:
        return "system_type_climatiseur_central"
    if "thermopompe" in value:
        return "system_type_thermopompe_murale"
    return "system_type_climatiseur_mural"


def _distinct_values(values: object) -> list[str]:
    result: list[str] = []
    for value in values:
        clean = str(value or "").strip()
        if clean and clean not in result:
            result.append(clean)
    return result


def _new_migrated_system(apartment_id: str, building: dict, anchor: dict, members: list[dict], name: str) -> dict:
    system_type_id = _infer_system_type_id(members)
    topology = "monobloc" if system_type_id in {"system_type_ptac", "system_type_ttw"} else "split"
    brands = _distinct_values(item.get("brand") for item in members)
    return {
        "id": _stable_id("system", apartment_id, str(anchor.get("id") or "")),
        "clientId": building.get("clientId") or "",
        "buildingId": building.get("id") or "",
        "apartmentId": apartment_id,
        "systemTypeId": system_type_id,
        "topology": topology,
        "brand": brands[0] if len(brands) == 1 else "A confirmer",
        "brandConflict": len(brands) > 1,
        "name": name,
        "sortOrder": 0,
        "active": True,
        "migrated": True,
    }
