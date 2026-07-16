from __future__ import annotations

import re
from datetime import datetime, timezone

from backend.security import order_assigned_to_user, requester_from_state
from src.climaparc.shared.domain.errors import ApplicationError


def parse_manufacture_age(value: object) -> tuple[str, int | None, int | None]:
    raw = str(value or "").strip()
    year_match = re.search(r"\b(19\d{2}|20\d{2}|2100)\b", raw)
    age_match = re.search(r"\b(\d{1,3})\s*(?:an|ans|annee|annees)\b", raw.lower())
    return raw, int(year_match.group(1)) if year_match else None, int(age_match.group(1)) if age_match and not year_match else None


def normalize_field_bundle(
    state: dict,
    apartment_payload: dict | None,
    equipment_payload: dict,
    intervention_payload: dict,
    work_order_payload: dict,
) -> tuple[dict | None, dict, dict, dict]:
    if not isinstance(equipment_payload, dict) or not equipment_payload.get("id"):
        raise ApplicationError("Machine invalide.")
    if not isinstance(intervention_payload, dict) or not intervention_payload.get("id"):
        raise ApplicationError("Intervention invalide.")
    if not isinstance(work_order_payload, dict) or not work_order_payload.get("id"):
        raise ApplicationError("Bon de travail invalide.")

    equipment = dict(equipment_payload)
    intervention = dict(intervention_payload)
    work_order = dict(work_order_payload)
    apartment = dict(apartment_payload) if isinstance(apartment_payload, dict) else None
    apartment_id = str(equipment.get("apartmentId") or intervention.get("apartmentId") or "")
    if not apartment_id:
        raise ApplicationError("Appartement obligatoire.")
    if apartment and apartment.get("id") != apartment_id:
        raise ApplicationError("Appartement incoherent.")
    if not apartment and not any(item.get("id") == apartment_id for item in state.get("apartments", []) if isinstance(item, dict)):
        raise ApplicationError("Appartement introuvable.")
    if intervention.get("equipmentId") != equipment.get("id") or intervention.get("workOrderId") != work_order.get("id"):
        raise ApplicationError("Activite incoherente.")

    existing = next((item for item in state.get("equipment", []) if isinstance(item, dict) and item.get("id") == equipment["id"]), None)
    if existing and existing.get("attachments") and not equipment.get("attachments"):
        equipment["attachments"] = existing.get("attachments")
    raw_age, manufacture_year, estimated_age = parse_manufacture_age(equipment.get("manufactureAgeInfo"))
    equipment["manufactureAgeInfo"] = raw_age
    equipment["manufactureYear"] = manufacture_year
    equipment["estimatedAgeYears"] = estimated_age
    equipment["conditionStatus"] = intervention.get("machineStatus") or equipment.get("conditionStatus") or equipment.get("status") or "actif"
    equipment["status"] = equipment["conditionStatus"]
    equipment["clientId"] = equipment.get("clientId") or client_for_apartment(state, apartment_id)
    source_apartment = next((item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id") == apartment_id), None)
    equipment["homeBuildingId"] = equipment.get("homeBuildingId") or (source_apartment or {}).get("buildingId") or ""
    equipment["systemId"] = str(equipment.get("systemId") or "")
    equipment["lifecycleStatus"] = equipment.get("lifecycleStatus") or "installed"
    equipment["storageLocationId"] = "" if equipment["lifecycleStatus"] == "installed" else equipment.get("storageLocationId") or ""
    intervention["apartmentId"] = apartment_id
    return apartment, equipment, intervention, work_order


def option_behavior(state: dict, field_id: str, value: object) -> str:
    field = next((item for item in state.get("dataFields", []) if isinstance(item, dict) and item.get("id") == field_id), None)
    option = next((item for item in (field or {}).get("options", []) if isinstance(item, dict) and item.get("value") == value), None)
    if option and option.get("behavior"):
        return str(option.get("behavior"))
    fallbacks = {
        "completee": "completed",
        "partielle": "partial",
        "a_revoir": "return_required",
        "client_absent": "not_completed",
        "reparation_requise": "repair_required",
        "hors_service": "out_of_service",
        "surveillance": "monitoring",
        "actif": "operational",
        "ok": "operational",
    }
    return fallbacks.get(str(value or ""), "")


def is_replacement_activity(state: dict, intervention: dict) -> bool:
    activity_type = next((item for item in state.get("interventionTypes", []) if isinstance(item, dict) and item.get("id") == intervention.get("typeId")), None)
    return bool(activity_type and (activity_type.get("behavior") == "replacement" or activity_type.get("id") == "remplacement_unite"))


def normalize_replacement_bundle(
    state: dict,
    current_user: object,
    old_equipment: dict,
    intervention: dict,
    work_order: dict,
    payload: dict | None,
) -> tuple[dict, dict | None]:
    if not is_replacement_activity(state, intervention):
        return old_equipment, None
    if option_behavior(state, "activity_status", intervention.get("activityStatus")) != "completed":
        return old_equipment, None
    existing_relation = next(
        (
            item
            for item in state.get("equipmentReplacements", [])
            if isinstance(item, dict)
            and (
                (isinstance(payload, dict) and item.get("id") == payload.get("replacementId"))
                or (item.get("oldEquipmentId") == old_equipment.get("id") and item.get("workOrderId") == work_order.get("id"))
            )
        ),
        None,
    )
    if existing_relation:
        intervention["replacement"] = {
            "oldEquipmentId": existing_relation.get("oldEquipmentId"),
            "newEquipmentId": existing_relation.get("newEquipmentId"),
            "replacementId": existing_relation.get("id"),
        }
        return old_equipment, None
    if not isinstance(payload, dict):
        raise ApplicationError("Confirmez la nouvelle unite et la destination de l'ancienne unite.")

    action = str(payload.get("action") or "")
    if action not in {"transfer_apartment", "storage", "dispose"}:
        raise ApplicationError("Destination de l'ancienne unite obligatoire.")
    new_equipment = dict(payload.get("newEquipment") or {})
    if not new_equipment.get("id") or new_equipment.get("id") == old_equipment.get("id"):
        raise ApplicationError("Nouvelle unite invalide.")

    source_apartment_id = old_equipment.get("apartmentId") or intervention.get("apartmentId") or ""
    source_client_id = client_for_apartment(state, source_apartment_id)
    persisted_new_equipment = next(
        (item for item in state.get("equipment", []) if isinstance(item, dict) and item.get("id") == new_equipment.get("id")),
        None,
    )
    replacement_source_client_id = client_for_apartment(state, str((persisted_new_equipment or {}).get("apartmentId") or ""))
    new_equipment["apartmentId"] = source_apartment_id
    new_equipment["clientId"] = source_client_id
    new_equipment["lifecycleStatus"] = "installed"
    new_equipment["storageLocationId"] = ""
    new_equipment["homeBuildingId"] = old_equipment.get("homeBuildingId") or next((item.get("buildingId") for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id") == source_apartment_id), "")
    new_equipment["systemId"] = old_equipment.get("systemId") or ""
    new_equipment["conditionStatus"] = new_equipment.get("conditionStatus") or new_equipment.get("status") or "actif"
    new_equipment["status"] = new_equipment["conditionStatus"]
    raw_age, manufacture_year, estimated_age = parse_manufacture_age(new_equipment.get("manufactureAgeInfo"))
    new_equipment["manufactureAgeInfo"] = raw_age
    new_equipment["manufactureYear"] = manufacture_year
    new_equipment["estimatedAgeYears"] = estimated_age

    requester = requester_from_state(state, current_user)
    if requester.get("role") == "technicien" and not order_assigned_to_user(work_order, requester.get("id")):
        raise ApplicationError("Droits insuffisants.")
    if replacement_source_client_id and source_client_id and replacement_source_client_id != source_client_id and requester.get("role") not in {"administrateur", "equipe_interne"}:
        raise ApplicationError("Une validation interne est requise pour installer une unite provenant d'un autre client.")

    target_apartment_id = ""
    target_storage_id = ""
    target_client_id = source_client_id
    source_home_building_id = str(old_equipment.get("homeBuildingId") or next((item.get("buildingId") for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id") == source_apartment_id), "") or "")
    target_home_building_id = source_home_building_id
    source_system_id = str(old_equipment.get("systemId") or "")
    target_system_id = ""
    updated_old = dict(old_equipment)
    if action == "transfer_apartment":
        target_apartment_id = str(payload.get("destinationApartmentId") or "")
        if not any(item.get("id") == target_apartment_id for item in state.get("apartments", []) if isinstance(item, dict)):
            raise ApplicationError("Appartement de destination introuvable.")
        target_client_id = client_for_apartment(state, target_apartment_id)
        target_apartment = next((item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id") == target_apartment_id), None)
        target_home_building_id = str((target_apartment or {}).get("buildingId") or "")
        target_system_id = str(payload.get("destinationSystemId") or "")
        updated_old.update({"apartmentId": target_apartment_id, "clientId": target_client_id, "homeBuildingId": target_home_building_id, "systemId": target_system_id, "storageLocationId": "", "lifecycleStatus": "installed", "disposedAt": ""})
    elif action == "storage":
        target_storage_id = str(payload.get("destinationStorageLocationId") or "")
        storage = next((item for item in state.get("storageLocations", []) if isinstance(item, dict) and item.get("id") == target_storage_id and item.get("active") is not False), None)
        if not storage:
            raise ApplicationError("Depot de destination introuvable.")
        scope_type = storage.get("scopeType") or ("client" if storage.get("clientId") else "company")
        if scope_type != "company" and storage.get("clientId") != source_client_id:
            raise ApplicationError("Depot hors du perimetre du client.")
        target_client_id = source_client_id
        updated_old.update({"apartmentId": "", "clientId": source_client_id, "homeBuildingId": source_home_building_id, "systemId": "", "storageLocationId": target_storage_id, "lifecycleStatus": "stored", "disposedAt": ""})
    else:
        updated_old.update({"apartmentId": "", "clientId": source_client_id, "homeBuildingId": source_home_building_id, "systemId": "", "storageLocationId": "", "lifecycleStatus": "disposed", "disposedAt": datetime.now(timezone.utc).date().isoformat()})

    if source_client_id and target_client_id and source_client_id != target_client_id and requester.get("role") not in {"administrateur", "equipe_interne"}:
        raise ApplicationError("Une validation interne est requise pour un transfert entre clients.")

    performed_at = datetime.now(timezone.utc).isoformat()
    movement = {
        "id": str(payload.get("movementId") or ""),
        "equipmentId": updated_old["id"],
        "movementType": action,
        "fromApartmentId": source_apartment_id,
        "toApartmentId": target_apartment_id,
        "fromStorageLocationId": old_equipment.get("storageLocationId") or "",
        "toStorageLocationId": target_storage_id,
        "workOrderId": work_order["id"],
        "interventionId": intervention["id"],
        "reason": str(payload.get("reason") or "Remplacement de l'unite"),
        "performedBy": requester.get("id") or "",
        "performedAt": performed_at,
        "fromHomeBuildingId": source_home_building_id,
        "toHomeBuildingId": target_home_building_id,
        "fromSystemId": source_system_id,
        "toSystemId": target_system_id,
    }
    relation = {
        "id": str(payload.get("replacementId") or ""),
        "oldEquipmentId": updated_old["id"],
        "newEquipmentId": new_equipment["id"],
        "workOrderId": work_order["id"],
        "interventionId": intervention["id"],
        "completedAt": performed_at,
    }
    new_equipment_movement = None
    if persisted_new_equipment:
        previous_apartment_id = str(persisted_new_equipment.get("apartmentId") or "")
        previous_storage_id = str(persisted_new_equipment.get("storageLocationId") or "")
        if previous_apartment_id != source_apartment_id or previous_storage_id:
            new_equipment_movement = {
                "id": f"{movement['id']}-replacement",
                "equipmentId": new_equipment["id"],
                "movementType": "install_replacement",
                "fromApartmentId": previous_apartment_id,
                "toApartmentId": source_apartment_id,
                "fromStorageLocationId": previous_storage_id,
                "toStorageLocationId": "",
                "workOrderId": work_order["id"],
                "interventionId": intervention["id"],
                "reason": str(payload.get("reason") or "Installation comme unite de remplacement"),
                "performedBy": requester.get("id") or "",
                "performedAt": performed_at,
                "fromHomeBuildingId": str(persisted_new_equipment.get("homeBuildingId") or ""),
                "toHomeBuildingId": new_equipment.get("homeBuildingId") or "",
                "fromSystemId": str(persisted_new_equipment.get("systemId") or ""),
                "toSystemId": new_equipment.get("systemId") or "",
            }
    if not movement["id"] or not relation["id"]:
        raise ApplicationError("Identifiants de remplacement invalides.")
    intervention["replacement"] = {"oldEquipmentId": updated_old["id"], "newEquipmentId": new_equipment["id"], "action": action, "movementId": movement["id"], "replacementId": relation["id"]}
    return updated_old, {"newEquipment": new_equipment, "movement": movement, "newEquipmentMovement": new_equipment_movement, "relation": relation}


def client_for_apartment(state: dict, apartment_id: str) -> str:
    apartment = next((item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id") == apartment_id), None)
    building = next((item for item in state.get("buildings", []) if isinstance(item, dict) and item.get("id") == (apartment or {}).get("buildingId")), None)
    return str((building or {}).get("clientId") or "")
