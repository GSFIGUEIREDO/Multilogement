from __future__ import annotations

from http import HTTPStatus
from typing import Any


GET_ROUTES = {
    "/api/session": "handle_session",
    "/api/local-file": "handle_local_file",
}

POST_ROUTES = {
    "/api/login": "handle_login",
    "/api/signup": "handle_signup",
    "/api/password-reset-request": "handle_password_reset_request",
    "/api/password-reset-confirm": "handle_password_reset_confirm",
    "/api/logout": "handle_logout",
    "/api/file-upload": "handle_file_upload",
    "/api/file-url": "handle_file_url",
    "/api/file-delete": "handle_file_delete",
    "/api/state": "handle_save_state",
    "/api/equipment": "handle_save_equipment",
    "/api/user": "handle_save_user",
    "/api/user-delete": "handle_delete_user",
    "/api/building": "handle_save_building",
    "/api/apartment": "handle_save_apartment",
    "/api/ticket": "handle_save_ticket",
    "/api/work-order": "handle_save_work_order",
    "/api/intervention": "handle_save_intervention",
    "/api/field-intervention": "handle_save_field_intervention",
    "/api/reminder": "handle_save_reminder",
    "/api/reminder-delete": "handle_delete_reminder",
    "/api/report-context": "handle_report_context",
    "/api/setting-item": "handle_save_setting_item",
    "/api/setting-item-delete": "handle_delete_setting_item",
}


def dispatch_get(handler: Any, parsed: Any, *, database_name: str) -> None:
    if parsed.path == "/api/health":
        handler.json_response({"ok": True, "database": database_name})
        return
    method_name = GET_ROUTES.get(parsed.path)
    if method_name == "handle_local_file":
        getattr(handler, method_name)(parsed)
        return
    if method_name:
        getattr(handler, method_name)()
        return
    handler.serve_static(parsed.path)


def dispatch_post(handler: Any, parsed: Any) -> None:
    method_name = POST_ROUTES.get(parsed.path)
    if method_name:
        getattr(handler, method_name)()
        return
    handler.json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)
