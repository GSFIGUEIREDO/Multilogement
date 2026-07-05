from __future__ import annotations

from http import HTTPStatus
from typing import Any

from backend.security import AuthorizationError, require_can_save_collection
from src.climaparc.shared.domain.errors import ApplicationError


def normalize_ticket_payload(ticket_payload: dict) -> dict:
    if not isinstance(ticket_payload, dict) or not ticket_payload.get("id"):
        raise ApplicationError("Demande client invalide.")
    return dict(ticket_payload)


def require_can_save_ticket(state: dict, current_user_row: Any, ticket: dict) -> None:
    try:
        require_can_save_collection(state, current_user_row, "tickets", ticket)
    except AuthorizationError as error:
        raise ApplicationError(str(error), HTTPStatus.FORBIDDEN)


def find_ticket_index(items: list, ticket_id: str) -> int:
    return next(
        (index for index, item in enumerate(items) if isinstance(item, dict) and item.get("id") == ticket_id),
        -1,
    )


def clear_ui_state(state: dict) -> None:
    state["sessionUserId"] = None
    state["modal"] = None
    state["toast"] = ""

