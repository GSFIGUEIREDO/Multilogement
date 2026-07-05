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


INTERNAL_RECOMMENDATION_FIELDS = {
    "type",
    "description",
    "priority",
    "part",
    "time",
    "status",
    "price",
    "delay",
    "clientMessage",
    "internalNote",
    "createdAt",
    "sentAt",
    "decisionAt",
    "reviewedBy",
    "decidedBy",
    "workOrderId",
}


def normalize_intervention_id(intervention_id: str) -> str:
    value = str(intervention_id or "").strip()
    if not value:
        raise ApplicationError("Intervention invalide.")
    return value


def normalize_recommendation_payload(recommendation: dict) -> dict:
    if not isinstance(recommendation, dict):
        raise ApplicationError("Recommandation invalide.")
    return dict(recommendation)


def find_intervention_index(items: list, intervention_id: str) -> int:
    return next(
        (index for index, item in enumerate(items) if isinstance(item, dict) and item.get("id") == intervention_id),
        -1,
    )


def is_client(current_user_row: Any) -> bool:
    return row_get(current_user_row, "role") == "client"


def require_visible_intervention(state: dict, current_user_row: Any, intervention_id: str) -> None:
    visible = filter_state_for_user(state, current_user_row)
    if not any(item.get("id") == intervention_id for item in visible.get("interventions", []) if isinstance(item, dict)):
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)


def merge_messages(existing_messages: Any, incoming_messages: Any, author_role: str) -> list[dict]:
    messages = copy.deepcopy(existing_messages if isinstance(existing_messages, list) else [])
    known = {
        (str(message.get("authorRole")), str(message.get("text")))
        for message in messages
        if isinstance(message, dict)
    }
    for message in incoming_messages if isinstance(incoming_messages, list) else []:
        if not isinstance(message, dict) or message.get("authorRole") != author_role:
            continue
        text = str(message.get("text") or "").strip()
        if not text or (author_role, text) in known:
            continue
        safe_message = {
            "id": message.get("id") or "",
            "authorRole": author_role,
            "authorName": message.get("authorName") or ("Client" if author_role == "client" else "Equipe interne"),
            "text": text,
            "createdAt": message.get("createdAt") or "",
        }
        messages.append(safe_message)
        known.add((author_role, text))
    return messages


def apply_client_recommendation_update(
    state: dict,
    current_user_row: Any,
    intervention_id: str,
    incoming_recommendation: dict,
) -> dict:
    requester = requester_from_state(state, current_user_row)
    if requester.get("role") != "client" or not has_client_right(requester, "recommendations"):
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)
    require_visible_intervention(state, current_user_row, intervention_id)

    interventions = state.setdefault("interventions", [])
    index = find_intervention_index(interventions, intervention_id)
    if index < 0:
        raise ApplicationError("Intervention introuvable.", HTTPStatus.NOT_FOUND)

    existing = interventions[index]
    recommendation = existing.get("recommendation")
    if not isinstance(recommendation, dict) or recommendation.get("status") != "envoyee":
        raise ApplicationError("Cette recommandation ne peut pas etre modifiee.", HTTPStatus.FORBIDDEN)

    requested_status = incoming_recommendation.get("status")
    allowed_statuses = {"information_demandee"}
    if has_client_right(requester, "recommendation_approve"):
        allowed_statuses.update({"approuvee", "refusee"})
    if requested_status not in allowed_statuses:
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

    safe_recommendation = copy.deepcopy(recommendation)
    safe_recommendation["status"] = requested_status
    safe_recommendation["decisionAt"] = incoming_recommendation.get("decisionAt") or safe_recommendation.get("decisionAt") or ""
    safe_recommendation["decidedBy"] = requester.get("id") or ""
    if "clientComment" in incoming_recommendation:
        safe_recommendation["clientComment"] = incoming_recommendation.get("clientComment") or ""
    safe_recommendation["messages"] = merge_messages(
        safe_recommendation.get("messages", []),
        incoming_recommendation.get("messages", []),
        "client",
    )

    item = copy.deepcopy(existing)
    item["recommendation"] = safe_recommendation
    return item


def apply_internal_recommendation_review(
    state: dict,
    current_user_row: Any,
    intervention_id: str,
    incoming_recommendation: dict,
) -> dict:
    if is_client(current_user_row):
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

    interventions = state.setdefault("interventions", [])
    index = find_intervention_index(interventions, intervention_id)
    if index < 0:
        raise ApplicationError("Intervention introuvable.", HTTPStatus.NOT_FOUND)

    existing = interventions[index]
    try:
        require_can_save_collection(state, current_user_row, "interventions", existing)
    except AuthorizationError as error:
        raise ApplicationError(str(error), HTTPStatus.FORBIDDEN)

    if incoming_recommendation.get("status") == "envoyee" and (
        not str(incoming_recommendation.get("price") or "").strip()
        or not str(incoming_recommendation.get("delay") or "").strip()
    ):
        raise ApplicationError("Ajoutez un prix et un delai avant d'envoyer au client.")

    existing_recommendation = existing.get("recommendation") if isinstance(existing.get("recommendation"), dict) else {}
    safe_recommendation = copy.deepcopy(existing_recommendation)
    for key in INTERNAL_RECOMMENDATION_FIELDS:
        if key in incoming_recommendation:
            safe_recommendation[key] = incoming_recommendation.get(key)
    safe_recommendation["messages"] = merge_messages(
        safe_recommendation.get("messages", []),
        incoming_recommendation.get("messages", []),
        "interne",
    )

    item = copy.deepcopy(existing)
    item["recommendation"] = safe_recommendation
    return item


def clear_ui_state(state: dict) -> None:
    state["sessionUserId"] = None
    state["modal"] = None
    state["toast"] = ""
