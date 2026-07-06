from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import os
import secrets
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from email.parser import BytesParser
from email.policy import default as email_policy
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from backend.auth_services import SessionService
from backend.file_storage import FileStorageError, local_file_path, migrate_legacy_data_urls
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
)
from backend.legacy_state_handlers import handle_save_state as handle_legacy_save_state
from backend.repositories import hydrate_state_from_payload_tables
from backend.schema import init_db as init_database_schema
from backend.security import filter_state_for_user, sanitize_state_for_storage
from backend.sync_services import (
    sync_relational_tables as sync_relational_tables_external,
    sync_relational_tables_safely as sync_relational_tables_safely_external,
)
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.places.presentation.dependencies import (
    get_create_apartment_use_case,
    get_create_building_use_case,
    get_place_lookup_repository,
    get_update_apartment_use_case,
    get_update_building_use_case,
)
from src.climaparc.places.presentation.dispatch import save_apartment_with_use_cases, save_building_with_use_cases
from src.climaparc.equipment.presentation.dependencies import (
    get_create_equipment_use_case,
    get_equipment_lookup_repository,
    get_update_equipment_use_case,
)
from src.climaparc.equipment.presentation.dispatch import save_equipment_with_use_cases
from src.climaparc.interventions.presentation.dependencies import (
    get_create_intervention_use_case,
    get_intervention_lookup_repository,
    get_update_intervention_use_case,
)
from src.climaparc.interventions.presentation.dispatch import save_intervention_with_use_cases
from src.climaparc.reminders.presentation.dependencies import (
    get_delete_reminder_use_case,
    get_save_reminder_batch_use_case,
    get_save_reminder_use_case,
)
from src.climaparc.reminders.presentation.dispatch import (
    delete_reminder_with_use_case,
    save_reminder_batch_with_use_case,
    save_reminder_with_use_case,
)
from src.climaparc.reports.presentation.dependencies import get_report_context_use_case
from src.climaparc.reports.presentation.dispatch import get_report_context_with_use_case
from src.climaparc.settings.presentation.dependencies import (
    get_delete_setting_item_use_case,
    get_save_setting_item_use_case,
)
from src.climaparc.settings.presentation.dispatch import (
    delete_setting_item_with_use_case,
    save_setting_item_with_use_case,
)
from src.climaparc.tickets.presentation.dependencies import (
    get_create_ticket_use_case,
    get_ticket_lookup_repository,
    get_update_ticket_use_case,
)
from src.climaparc.tickets.presentation.dispatch import save_ticket_with_use_cases
from src.climaparc.users.application.commands import DeleteUserCommand
from src.climaparc.users.presentation.dependencies import (
    get_create_user_use_case,
    get_delete_user_use_case,
    get_update_user_use_case,
    get_user_lookup_repository,
)
from src.climaparc.users.presentation.dispatch import save_user_with_use_cases
from src.climaparc.work_orders.presentation.dependencies import (
    get_create_work_order_use_case,
    get_update_work_order_use_case,
    get_work_order_lookup_repository,
)
from src.climaparc.work_orders.presentation.dispatch import save_work_order_with_use_cases


ROOT = Path(__file__).resolve().parent
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DATABASE_URL")
DB_PATH = Path(os.environ.get("CLIMAPARC_DB", ROOT / "climaparc.sqlite3"))
SESSION_TTL_SECONDS = int(os.environ.get("CLIMAPARC_SESSION_TTL", "28800"))
HOST = os.environ.get("CLIMAPARC_HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT") or os.environ.get("CLIMAPARC_PORT", "8000"))
USE_POSTGRES = bool(DATABASE_URL)
APP_BASE_URL = os.environ.get("APP_BASE_URL", "").rstrip("/")

if USE_POSTGRES:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Jsonb


def db():
    if USE_POSTGRES:
        return psycopg.connect(DATABASE_URL, row_factory=dict_row, prepare_threshold=None)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def sql(statement: str) -> str:
    return statement.replace("?", "%s") if USE_POSTGRES else statement


def execute(connection, statement: str, params: tuple[Any, ...] = ()):
    return connection.execute(sql(statement), params)


def now_value():
    if USE_POSTGRES:
        return datetime.now(timezone.utc)
    return int(time.time())


def expires_value():
    if USE_POSTGRES:
        return datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
    return int(time.time()) + SESSION_TTL_SECONDS


def row_get(row, key: str):
    return row[key]


def json_db_value(value: Any):
    if USE_POSTGRES:
        return Jsonb(value)
    return json.dumps(value, ensure_ascii=False)


def init_db() -> None:
    init_database_schema()


def password_hash(password: str, salt: str | None = None) -> tuple[str, str]:
    raw_salt = base64.b64decode(salt) if salt else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), raw_salt, 120_000)
    return base64.b64encode(digest).decode("ascii"), base64.b64encode(raw_salt).decode("ascii")


def server_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def public_base_url(headers) -> str:
    if APP_BASE_URL:
        return APP_BASE_URL
    host = headers.get("Host", f"{HOST}:{PORT}")
    scheme = headers.get("X-Forwarded-Proto", "https" if "onrender.com" in host else "http")
    return f"{scheme}://{host}".rstrip("/")


def get_state(connection, lock: bool = False) -> dict | None:
    statement = "select state_json from climaparc_state where id = 1"
    if USE_POSTGRES and lock:
        statement += " for update"
    row = execute(connection, statement).fetchone()
    if not row:
        return None
    value = row_get(row, "state_json")
    state = json.loads(value) if isinstance(value, str) else value
    return hydrate_state_from_payload_tables(connection, state)


def save_state(connection, state: dict) -> None:
    state = sanitize_state_for_storage(state)
    execute(
        connection,
        """
        insert into climaparc_state (id, state_json, updated_at)
        values (1, ?, ?)
        on conflict(id) do update set state_json = excluded.state_json, updated_at = excluded.updated_at
        """,
        (json_db_value(state), now_value()),
    )


def bootstrap_password_for_user(user: dict) -> str:
    role = str(user.get("role") or "").upper().replace("-", "_")
    explicit = os.environ.get(f"CLIMAPARC_BOOTSTRAP_{role}_PASSWORD")
    if explicit:
        return explicit
    return os.environ.get("CLIMAPARC_BOOTSTRAP_DEFAULT_PASSWORD", "")


def sync_users(connection, state: dict) -> None:
    state_user_ids = {
        str(user.get("id"))
        for user in state.get("users", [])
        if isinstance(user, dict) and user.get("id")
    }
    if not state_user_ids:
        return
    existing_users = execute(connection, "select id from climaparc_users").fetchall()
    for row in existing_users:
        user_id = str(row_get(row, "id"))
        if user_id not in state_user_ids:
            execute(connection, "delete from climaparc_sessions where user_id = ?", (user_id,))
            execute(connection, "delete from climaparc_users where id = ?", (user_id,))
    for user in state.get("users", []):
        password = str(user.get("password") or "")
        email = str(user["email"]).lower()
        existing_email = execute(connection, "select id from climaparc_users where email = ?", (email,)).fetchone()
        if existing_email and row_get(existing_email, "id") != user["id"]:
            execute(connection, "delete from climaparc_sessions where user_id = ?", (row_get(existing_email, "id"),))
            execute(connection, "delete from climaparc_users where id = ?", (row_get(existing_email, "id"),))
        existing = execute(connection, "select password_hash, salt from climaparc_users where id = ?", (user["id"],)).fetchone()
        if not password and not existing:
            password = bootstrap_password_for_user(user)
        if password:
            digest, salt = password_hash(password, row_get(existing, "salt") if existing else None)
        elif existing:
            digest, salt = row_get(existing, "password_hash"), row_get(existing, "salt")
        else:
            continue
        execute(
            connection,
            """
            insert into climaparc_users (id, email, name, role, client_id, password_hash, salt, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
              email = excluded.email,
              name = excluded.name,
              role = excluded.role,
              client_id = excluded.client_id,
              password_hash = excluded.password_hash,
              salt = excluded.salt,
              updated_at = excluded.updated_at
            """,
            (
                user["id"],
                email,
                user.get("name", ""),
                user.get("role", ""),
                user.get("clientId"),
                digest,
                salt,
                now_value(),
            ),
        )


def sync_relational_tables(connection, state: dict, collection_keys: set[str] | None = None) -> None:
    sync_relational_tables_external(connection, state, collection_keys)


def sync_relational_tables_safely(state: dict, collection_keys: set[str] | None = None) -> None:
    sync_relational_tables_safely_external(state, collection_keys)


def ensure_bootstrap_state(seed: dict | None) -> dict:
    state: dict | None = None
    with db() as connection:
        state = get_state(connection)
        if state is None:
            if not seed:
                raise ValueError("Initial state is required")
            state = seed
            state["sessionUserId"] = None
            state["modal"] = None
            state["toast"] = ""
            save_state(connection, state)
            sync_users(connection, state)
            state = sanitize_state_for_storage(state)
        if state is not None:
            migrated, warnings = migrate_legacy_data_urls(state)
            for warning in warnings:
                print(warning)
            if migrated:
                save_state(connection, state)
    if state:
        sync_relational_tables_safely(state)
    return state


def new_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(8)}"


class Handler(BaseHTTPRequestHandler):
    server_version = "ClimaParc/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.json_response({"ok": True, "database": "postgres" if USE_POSTGRES else "sqlite"})
            return
        if parsed.path == "/api/session":
            self.handle_session()
            return
        if parsed.path == "/api/local-file":
            self.handle_local_file(parsed)
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/login":
            self.handle_login()
            return
        if parsed.path == "/api/signup":
            self.handle_signup()
            return
        if parsed.path == "/api/password-reset-request":
            self.handle_password_reset_request()
            return
        if parsed.path == "/api/password-reset-confirm":
            self.handle_password_reset_confirm()
            return
        if parsed.path == "/api/logout":
            self.handle_logout()
            return
        if parsed.path == "/api/file-upload":
            self.handle_file_upload()
            return
        if parsed.path == "/api/file-url":
            self.handle_file_url()
            return
        if parsed.path == "/api/file-delete":
            self.handle_file_delete()
            return
        if parsed.path == "/api/state":
            self.handle_save_state()
            return
        if parsed.path == "/api/equipment":
            self.handle_save_equipment()
            return
        if parsed.path == "/api/user":
            self.handle_save_user()
            return
        if parsed.path == "/api/user-delete":
            self.handle_delete_user()
            return
        if parsed.path == "/api/building":
            self.handle_save_building()
            return
        if parsed.path == "/api/apartment":
            self.handle_save_apartment()
            return
        if parsed.path == "/api/ticket":
            self.handle_save_ticket()
            return
        if parsed.path == "/api/work-order":
            self.handle_save_work_order()
            return
        if parsed.path == "/api/intervention":
            self.handle_save_intervention()
            return
        if parsed.path == "/api/reminder":
            self.handle_save_reminder()
            return
        if parsed.path == "/api/reminder-delete":
            self.handle_delete_reminder()
            return
        if parsed.path == "/api/report-context":
            self.handle_report_context()
            return
        if parsed.path == "/api/setting-item":
            self.handle_save_setting_item()
            return
        if parsed.path == "/api/setting-item-delete":
            self.handle_delete_setting_item()
            return
        self.json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)

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
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            result = save_equipment_with_use_cases(
                user,
                payload.get("equipment"),
                get_equipment_lookup_repository(),
                get_create_equipment_use_case(),
                get_update_equipment_use_case(),
            )
            sync_relational_tables_safely(result.get("state", {}), {"equipment"})
            result["state"] = filter_state_for_user(result.get("state", {}), user)
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"Equipment save failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la sauvegarde machine."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_save_user(self) -> None:
        current_user = SessionService().read(self.headers.get("Cookie"))
        if not current_user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            result = save_user_with_use_cases(
                current_user,
                payload.get("user"),
                get_user_lookup_repository(),
                get_create_user_use_case(),
                get_update_user_use_case(),
            )
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except ValueError as error:
            self.json_response({"error": str(error)}, HTTPStatus.CONFLICT)
        except Exception as error:
            print(f"User save failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la sauvegarde utilisateur."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_delete_user(self) -> None:
        current_user = SessionService().read(self.headers.get("Cookie"))
        if not current_user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            result = get_delete_user_use_case()(DeleteUserCommand(current_user, str(payload.get("userId") or "")))
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"User delete failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la suppression utilisateur."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_save_building(self) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            result = save_building_with_use_cases(
                user,
                payload.get("building"),
                get_place_lookup_repository(),
                get_create_building_use_case(),
                get_update_building_use_case(),
            )
            sync_relational_tables_safely(result.get("state", {}), {"buildings"})
            result["state"] = filter_state_for_user(result.get("state", {}), user)
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"building save failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la sauvegarde building."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_save_apartment(self) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            result = save_apartment_with_use_cases(
                user,
                payload.get("apartment"),
                get_place_lookup_repository(),
                get_create_apartment_use_case(),
                get_update_apartment_use_case(),
            )
            sync_relational_tables_safely(result.get("state", {}), {"apartments"})
            result["state"] = filter_state_for_user(result.get("state", {}), user)
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"apartment save failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la sauvegarde apartment."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_save_ticket(self) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            result = save_ticket_with_use_cases(
                user,
                payload.get("ticket"),
                get_ticket_lookup_repository(),
                get_create_ticket_use_case(),
                get_update_ticket_use_case(),
            )
            sync_relational_tables_safely(result.get("state", {}), {"tickets"})
            result["state"] = filter_state_for_user(result.get("state", {}), user)
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"ticket save failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la sauvegarde ticket."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_save_work_order(self) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            result = save_work_order_with_use_cases(
                user,
                payload.get("workOrder"),
                get_work_order_lookup_repository(),
                get_create_work_order_use_case(),
                get_update_work_order_use_case(),
            )
            sync_relational_tables_safely(result.get("state", {}), {"workOrders"})
            result["state"] = filter_state_for_user(result.get("state", {}), user)
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"workOrder save failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la sauvegarde workOrder."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_save_intervention(self) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            result = save_intervention_with_use_cases(
                user,
                payload.get("intervention"),
                get_intervention_lookup_repository(),
                get_create_intervention_use_case(),
                get_update_intervention_use_case(),
            )
            sync_relational_tables_safely(result.get("state", {}), {"interventions"})
            result["state"] = filter_state_for_user(result.get("state", {}), user)
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"intervention save failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la sauvegarde intervention."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_save_reminder(self) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            if isinstance(payload.get("reminders"), list):
                result = save_reminder_batch_with_use_case(user, payload.get("reminders"), get_save_reminder_batch_use_case())
            else:
                result = save_reminder_with_use_case(user, payload.get("reminder"), get_save_reminder_use_case())
            sync_relational_tables_safely(result.get("state", {}), {"reminders"})
            result["state"] = filter_state_for_user(result.get("state", {}), user)
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"reminder save failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la sauvegarde rappel."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_delete_reminder(self) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            result = delete_reminder_with_use_case(user, str(payload.get("reminderId") or ""), get_delete_reminder_use_case())
            result["state"] = filter_state_for_user(result.get("state", {}), user)
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"reminder delete failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la suppression rappel."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_report_context(self) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            result = get_report_context_with_use_case(user, payload.get("filters"), get_report_context_use_case())
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"report context failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la preparation du rapport."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_save_setting_item(self) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            collection_key = str(payload.get("collectionKey") or "")
            result = save_setting_item_with_use_case(
                user,
                collection_key,
                payload.get("item"),
                get_save_setting_item_use_case(),
            )
            sync_relational_tables_safely(result.get("state", {}), {collection_key})
            result["state"] = filter_state_for_user(result.get("state", {}), user)
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"setting save failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la sauvegarde des parametres."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_delete_setting_item(self) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        try:
            collection_key = str(payload.get("collectionKey") or "")
            result = delete_setting_item_with_use_case(
                user,
                collection_key,
                str(payload.get("itemId") or ""),
                get_delete_setting_item_use_case(),
            )
            sync_relational_tables_safely(result.get("state", {}), {collection_key})
            result["state"] = filter_state_for_user(result.get("state", {}), user)
            self.json_response(result)
        except ApplicationError as error:
            self.json_response({"error": error.message}, error.status)
        except Exception as error:
            print(f"setting delete failed: {error}")
            self.json_response({"error": "Erreur serveur lors de la suppression des parametres."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def serve_static(self, raw_path: str) -> None:
        path = "/index.html" if raw_path in ("", "/") else raw_path
        requested = (ROOT / unquote(path).lstrip("/")).resolve()
        if not str(requested).startswith(str(ROOT)) or not requested.is_file():
            self.json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)
            return
        content_type = mimetypes.guess_type(requested.name)[0] or "application/octet-stream"
        body = requested.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if requested.name in {"app.js", "index.html"} else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)

    def handle_local_file(self, parsed) -> None:
        user = SessionService().read(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        query = parse_qs(parsed.query)
        bucket = query.get("bucket", [""])[0]
        path = query.get("path", [""])[0]
        if not bucket or not path:
            self.json_response({"error": "Fichier introuvable."}, HTTPStatus.BAD_REQUEST)
            return
        with db() as connection:
            state = get_state(connection)
        visible = filter_state_for_user(state, user)
        allowed_paths = set()
        for doc in visible.get("clientDocuments", []) if isinstance(visible.get("clientDocuments"), list) else []:
            if isinstance(doc, dict) and doc.get("storageBucket") == bucket and doc.get("storagePath"):
                allowed_paths.add(doc.get("storagePath"))
        for equipment in visible.get("equipment", []) if isinstance(visible.get("equipment"), list) else []:
            for file in equipment.get("attachments", []) if isinstance(equipment, dict) and isinstance(equipment.get("attachments"), list) else []:
                if isinstance(file, dict) and file.get("storageBucket") == bucket and file.get("storagePath"):
                    allowed_paths.add(file.get("storagePath"))
        for intervention in visible.get("interventions", []) if isinstance(visible.get("interventions"), list) else []:
            for file in intervention.get("attachments", []) if isinstance(intervention, dict) and isinstance(intervention.get("attachments"), list) else []:
                if isinstance(file, dict) and file.get("storageBucket") == bucket and file.get("storagePath"):
                    allowed_paths.add(file.get("storagePath"))
        if path not in allowed_paths:
            self.json_response({"error": "Fichier non autorise."}, HTTPStatus.FORBIDDEN)
            return
        try:
            target = local_file_path(bucket, path)
        except FileStorageError as error:
            self.json_response({"error": error.message}, error.status)
            return
        if not target.exists() or not target.is_file():
            self.json_response({"error": "Fichier introuvable."}, HTTPStatus.NOT_FOUND)
            return
        body = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(body or "{}")

    def read_multipart(self) -> tuple[dict[str, str], dict[str, dict[str, Any]]]:
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            raise FileStorageError("Requete multipart invalide.", HTTPStatus.BAD_REQUEST)
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        raw = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
        message = BytesParser(policy=email_policy).parsebytes(raw)
        fields: dict[str, str] = {}
        files: dict[str, dict[str, Any]] = {}
        for part in message.iter_parts():
            name = part.get_param("name", header="content-disposition")
            if not name:
                continue
            filename = part.get_filename()
            payload = part.get_payload(decode=True) or b""
            if filename:
                files[name] = {
                    "filename": filename,
                    "contentType": part.get_content_type(),
                    "content": payload,
                }
            else:
                fields[name] = payload.decode(part.get_content_charset() or "utf-8", "ignore")
        return fields, files

    def json_response(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        if os.environ.get("CLIMAPARC_DEBUG"):
            super().log_message(format, *args)


def main() -> None:
    init_db()
    database_name = "Supabase/Postgres" if USE_POSTGRES else f"SQLite ({DB_PATH.name})"
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ClimaParc online sur http://{HOST}:{PORT} avec {database_name}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
