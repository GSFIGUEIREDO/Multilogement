from __future__ import annotations

from http import HTTPStatus
from typing import Any, Callable

from backend.auth_services import SessionService
from backend.database import row_get
from backend.security import filter_state_for_user, sanitize_state_for_storage
from backend.state_compatibility import (
    apply_state_changes,
    changed_collection_keys,
    duplicate_user_email,
    merge_shared_state,
    stamp_changed_items,
)


def handle_save_state(
    handler: Any,
    *,
    db: Callable,
    get_state: Callable,
    save_state: Callable,
    sync_users: Callable,
    sync_relational_tables_safely: Callable,
) -> None:
    user = SessionService().read(handler.headers.get("Cookie"))
    if not user:
        handler.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
        return
    if row_get(user, "role") not in {"administrateur", "equipe_interne"}:
        handler.json_response({"error": "Droits insuffisants pour la sauvegarde globale."}, HTTPStatus.FORBIDDEN)
        return

    payload = handler.read_json()
    state = payload.get("state")
    changes = payload.get("changes")
    if not isinstance(state, dict) and not isinstance(changes, dict):
        handler.json_response({"error": "Invalid state"}, HTTPStatus.BAD_REQUEST)
        return

    with db() as connection:
        current_state = get_state(connection, lock=True)
        if isinstance(changes, dict):
            merged_state = apply_state_changes(current_state, changes)
            sync_keys = changed_collection_keys(changes)
        else:
            state["sessionUserId"] = None
            state["modal"] = None
            state["toast"] = ""
            merged_state = merge_shared_state(current_state, state)
            sync_keys = None

        merged_state["sessionUserId"] = None
        merged_state["modal"] = None
        merged_state["toast"] = ""
        stamp_changed_items(merged_state, changes if isinstance(changes, dict) else None)
        merged_state = sanitize_state_for_storage(merged_state)
        duplicate_email = duplicate_user_email(merged_state)
        if duplicate_email:
            handler.json_response({"error": f"Un utilisateur existe deja avec le courriel {duplicate_email}."}, HTTPStatus.CONFLICT)
            return
        save_state(connection, merged_state)
        sync_users(connection, merged_state)

    if sync_keys or sync_keys is None:
        sync_relational_tables_safely(merged_state, sync_keys)
    handler.json_response({"ok": True, "state": filter_state_for_user(merged_state, user)})
