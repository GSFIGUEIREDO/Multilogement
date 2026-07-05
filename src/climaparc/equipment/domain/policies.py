from __future__ import annotations

from http import HTTPStatus
from typing import Any

from backend.security import AuthorizationError, require_can_save_collection
from src.climaparc.shared.domain.errors import ApplicationError


def normalize_equipment_payload(equipment_payload: dict) -> dict:
    if not isinstance(equipment_payload, dict) or not equipment_payload.get("id"):
        raise ApplicationError("Machine invalide.")
    return dict(equipment_payload)


def require_can_save_equipment(state: dict, current_user_row: Any, equipment: dict) -> None:
    try:
        require_can_save_collection(state, current_user_row, "equipment", equipment)
    except AuthorizationError as error:
        raise ApplicationError(str(error), HTTPStatus.FORBIDDEN)


def find_equipment_index(items: list, equipment_id: str) -> int:
    return next(
        (index for index, item in enumerate(items) if isinstance(item, dict) and item.get("id") == equipment_id),
        -1,
    )


def preserve_existing_attachments(existing: dict, equipment: dict) -> dict:
    if isinstance(existing, dict) and existing.get("attachments") and not equipment.get("attachments"):
        equipment = dict(equipment)
        equipment["attachments"] = existing.get("attachments")
    return equipment


def clear_ui_state(state: dict) -> None:
    state["sessionUserId"] = None
    state["modal"] = None
    state["toast"] = ""

