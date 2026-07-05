from __future__ import annotations

import copy
from http import HTTPStatus
from typing import Any

from backend.database import row_get
from backend.security import (
    AuthorizationError,
    filter_state_for_user,
    has_client_right,
    requester_from_state,
    require_can_save_collection,
)
from src.climaparc.shared.domain.errors import ApplicationError


def normalize_intervention_payload(intervention_payload: dict) -> dict:
    if not isinstance(intervention_payload, dict) or not intervention_payload.get("id"):
        raise ApplicationError("Intervention invalide.")
    return dict(intervention_payload)


def require_can_save_intervention(state: dict, current_user_row: Any, intervention: dict) -> None:
    try:
        require_can_save_collection(state, current_user_row, "interventions", intervention)
    except AuthorizationError as error:
        raise ApplicationError(str(error), HTTPStatus.FORBIDDEN)


def find_intervention_index(items: list, intervention_id: str) -> int:
    return next(
        (index for index, item in enumerate(items) if isinstance(item, dict) and item.get("id") == intervention_id),
        -1,
    )


def is_client(current_user_row: Any) -> bool:
    return row_get(current_user_row, "role") == "client"


def merge_client_recommendation_messages(existing_messages: Any, incoming_messages: Any) -> list[dict]:
    messages = copy.deepcopy(existing_messages if isinstance(existing_messages, list) else [])
    known = {
        (str(message.get("authorRole")), str(message.get("text")))
        for message in messages
        if isinstance(message, dict)
    }
    for message in incoming_messages if isinstance(incoming_messages, list) else []:
        if not isinstance(message, dict) or message.get("authorRole") != "client":
            continue
        text = str(message.get("text") or "").strip()
        if not text or ("client", text) in known:
            continue
        safe_message = {
            "id": message.get("id") or "",
            "authorRole": "client",
            "authorName": message.get("authorName") or "Client",
            "text": text,
            "createdAt": message.get("createdAt") or "",
        }
        messages.append(safe_message)
        known.add(("client", text))
    return messages


def client_recommendation_update(state: dict, current_user_row: Any, incoming_intervention: dict) -> dict:
    requester = requester_from_state(state, current_user_row)
    if not has_client_right(requester, "recommendations"):
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

    visible = filter_state_for_user(state, current_user_row)
    if not any(item.get("id") == incoming_intervention.get("id") for item in visible.get("interventions", []) if isinstance(item, dict)):
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

    interventions = state.setdefault("interventions", [])
    index = find_intervention_index(interventions, incoming_intervention["id"])
    if index < 0:
        raise ApplicationError("Intervention introuvable.", HTTPStatus.NOT_FOUND)

    existing = interventions[index]
    recommendation = existing.get("recommendation")
    incoming = incoming_intervention.get("recommendation") if isinstance(incoming_intervention.get("recommendation"), dict) else {}
    if not isinstance(recommendation, dict) or recommendation.get("status") != "envoyee":
        raise ApplicationError("Cette recommandation ne peut pas etre modifiee.", HTTPStatus.FORBIDDEN)

    requested_status = incoming.get("status")
    allowed_statuses = {"information_demandee"}
    if has_client_right(requester, "recommendation_approve"):
        allowed_statuses.update({"approuvee", "refusee"})
    if requested_status not in allowed_statuses:
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

    safe_recommendation = copy.deepcopy(recommendation)
    safe_recommendation["status"] = requested_status
    safe_recommendation["decisionAt"] = incoming.get("decisionAt") or safe_recommendation.get("decisionAt") or ""
    safe_recommendation["decidedBy"] = requester.get("id") or ""
    if "clientComment" in incoming:
        safe_recommendation["clientComment"] = incoming.get("clientComment") or ""
    safe_recommendation["messages"] = merge_client_recommendation_messages(
        safe_recommendation.get("messages", []),
        incoming.get("messages", []),
    )

    item = copy.deepcopy(existing)
    item["recommendation"] = safe_recommendation
    return item


def clear_ui_state(state: dict) -> None:
    state["sessionUserId"] = None
    state["modal"] = None
    state["toast"] = ""

