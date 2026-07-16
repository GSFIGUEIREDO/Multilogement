from __future__ import annotations

from http import HTTPStatus
from typing import Any

from backend.database import row_get
from src.climaparc.shared.domain.errors import ApplicationError


SUPPORTED_SETTING_COLLECTIONS = {
    "serviceTypes",
    "interventionTypes",
    "dataFields",
    "formTemplates",
    "roleDefinitions",
    "storageLocations",
    "hvacSystemTypes",
}


def require_supported_collection(collection_key: str) -> None:
    if collection_key not in SUPPORTED_SETTING_COLLECTIONS:
        raise ApplicationError("Collection de parametres invalide.")


def require_can_manage_settings(current_user_row: Any) -> None:
    role = row_get(current_user_row, "role")
    if role not in {"administrateur", "equipe_interne"}:
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)


def normalize_setting_item(collection_key: str, payload: dict) -> dict:
    require_supported_collection(collection_key)
    if not isinstance(payload, dict) or not payload.get("id"):
        raise ApplicationError("Element de parametres invalide.")
    if collection_key == "serviceTypes":
        return normalize_service_type(payload)
    if collection_key == "interventionTypes":
        return normalize_intervention_type(payload)
    if collection_key == "dataFields":
        return normalize_data_field(payload)
    if collection_key == "formTemplates":
        return normalize_form_template(payload)
    if collection_key == "roleDefinitions":
        return normalize_role_definition(payload)
    if collection_key == "storageLocations":
        return normalize_storage_location(payload)
    if collection_key == "hvacSystemTypes":
        return normalize_hvac_system_type(payload)
    raise ApplicationError("Collection de parametres invalide.")


def normalize_service_type(payload: dict) -> dict:
    item = dict(payload)
    item["name"] = str(item.get("name") or "").strip()
    if not item["name"]:
        raise ApplicationError("Nom du type de demande obligatoire.")
    item["defaultPriority"] = str(item.get("defaultPriority") or "normale")
    item["linkedInterventionTypeId"] = str(item.get("linkedInterventionTypeId") or "")
    return item


def normalize_intervention_type(payload: dict) -> dict:
    item = dict(payload)
    item["name"] = str(item.get("name") or "").strip()
    if not item["name"]:
        raise ApplicationError("Nom du type d'intervention obligatoire.")
    try:
        item["defaultDuration"] = max(1, int(item.get("defaultDuration") or 60))
    except (TypeError, ValueError):
        raise ApplicationError("Duree par defaut invalide.") from None
    checklist = item.get("checklist") or []
    item["checklist"] = [str(entry).strip() for entry in checklist if str(entry).strip()] if isinstance(checklist, list) else []
    item["defaultFormTemplateId"] = str(item.get("defaultFormTemplateId") or "")
    item["behavior"] = str(item.get("behavior") or "standard")
    return item


def normalize_data_field(payload: dict) -> dict:
    item = dict(payload)
    item["name"] = str(item.get("name") or "").strip()
    if not item["name"]:
        raise ApplicationError("Nom du champ obligatoire.")
    item["group"] = str(item.get("group") or "Non groupe").strip() or "Non groupe"
    item["type"] = str(item.get("type") or "single")
    applies_to = item.get("appliesTo") if isinstance(item.get("appliesTo"), list) else []
    item["appliesTo"] = [str(value) for value in applies_to if value] or ["activity"]
    item["options"] = normalize_data_options(item.get("options") or [])
    return item


def normalize_data_options(options: list) -> list[dict]:
    if not isinstance(options, list):
        return []
    normalized = []
    for option in options:
        if isinstance(option, str):
            label = option.strip()
            value = label
            option_id = slugify(value)
        elif isinstance(option, dict):
            label = str(option.get("label") or option.get("value") or "").strip()
            value = str(option.get("value") or label).strip()
            option_id = str(option.get("id") or slugify(value or label))
        else:
            continue
        if not label:
            continue
        normalized.append({
            "id": option_id,
            "label": label,
            "value": value,
            "active": option.get("active", True) is not False if isinstance(option, dict) else True,
            "behavior": str(option.get("behavior") or "") if isinstance(option, dict) else "",
            "color": str(option.get("color") or "") if isinstance(option, dict) else "",
        })
    return normalized


def normalize_form_template(payload: dict) -> dict:
    item = dict(payload)
    item["name"] = str(item.get("name") or "").strip()
    if not item["name"]:
        raise ApplicationError("Nom du formulaire obligatoire.")
    fields = item.get("fields") if isinstance(item.get("fields"), list) else []
    if not fields:
        raise ApplicationError("Ajoutez au moins une question.")
    normalized_fields = []
    for field in fields:
        if not isinstance(field, dict) or not field.get("id"):
            continue
        clean = dict(field)
        scopes = clean.get("unitScopes") if isinstance(clean.get("unitScopes"), list) else [clean.get("unitScope") or "all"]
        scopes = list(dict.fromkeys(str(value) for value in scopes if value in {"all", "interieure", "exterieure", "monobloc"})) or ["all"]
        clean["unitScopes"] = ["all"] if "all" in scopes else scopes
        clean["unitScope"] = clean["unitScopes"][0]
        type_ids = clean.get("systemTypeIds") if isinstance(clean.get("systemTypeIds"), list) else []
        clean["systemTypeIds"] = list(dict.fromkeys(str(value) for value in type_ids if value))
        normalized_fields.append(clean)
    item["fields"] = normalized_fields
    item["activityFields"] = item.get("activityFields") if isinstance(item.get("activityFields"), dict) else {}
    associated = item.get("associatedActivityTypeIds") if isinstance(item.get("associatedActivityTypeIds"), list) else []
    item["associatedActivityTypeIds"] = list(dict.fromkeys(str(value) for value in associated if value))
    return item


def normalize_role_definition(payload: dict) -> dict:
    item = dict(payload)
    item["name"] = str(item.get("name") or "").strip()
    if not item["name"]:
        raise ApplicationError("Nom du role obligatoire.")
    rights = item.get("rights") if isinstance(item.get("rights"), list) else []
    item["rights"] = [str(right) for right in rights if right]
    return item


def normalize_storage_location(payload: dict) -> dict:
    item = dict(payload)
    item["name"] = str(item.get("name") or "").strip()
    item["scopeType"] = str(item.get("scopeType") or "client").strip()
    if item["scopeType"] not in {"client", "building", "company"}:
        raise ApplicationError("Portee du depot invalide.")
    item["clientId"] = str(item.get("clientId") or "").strip()
    item["buildingId"] = str(item.get("buildingId") or "").strip()
    if not item["name"]:
        raise ApplicationError("Nom du depot obligatoire.")
    if item["scopeType"] in {"client", "building"} and not item["clientId"]:
        raise ApplicationError("Client du depot obligatoire.")
    if item["scopeType"] == "building" and not item["buildingId"]:
        raise ApplicationError("Lieu du depot obligatoire.")
    if item["scopeType"] == "company":
        item["clientId"] = ""
        item["buildingId"] = ""
    elif item["scopeType"] == "client":
        item["buildingId"] = ""
    item["address"] = str(item.get("address") or "").strip()
    item["active"] = item.get("active") is not False
    return item


def normalize_hvac_system_type(payload: dict) -> dict:
    item = dict(payload)
    item["name"] = str(item.get("name") or "").strip()
    item["topology"] = str(item.get("topology") or "split").strip()
    if not item["name"]:
        raise ApplicationError("Nom du type de systeme obligatoire.")
    if item["topology"] not in {"monobloc", "split"}:
        raise ApplicationError("Topologie du systeme invalide.")
    try:
        item["sortOrder"] = int(item.get("sortOrder") or 0)
    except (TypeError, ValueError):
        item["sortOrder"] = 0
    item["active"] = item.get("active") is not False
    return item


def slugify(value: str) -> str:
    import re
    import unicodedata

    clean = unicodedata.normalize("NFD", str(value or "").strip().lower())
    clean = "".join(char for char in clean if unicodedata.category(char) != "Mn")
    clean = re.sub(r"[^a-z0-9]+", "_", clean).strip("_")
    return clean or "option"


def find_item_index(items: list, item_id: str) -> int:
    return next((index for index, item in enumerate(items) if isinstance(item, dict) and item.get("id") == item_id), -1)


def clear_ui_state(state: dict) -> None:
    state["sessionUserId"] = None
    state["modal"] = None
    state["toast"] = ""
