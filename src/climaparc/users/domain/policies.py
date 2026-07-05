from __future__ import annotations

from http import HTTPStatus
from typing import Any

from backend.database import row_get
from backend.security import has_client_right
from src.climaparc.shared.domain.errors import ApplicationError


def requester_from_state_or_session(users: list, current_user_row: Any) -> dict:
    requester_id = row_get(current_user_row, "id")
    requester = next((item for item in users if isinstance(item, dict) and item.get("id") == requester_id), None)
    if requester:
        return requester
    return {
        "id": requester_id,
        "role": row_get(current_user_row, "role"),
        "clientId": row_get(current_user_row, "client_id"),
    }


def require_user_manager(requester: dict) -> None:
    requester_role = requester.get("role")
    if requester_role == "client":
        if not has_client_right(requester, "users"):
            raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)
        return
    if requester_role not in {"administrateur", "equipe_interne"}:
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)


def normalize_user_payload(user_payload: dict) -> dict:
    if not isinstance(user_payload, dict) or not user_payload.get("id"):
        raise ApplicationError("Utilisateur invalide.")
    user = dict(user_payload)
    user["email"] = str(user.get("email", "")).strip().lower()
    if not user["email"] or not user.get("name") or not user.get("role"):
        raise ApplicationError("Nom, courriel et role sont obligatoires.")
    return user


def prepare_user_for_requester(user: dict, requester: dict) -> dict:
    prepared = dict(user)
    if requester.get("role") == "client":
        prepared["role"] = "client"
        prepared["clientId"] = requester.get("clientId")
    return prepared


def ensure_client_can_update_target(requester: dict, existing_user: dict) -> None:
    if requester.get("role") != "client":
        return
    if existing_user.get("clientId") != requester.get("clientId"):
        raise ApplicationError("Vous ne pouvez modifier que les utilisateurs de votre client.", HTTPStatus.FORBIDDEN)


def ensure_client_can_delete_target(requester: dict, target: dict) -> None:
    if requester.get("role") != "client":
        return
    if target.get("role") != "client" or target.get("clientId") != requester.get("clientId"):
        raise ApplicationError("Vous ne pouvez supprimer que les utilisateurs de votre client.", HTTPStatus.FORBIDDEN)


def find_user_index(users: list, user_id: str) -> int:
    return next(
        (index for index, item in enumerate(users) if isinstance(item, dict) and item.get("id") == user_id),
        -1,
    )


def ensure_unique_email(users: list, user: dict) -> None:
    duplicate_email = next(
        (
            item for item in users
            if isinstance(item, dict)
            and str(item.get("email", "")).strip().lower() == user["email"]
            and item.get("id") != user["id"]
        ),
        None,
    )
    if duplicate_email:
        raise ApplicationError(f"Un utilisateur existe deja avec le courriel {user['email']}.", HTTPStatus.CONFLICT)


def clear_ui_state(state: dict) -> None:
    state["sessionUserId"] = None
    state["modal"] = None
    state["toast"] = ""

