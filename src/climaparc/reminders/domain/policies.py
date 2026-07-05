from __future__ import annotations

from http import HTTPStatus
from typing import Any

from backend.database import row_get
from src.climaparc.shared.domain.errors import ApplicationError


def normalize_reminder_payload(reminder_payload: dict) -> dict:
    if not isinstance(reminder_payload, dict) or not reminder_payload.get("id"):
        raise ApplicationError("Rappel invalide.")
    reminder = dict(reminder_payload)
    try:
        frequency_value = int(reminder.get("frequencyValue") or 1)
    except (TypeError, ValueError):
        raise ApplicationError("Frequence de rappel invalide.") from None
    reminder["frequencyValue"] = max(1, frequency_value)
    reminder["frequencyUnit"] = reminder.get("frequencyUnit") or "years"
    reminder["status"] = reminder.get("status") or "active"
    reminder["title"] = reminder.get("title") or "Rappel"
    return reminder


def normalize_reminder_batch(reminders: list[dict]) -> list[dict]:
    if not isinstance(reminders, list) or not reminders:
        raise ApplicationError("Aucun rappel a sauvegarder.")
    return [normalize_reminder_payload(item) for item in reminders]


def require_can_manage_reminders(current_user_row: Any) -> None:
    role = row_get(current_user_row, "role")
    if role not in {"administrateur", "equipe_interne"}:
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)


def find_reminder_index(items: list, reminder_id: str) -> int:
    return next(
        (index for index, item in enumerate(items) if isinstance(item, dict) and item.get("id") == reminder_id),
        -1,
    )


def reminder_equipment_exists(state: dict, reminder: dict) -> bool:
    equipment_id = reminder.get("equipmentId")
    return any(item.get("id") == equipment_id for item in state.get("equipment", []) if isinstance(item, dict))


def clear_ui_state(state: dict) -> None:
    state["sessionUserId"] = None
    state["modal"] = None
    state["toast"] = ""
