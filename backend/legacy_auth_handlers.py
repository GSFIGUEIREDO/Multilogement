from __future__ import annotations

import json
from http import HTTPStatus
from typing import Any, Callable

from backend.auth_services import AuthService, AuthServiceError, PasswordResetService, SessionService
from backend.security import filter_state_for_user, public_user_from_row
from backend.state_compatibility import MERGE_BY_ID_KEYS


def handle_session(handler: Any, *, db: Callable, get_state: Callable) -> None:
    user = SessionService().read(handler.headers.get("Cookie"))
    if not user:
        handler.json_response({"authenticated": False}, HTTPStatus.UNAUTHORIZED)
        return
    with db() as connection:
        state = get_state(connection)
    handler.json_response({
        "authenticated": True,
        "user": public_user_from_row(user),
        "state": filter_state_for_user(state, user),
    })


def handle_login(handler: Any, *, ensure_bootstrap_state: Callable) -> None:
    payload = handler.read_json()
    state = ensure_bootstrap_state(payload.get("seed"))
    try:
        result = AuthService().login(payload.get("email", ""), str(payload.get("password", "")), state)
    except AuthServiceError as error:
        handler.json_response({"error": error.message}, error.status)
        return
    _session_response(handler, result["token"], {"user": result["user"], "state": result["state"]})


def handle_signup(
    handler: Any,
    *,
    ensure_bootstrap_state: Callable,
    sync_relational_tables_safely: Callable,
) -> None:
    payload = handler.read_json()
    state = ensure_bootstrap_state(payload.get("seed"))
    try:
        result = AuthService().signup(payload, state)
    except AuthServiceError as error:
        handler.json_response({"error": error.message}, error.status)
        return
    _session_response(
        handler,
        result["token"],
        {"user": result["user"], "state": signup_response_state(result["state"], result["client"], result["user"])},
    )


def handle_password_reset_request(
    handler: Any,
    *,
    ensure_bootstrap_state: Callable,
    public_base_url: Callable,
    sync_relational_tables_safely: Callable,
) -> None:
    payload = handler.read_json()
    state = ensure_bootstrap_state(payload.get("seed"))
    result = PasswordResetService().request_reset(payload.get("email", ""), public_base_url(handler.headers), state)
    handler.json_response({"ok": True, "emailSent": result["emailSent"], "mailConfigured": result["mailConfigured"]})


def handle_password_reset_confirm(
    handler: Any,
    *,
    ensure_bootstrap_state: Callable,
    sync_relational_tables_safely: Callable,
) -> None:
    payload = handler.read_json()
    state = ensure_bootstrap_state(payload.get("seed"))
    try:
        result = PasswordResetService().confirm_reset(
            payload.get("token", ""),
            str(payload.get("password", "")),
            str(payload.get("confirmPassword", "")),
            state,
        )
    except AuthServiceError as error:
        handler.json_response({"error": error.message}, error.status)
        return
    handler.json_response({"ok": True})


def handle_logout(handler: Any) -> None:
    SessionService().logout(handler.headers.get("Cookie"))
    body = b'{"ok": true}'
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Set-Cookie", "climaparc_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0")
    handler.end_headers()
    handler.wfile.write(body)


def signup_response_state(state: dict, client: dict, user: dict) -> dict:
    response_state = {key: [] for key in MERGE_BY_ID_KEYS}
    response_state.update({
        "sessionUserId": None,
        "modal": None,
        "toast": "",
        "clients": [client],
        "users": [user],
        "serviceTypes": state.get("serviceTypes", []),
        "interventionTypes": state.get("interventionTypes", []),
        "formTemplates": state.get("formTemplates", []),
        "roleDefinitions": state.get("roleDefinitions", []),
        "dataFields": state.get("dataFields", []),
        "reportFilters": state.get("reportFilters", {}),
        "filters": state.get("filters", {}),
        "workOrderFilters": state.get("workOrderFilters", {}),
    })
    return response_state


def _session_response(handler: Any, token: str, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Set-Cookie", f"climaparc_session={token}; HttpOnly; Path=/; SameSite=Lax")
    handler.end_headers()
    handler.wfile.write(body)
