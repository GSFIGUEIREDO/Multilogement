from __future__ import annotations

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from backend.bootstrap import (
    bootstrap_password_for_user as bootstrap_password_for_user_impl,
    ensure_bootstrap_state as ensure_bootstrap_state_impl,
    sync_users as sync_users_impl,
)
from backend.database import DB_PATH, USE_POSTGRES, connect as db, execute
from backend.legacy_http import LegacyHttpMixin
from backend.legacy_routes import dispatch_get, dispatch_post
from backend.legacy_auth_handlers import (
    handle_login as handle_legacy_login,
    handle_logout as handle_legacy_logout,
    handle_password_reset_confirm as handle_legacy_password_reset_confirm,
    handle_password_reset_request as handle_legacy_password_reset_request,
    handle_session as handle_legacy_session,
    handle_signup as handle_legacy_signup,
)
from backend.legacy_file_handlers import (
    handle_file_delete as handle_legacy_file_delete,
    handle_file_upload as handle_legacy_file_upload,
    handle_file_url as handle_legacy_file_url,
    handle_local_file as handle_legacy_local_file,
)
from backend.legacy_domain_handlers import (
    handle_delete_reminder as handle_legacy_delete_reminder,
    handle_delete_setting_item as handle_legacy_delete_setting_item,
    handle_delete_user as handle_legacy_delete_user,
    handle_report_context as handle_legacy_report_context,
    handle_save_apartment as handle_legacy_save_apartment,
    handle_save_building as handle_legacy_save_building,
    handle_save_equipment as handle_legacy_save_equipment,
    handle_save_intervention as handle_legacy_save_intervention,
    handle_save_reminder as handle_legacy_save_reminder,
    handle_save_setting_item as handle_legacy_save_setting_item,
    handle_save_ticket as handle_legacy_save_ticket,
    handle_save_user as handle_legacy_save_user,
    handle_save_work_order as handle_legacy_save_work_order,
)
from backend.legacy_state_handlers import handle_save_state as handle_legacy_save_state
from backend.repositories import StateRepository
from backend.schema import init_db as init_database_schema
from backend.sync_services import (
    sync_relational_tables as sync_relational_tables_external,
    sync_relational_tables_safely as sync_relational_tables_safely_external,
)

ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("CLIMAPARC_HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT") or os.environ.get("CLIMAPARC_PORT", "8000"))
APP_BASE_URL = os.environ.get("APP_BASE_URL", "").rstrip("/")


def init_db() -> None:
    init_database_schema()


def public_base_url(headers) -> str:
    if APP_BASE_URL:
        return APP_BASE_URL
    host = headers.get("Host", f"{HOST}:{PORT}")
    scheme = headers.get("X-Forwarded-Proto", "https" if "onrender.com" in host else "http")
    return f"{scheme}://{host}".rstrip("/")


def get_state(connection, lock: bool = False) -> dict | None:
    return StateRepository().get(connection, lock)


def save_state(connection, state: dict) -> None:
    StateRepository().save(connection, state)


def bootstrap_password_for_user(user: dict) -> str:
    return bootstrap_password_for_user_impl(user)


def sync_users(connection, state: dict) -> None:
    sync_users_impl(connection, state)


def sync_relational_tables(connection, state: dict, collection_keys: set[str] | None = None) -> None:
    sync_relational_tables_external(connection, state, collection_keys)


def sync_relational_tables_safely(state: dict, collection_keys: set[str] | None = None) -> None:
    sync_relational_tables_safely_external(state, collection_keys)


def ensure_bootstrap_state(seed: dict | None) -> dict:
    return ensure_bootstrap_state_impl(
        seed,
        db=db,
        get_state=get_state,
        save_state=save_state,
        sync_relational_tables_safely=sync_relational_tables_safely,
    )


class Handler(LegacyHttpMixin, BaseHTTPRequestHandler):
    server_version = "ClimaParc/1.0"
    static_root = ROOT

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        dispatch_get(self, parsed, database_name="postgres" if USE_POSTGRES else "sqlite")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        dispatch_post(self, parsed)

    def handle_session(self) -> None:
        handle_legacy_session(self, db=db, get_state=get_state)

    def handle_login(self) -> None:
        handle_legacy_login(self, ensure_bootstrap_state=ensure_bootstrap_state)

    def handle_signup(self) -> None:
        handle_legacy_signup(
            self,
            ensure_bootstrap_state=ensure_bootstrap_state,
            sync_relational_tables_safely=sync_relational_tables_safely,
        )

    def handle_password_reset_request(self) -> None:
        handle_legacy_password_reset_request(
            self,
            ensure_bootstrap_state=ensure_bootstrap_state,
            public_base_url=public_base_url,
            sync_relational_tables_safely=sync_relational_tables_safely,
        )

    def handle_password_reset_confirm(self) -> None:
        handle_legacy_password_reset_confirm(
            self,
            ensure_bootstrap_state=ensure_bootstrap_state,
            sync_relational_tables_safely=sync_relational_tables_safely,
        )

    def handle_logout(self) -> None:
        handle_legacy_logout(self)

    def handle_file_upload(self) -> None:
        handle_legacy_file_upload(self)

    def handle_file_url(self) -> None:
        handle_legacy_file_url(self)

    def handle_file_delete(self) -> None:
        handle_legacy_file_delete(self)

    def handle_save_state(self) -> None:
        handle_legacy_save_state(
            self,
            db=db,
            get_state=get_state,
            save_state=save_state,
            sync_users=sync_users,
            sync_relational_tables_safely=sync_relational_tables_safely,
        )

    def handle_save_equipment(self) -> None:
        handle_legacy_save_equipment(self, sync_relational_tables_safely=sync_relational_tables_safely)

    def handle_save_user(self) -> None:
        handle_legacy_save_user(self)

    def handle_delete_user(self) -> None:
        handle_legacy_delete_user(self)

    def handle_save_building(self) -> None:
        handle_legacy_save_building(self, sync_relational_tables_safely=sync_relational_tables_safely)

    def handle_save_apartment(self) -> None:
        handle_legacy_save_apartment(self, sync_relational_tables_safely=sync_relational_tables_safely)

    def handle_save_ticket(self) -> None:
        handle_legacy_save_ticket(self, sync_relational_tables_safely=sync_relational_tables_safely)

    def handle_save_work_order(self) -> None:
        handle_legacy_save_work_order(self, sync_relational_tables_safely=sync_relational_tables_safely)

    def handle_save_intervention(self) -> None:
        handle_legacy_save_intervention(self, sync_relational_tables_safely=sync_relational_tables_safely)

    def handle_save_reminder(self) -> None:
        handle_legacy_save_reminder(self, sync_relational_tables_safely=sync_relational_tables_safely)

    def handle_delete_reminder(self) -> None:
        handle_legacy_delete_reminder(self)

    def handle_report_context(self) -> None:
        handle_legacy_report_context(self)

    def handle_save_setting_item(self) -> None:
        handle_legacy_save_setting_item(self, sync_relational_tables_safely=sync_relational_tables_safely)

    def handle_delete_setting_item(self) -> None:
        handle_legacy_delete_setting_item(self, sync_relational_tables_safely=sync_relational_tables_safely)

    def handle_local_file(self, parsed) -> None:
        handle_legacy_local_file(self, parsed, db=db, get_state=get_state)


def main() -> None:
    init_db()
    database_name = "Supabase/Postgres" if USE_POSTGRES else f"SQLite ({DB_PATH.name})"
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ClimaParc online sur http://{HOST}:{PORT} avec {database_name}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
