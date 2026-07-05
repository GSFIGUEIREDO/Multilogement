from __future__ import annotations

from http import HTTPStatus
from typing import Any

from backend.security import AuthorizationError, require_can_save_collection
from src.climaparc.shared.domain.errors import ApplicationError


def normalize_work_order_payload(work_order_payload: dict) -> dict:
    if not isinstance(work_order_payload, dict) or not work_order_payload.get("id"):
        raise ApplicationError("Bon de travail invalide.")
    return dict(work_order_payload)


def require_can_save_work_order(state: dict, current_user_row: Any, work_order: dict) -> None:
    try:
        require_can_save_collection(state, current_user_row, "workOrders", work_order)
    except AuthorizationError as error:
        raise ApplicationError(str(error), HTTPStatus.FORBIDDEN)


def find_work_order_index(items: list, work_order_id: str) -> int:
    return next(
        (index for index, item in enumerate(items) if isinstance(item, dict) and item.get("id") == work_order_id),
        -1,
    )


def clear_ui_state(state: dict) -> None:
    state["sessionUserId"] = None
    state["modal"] = None
    state["toast"] = ""

