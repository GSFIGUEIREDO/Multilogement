from __future__ import annotations

from http import HTTPStatus
from typing import Any

from backend.security import AuthorizationError, require_can_save_collection
from src.climaparc.shared.domain.errors import ApplicationError


def normalize_building_payload(building_payload: dict) -> dict:
    if not isinstance(building_payload, dict) or not building_payload.get("id"):
        raise ApplicationError("Lieu invalide.")
    building = dict(building_payload)
    if not str(building.get("clientId") or "").strip():
        raise ApplicationError("Client obligatoire.")
    if not str(building.get("name") or "").strip():
        raise ApplicationError("Nom du lieu obligatoire.")
    return building


def normalize_apartment_payload(apartment_payload: dict) -> dict:
    if not isinstance(apartment_payload, dict) or not apartment_payload.get("id"):
        raise ApplicationError("Appartement invalide.")
    apartment = dict(apartment_payload)
    if not str(apartment.get("buildingId") or "").strip():
        raise ApplicationError("Lieu obligatoire.")
    if not str(apartment.get("number") or "").strip():
        raise ApplicationError("Numero d'appartement obligatoire.")
    return apartment


def require_can_save_place(state: dict, current_user_row: Any, collection_key: str, item: dict) -> None:
    try:
        require_can_save_collection(state, current_user_row, collection_key, item)
    except AuthorizationError as error:
        raise ApplicationError(str(error), HTTPStatus.FORBIDDEN)


def find_item_index(items: list, item_id: str) -> int:
    return next(
        (index for index, item in enumerate(items) if isinstance(item, dict) and item.get("id") == item_id),
        -1,
    )


def ensure_building_exists(state: dict, building_id: str) -> None:
    exists = any(item.get("id") == building_id for item in state.get("buildings", []) if isinstance(item, dict))
    if not exists:
        raise ApplicationError("Lieu introuvable.", HTTPStatus.NOT_FOUND)


def clear_ui_state(state: dict) -> None:
    state["sessionUserId"] = None
    state["modal"] = None
    state["toast"] = ""

