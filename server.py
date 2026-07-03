from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import sqlite3
import smtplib
import time
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DATABASE_URL")
DB_PATH = Path(os.environ.get("CLIMAPARC_DB", ROOT / "climaparc.sqlite3"))
SESSION_TTL_SECONDS = int(os.environ.get("CLIMAPARC_SESSION_TTL", "28800"))
HOST = os.environ.get("CLIMAPARC_HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT") or os.environ.get("CLIMAPARC_PORT", "8000"))
USE_POSTGRES = bool(DATABASE_URL)
PASSWORD_RESET_TTL_SECONDS = int(os.environ.get("CLIMAPARC_PASSWORD_RESET_TTL", "3600"))
APP_BASE_URL = os.environ.get("APP_BASE_URL", "").rstrip("/")
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER or "no-reply@climaparc.ca")

if USE_POSTGRES:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Jsonb


def db():
    if USE_POSTGRES:
        return psycopg.connect(DATABASE_URL, row_factory=dict_row)
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


def rel_table(name: str) -> str:
    return f"public.{name}" if USE_POSTGRES else name


def init_relational_tables(connection) -> None:
    payload_column = "jsonb not null default '{}'::jsonb" if USE_POSTGRES else "text not null default '{}'"
    updated_column = "timestamptz not null default now()" if USE_POSTGRES else "integer not null default 0"
    bool_column = "boolean" if USE_POSTGRES else "integer"

    table_statements = [
        f"""
        create table if not exists {rel_table("climaparc_clients")} (
          id text primary key,
          name text not null default '',
          contact text,
          email text,
          phone text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_buildings")} (
          id text primary key,
          client_id text,
          name text not null default '',
          address text,
          onsite_contact_name text,
          onsite_contact_email text,
          billing_contact_name text,
          billing_contact_email text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_apartments")} (
          id text primary key,
          building_id text,
          number text not null default '',
          occupant text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_equipment")} (
          id text primary key,
          apartment_id text,
          equipment_type text,
          brand text,
          model text,
          serial text,
          location text,
          unit_kind text,
          status text,
          install_date text,
          last_service text,
          next_service text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_tickets")} (
          id text primary key,
          number text,
          client_id text,
          building_id text,
          apartment_id text,
          equipment_id text,
          title text,
          priority text,
          status text,
          service_type_id text,
          created_at_text text,
          closed_at_text text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_work_orders")} (
          id text primary key,
          number text,
          ticket_id text,
          building_id text,
          apartment_id text,
          equipment_id text,
          type_id text,
          status text,
          scheduled_date text,
          technician_id text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_interventions")} (
          id text primary key,
          work_order_id text,
          apartment_id text,
          equipment_id text,
          technician_id text,
          form_template_id text,
          status text,
          activity_status text,
          machine_status text,
          date_text text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_reminders")} (
          id text primary key,
          equipment_id text,
          title text,
          status text,
          frequency_value integer,
          frequency_unit text,
          start_date text,
          next_due_date text,
          last_work_order_id text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_client_documents")} (
          id text primary key,
          client_id text,
          building_id text,
          apartment_id text,
          equipment_id text,
          name text,
          document_type text,
          file_name text,
          file_type text,
          uploaded_at text,
          visible_to_client {bool_column},
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_service_types")} (
          id text primary key,
          name text not null default '',
          default_priority text,
          linked_intervention_type_id text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_intervention_types")} (
          id text primary key,
          name text not null default '',
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_form_templates")} (
          id text primary key,
          name text not null default '',
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_role_definitions")} (
          id text primary key,
          name text not null default '',
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_data_fields")} (
          id text primary key,
          name text not null default '',
          field_group text,
          field_type text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
        f"""
        create table if not exists {rel_table("climaparc_password_reset_requests")} (
          id text primary key,
          email text,
          user_id text,
          status text,
          created_at_text text,
          expires_at_text text,
          payload {payload_column},
          updated_at {updated_column}
        )
        """,
    ]
    for statement in table_statements:
        connection.execute(statement)

    index_statements = [
        ("climaparc_buildings_client_id_idx", "climaparc_buildings", "client_id"),
        ("climaparc_apartments_building_id_idx", "climaparc_apartments", "building_id"),
        ("climaparc_equipment_apartment_id_idx", "climaparc_equipment", "apartment_id"),
        ("climaparc_equipment_status_idx", "climaparc_equipment", "status"),
        ("climaparc_equipment_serial_idx", "climaparc_equipment", "serial"),
        ("climaparc_tickets_number_idx", "climaparc_tickets", "number"),
        ("climaparc_tickets_client_id_idx", "climaparc_tickets", "client_id"),
        ("climaparc_tickets_building_id_idx", "climaparc_tickets", "building_id"),
        ("climaparc_tickets_equipment_id_idx", "climaparc_tickets", "equipment_id"),
        ("climaparc_tickets_status_idx", "climaparc_tickets", "status"),
        ("climaparc_work_orders_number_idx", "climaparc_work_orders", "number"),
        ("climaparc_work_orders_ticket_id_idx", "climaparc_work_orders", "ticket_id"),
        ("climaparc_work_orders_building_id_idx", "climaparc_work_orders", "building_id"),
        ("climaparc_work_orders_equipment_id_idx", "climaparc_work_orders", "equipment_id"),
        ("climaparc_work_orders_status_idx", "climaparc_work_orders", "status"),
        ("climaparc_work_orders_scheduled_date_idx", "climaparc_work_orders", "scheduled_date"),
        ("climaparc_interventions_work_order_id_idx", "climaparc_interventions", "work_order_id"),
        ("climaparc_interventions_equipment_id_idx", "climaparc_interventions", "equipment_id"),
        ("climaparc_reminders_equipment_id_idx", "climaparc_reminders", "equipment_id"),
        ("climaparc_reminders_status_idx", "climaparc_reminders", "status"),
        ("climaparc_reminders_next_due_date_idx", "climaparc_reminders", "next_due_date"),
        ("climaparc_client_documents_client_id_idx", "climaparc_client_documents", "client_id"),
        ("climaparc_client_documents_building_id_idx", "climaparc_client_documents", "building_id"),
        ("climaparc_client_documents_equipment_id_idx", "climaparc_client_documents", "equipment_id"),
    ]
    for index_name, table, columns in index_statements:
        connection.execute(f"create index if not exists {index_name} on {rel_table(table)}({columns})")


def init_db() -> None:
    with db() as connection:
        if USE_POSTGRES:
            connection.execute(
                """
                create table if not exists public.climaparc_state (
                  id integer primary key check (id = 1),
                  state_json jsonb not null,
                  updated_at timestamptz not null default now()
                )
                """
            )
            connection.execute(
                """
                create table if not exists public.climaparc_users (
                  id text primary key,
                  email text unique not null,
                  name text not null,
                  role text not null,
                  client_id text,
                  password_hash text not null,
                  salt text not null,
                  updated_at timestamptz not null default now()
                )
                """
            )
            connection.execute(
                """
                create table if not exists public.climaparc_sessions (
                  token text primary key,
                  user_id text not null references public.climaparc_users(id) on delete cascade,
                  expires_at timestamptz not null
                )
                """
            )
            connection.execute("create index if not exists climaparc_sessions_user_id_idx on public.climaparc_sessions(user_id)")
            connection.execute("create index if not exists climaparc_sessions_expires_at_idx on public.climaparc_sessions(expires_at)")
            init_relational_tables(connection)
            return

        connection.executescript(
            """
            create table if not exists climaparc_state (
              id integer primary key check (id = 1),
              state_json text not null,
              updated_at integer not null
            );

            create table if not exists climaparc_users (
              id text primary key,
              email text unique not null,
              name text not null,
              role text not null,
              client_id text,
              password_hash text not null,
              salt text not null,
              updated_at integer not null
            );

            create table if not exists climaparc_sessions (
              token text primary key,
              user_id text not null references climaparc_users(id) on delete cascade,
              expires_at integer not null
            );
            """
        )
        init_relational_tables(connection)


def password_hash(password: str, salt: str | None = None) -> tuple[str, str]:
    raw_salt = base64.b64decode(salt) if salt else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), raw_salt, 120_000)
    return base64.b64encode(digest).decode("ascii"), base64.b64encode(raw_salt).decode("ascii")


def verify_password(password: str, expected_hash: str, salt: str) -> bool:
    actual_hash, _ = password_hash(password, salt)
    return hmac.compare_digest(actual_hash, expected_hash)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def reset_expiry_iso() -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=PASSWORD_RESET_TTL_SECONDS)).isoformat()


def server_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def reset_expired(value: str | None) -> bool:
    if not value:
        return True
    try:
        return datetime.fromisoformat(value) < datetime.now(timezone.utc)
    except ValueError:
        return True


def public_base_url(headers) -> str:
    if APP_BASE_URL:
        return APP_BASE_URL
    host = headers.get("Host", f"{HOST}:{PORT}")
    scheme = headers.get("X-Forwarded-Proto", "https" if "onrender.com" in host else "http")
    return f"{scheme}://{host}".rstrip("/")


def send_password_reset_email(email: str, reset_url: str) -> bool:
    if not SMTP_HOST:
        return False
    message = EmailMessage()
    message["Subject"] = "Réinitialisation de votre mot de passe ClimaParc"
    message["From"] = SMTP_FROM
    message["To"] = email
    message.set_content(
        "\n".join([
            "Bonjour,",
            "",
            "Vous avez demandé la réinitialisation de votre mot de passe ClimaParc.",
            f"Utilisez ce lien dans la prochaine heure: {reset_url}",
            "",
            "Si vous n'avez pas demandé cette opération, vous pouvez ignorer ce message.",
        ])
    )
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if SMTP_USER or SMTP_PASSWORD:
                smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception as error:
        print(f"Password reset email failed: {error}")
        return False


def get_state(connection, lock: bool = False) -> dict | None:
    statement = "select state_json from climaparc_state where id = 1"
    if USE_POSTGRES and lock:
        statement += " for update"
    row = execute(connection, statement).fetchone()
    if not row:
        return None
    value = row_get(row, "state_json")
    return json.loads(value) if isinstance(value, str) else value


def save_state(connection, state: dict) -> None:
    execute(
        connection,
        """
        insert into climaparc_state (id, state_json, updated_at)
        values (1, ?, ?)
        on conflict(id) do update set state_json = excluded.state_json, updated_at = excluded.updated_at
        """,
        (json_db_value(state), now_value()),
    )


MERGE_BY_ID_KEYS = {
    "users",
    "clients",
    "buildings",
    "apartments",
    "equipment",
    "tickets",
    "workOrders",
    "interventions",
    "reminders",
    "clientDocuments",
    "serviceTypes",
    "interventionTypes",
    "formTemplates",
    "roleDefinitions",
    "dataFields",
    "passwordResetRequests",
}


def item_timestamp(item: dict) -> str:
    for key in ("serverUpdatedAt", "updatedAt", "updated_at", "modifiedAt", "createdAt", "uploadedAt", "date"):
        value = item.get(key)
        if value:
            return str(value)
    return ""


def merge_by_id(current_items: list[Any], incoming_items: list[Any]) -> list[Any]:
    current_items = current_items or []
    incoming_items = incoming_items or []
    current_map = {
        item.get("id"): item
        for item in current_items
        if isinstance(item, dict) and item.get("id")
    }
    incoming_map = {
        item.get("id"): item
        for item in incoming_items
        if isinstance(item, dict) and item.get("id")
    }
    ordered_ids: list[str] = []
    for item in incoming_items + current_items:
        if isinstance(item, dict) and item.get("id") and item["id"] not in ordered_ids:
            ordered_ids.append(item["id"])

    merged: list[Any] = []
    for item_id in ordered_ids:
        current = current_map.get(item_id)
        incoming = incoming_map.get(item_id)
        if current and incoming:
            current_stamp = item_timestamp(current)
            incoming_stamp = item_timestamp(incoming)
            if current_stamp and incoming_stamp:
                chosen = current if current_stamp > incoming_stamp else incoming
            elif current_stamp and not incoming_stamp:
                chosen = current
            else:
                chosen = incoming
            if isinstance(current.get("attachments"), list) or isinstance(incoming.get("attachments"), list):
                chosen = dict(chosen)
                chosen["attachments"] = merge_by_id(current.get("attachments", []), incoming.get("attachments", []))
            merged.append(chosen)
        else:
            merged.append(incoming or current)
    return merged


def merge_shared_state(current: dict | None, incoming: dict) -> dict:
    if not current:
        return incoming
    merged = {**current, **incoming}
    for key in MERGE_BY_ID_KEYS:
        if isinstance(current.get(key), list) or isinstance(incoming.get(key), list):
            merged[key] = merge_by_id(current.get(key, []), incoming.get(key, []))
    return merged


def apply_state_changes(current: dict | None, changes: dict) -> dict:
    merged = dict(current or {})
    values = changes.get("values") if isinstance(changes.get("values"), dict) else {}
    for key, value in values.items():
        if key in {"sessionUserId", "modal", "toast"}:
            continue
        merged[key] = value

    upserts = changes.get("upserts") if isinstance(changes.get("upserts"), dict) else {}
    deletes = changes.get("deletes") if isinstance(changes.get("deletes"), dict) else {}

    for key in MERGE_BY_ID_KEYS:
        current_items = merged.get(key, [])
        if not isinstance(current_items, list):
            current_items = []
        remove_ids = {
            str(item_id)
            for item_id in deletes.get(key, [])
            if item_id is not None
        }
        by_id: dict[str, Any] = {
            str(item.get("id")): item
            for item in current_items
            if isinstance(item, dict) and item.get("id") is not None and str(item.get("id")) not in remove_ids
        }
        order: list[str] = [
            str(item.get("id"))
            for item in current_items
            if isinstance(item, dict) and item.get("id") is not None and str(item.get("id")) not in remove_ids
        ]
        for item in upserts.get(key, []):
            if not isinstance(item, dict) or item.get("id") is None:
                continue
            item_id = str(item.get("id"))
            by_id[item_id] = item
            if item_id not in order:
                order.insert(0, item_id)
        merged[key] = [by_id[item_id] for item_id in order if item_id in by_id]
    return merged


def stamp_changed_items(state: dict, changes: dict | None = None) -> None:
    stamp = server_timestamp()
    if not isinstance(changes, dict):
        for key in MERGE_BY_ID_KEYS:
            for item in state.get(key, []) if isinstance(state.get(key), list) else []:
                if isinstance(item, dict) and not item.get("serverUpdatedAt"):
                    item["serverUpdatedAt"] = stamp
        return

    upserts = changes.get("upserts") if isinstance(changes.get("upserts"), dict) else {}
    for key, items in upserts.items():
        if key not in MERGE_BY_ID_KEYS or not isinstance(items, list):
            continue
        changed_ids = {
            str(item.get("id"))
            for item in items
            if isinstance(item, dict) and item.get("id") is not None
        }
        for item in state.get(key, []) if isinstance(state.get(key), list) else []:
            if isinstance(item, dict) and str(item.get("id")) in changed_ids:
                item["serverUpdatedAt"] = stamp


def duplicate_user_email(state: dict) -> str | None:
    seen: set[str] = set()
    for user in state.get("users", []):
        if not isinstance(user, dict):
            continue
        email = str(user.get("email", "")).strip().lower()
        if not email:
            continue
        if email in seen:
            return email
        seen.add(email)
    return None


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
        existing = execute(connection, "select salt from climaparc_users where id = ?", (user["id"],)).fetchone()
        digest, salt = password_hash(password, row_get(existing, "salt") if existing else None)
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


def scalar_db_value(value: Any):
    if value is None:
        return None
    if isinstance(value, bool):
        return value if USE_POSTGRES else int(value)
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def int_db_value(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


RELATIONAL_SYNC_SPECS = {
    "clients": {
        "table": "climaparc_clients",
        "columns": [
            ("name", "name"),
            ("contact", "contact"),
            ("email", "email"),
            ("phone", "phone"),
        ],
    },
    "buildings": {
        "table": "climaparc_buildings",
        "columns": [
            ("client_id", "clientId"),
            ("name", "name"),
            ("address", "address"),
            ("onsite_contact_name", "onsiteContactName"),
            ("onsite_contact_email", "onsiteContactEmail"),
            ("billing_contact_name", "billingContactName"),
            ("billing_contact_email", "billingContactEmail"),
        ],
    },
    "apartments": {
        "table": "climaparc_apartments",
        "columns": [
            ("building_id", "buildingId"),
            ("number", "number"),
            ("occupant", "occupant"),
        ],
    },
    "equipment": {
        "table": "climaparc_equipment",
        "columns": [
            ("apartment_id", "apartmentId"),
            ("equipment_type", "type"),
            ("brand", "brand"),
            ("model", "model"),
            ("serial", "serial"),
            ("location", "location"),
            ("unit_kind", "unitKind"),
            ("status", "status"),
            ("install_date", "installDate"),
            ("last_service", "lastService"),
            ("next_service", "nextService"),
        ],
    },
    "tickets": {
        "table": "climaparc_tickets",
        "columns": [
            ("number", "number"),
            ("client_id", "clientId"),
            ("building_id", "buildingId"),
            ("apartment_id", "apartmentId"),
            ("equipment_id", "equipmentId"),
            ("title", "title"),
            ("priority", "priority"),
            ("status", "status"),
            ("service_type_id", "serviceTypeId"),
            ("created_at_text", "createdAt"),
            ("closed_at_text", "closedAt"),
        ],
    },
    "workOrders": {
        "table": "climaparc_work_orders",
        "columns": [
            ("number", "number"),
            ("ticket_id", "ticketId"),
            ("building_id", "buildingId"),
            ("apartment_id", "apartmentId"),
            ("equipment_id", "equipmentId"),
            ("type_id", "typeId"),
            ("status", "status"),
            ("scheduled_date", "scheduledDate"),
            ("technician_id", "technicianId"),
        ],
    },
    "interventions": {
        "table": "climaparc_interventions",
        "columns": [
            ("work_order_id", "workOrderId"),
            ("apartment_id", "apartmentId"),
            ("equipment_id", "equipmentId"),
            ("technician_id", "technicianId"),
            ("form_template_id", "formTemplateId"),
            ("status", "status"),
            ("activity_status", "activityStatus"),
            ("machine_status", "machineStatus"),
            ("date_text", "date"),
        ],
    },
    "reminders": {
        "table": "climaparc_reminders",
        "columns": [
            ("equipment_id", "equipmentId"),
            ("title", "title"),
            ("status", "status"),
            ("frequency_value", lambda item: int_db_value(item.get("frequencyValue"))),
            ("frequency_unit", "frequencyUnit"),
            ("start_date", "startDate"),
            ("next_due_date", "nextDueDate"),
            ("last_work_order_id", "lastWorkOrderId"),
        ],
    },
    "clientDocuments": {
        "table": "climaparc_client_documents",
        "columns": [
            ("client_id", "clientId"),
            ("building_id", "buildingId"),
            ("apartment_id", "apartmentId"),
            ("equipment_id", "equipmentId"),
            ("name", "name"),
            ("document_type", "type"),
            ("file_name", "fileName"),
            ("file_type", "fileType"),
            ("uploaded_at", "uploadedAt"),
            ("visible_to_client", lambda item: item.get("visibleToClient") is not False),
        ],
    },
    "serviceTypes": {
        "table": "climaparc_service_types",
        "columns": [
            ("name", "name"),
            ("default_priority", "defaultPriority"),
            ("linked_intervention_type_id", "linkedInterventionTypeId"),
        ],
    },
    "interventionTypes": {
        "table": "climaparc_intervention_types",
        "columns": [
            ("name", "name"),
        ],
    },
    "formTemplates": {
        "table": "climaparc_form_templates",
        "columns": [
            ("name", "name"),
        ],
    },
    "roleDefinitions": {
        "table": "climaparc_role_definitions",
        "columns": [
            ("name", "name"),
        ],
    },
    "dataFields": {
        "table": "climaparc_data_fields",
        "columns": [
            ("name", "name"),
            ("field_group", "group"),
            ("field_type", "type"),
        ],
    },
    "passwordResetRequests": {
        "table": "climaparc_password_reset_requests",
        "columns": [
            ("email", "email"),
            ("user_id", "userId"),
            ("status", "status"),
            ("created_at_text", "createdAt"),
            ("expires_at_text", "expiresAt"),
        ],
    },
}


def sync_collection_table(connection, state: dict, collection_key: str) -> None:
    spec = RELATIONAL_SYNC_SPECS.get(collection_key)
    if not spec:
        return
    items = state.get(collection_key)
    if not isinstance(items, list):
        return

    table = rel_table(spec["table"])
    column_specs = spec["columns"]
    data_columns = [column for column, _ in column_specs]
    all_columns = ["id", *data_columns, "payload", "updated_at"]
    placeholders = ", ".join("?" for _ in all_columns)
    update_clause = ", ".join(f"{column} = excluded.{column}" for column in all_columns if column != "id")
    statement = f"""
        insert into {table} ({", ".join(all_columns)})
        values ({placeholders})
        on conflict(id) do update set {update_clause}
    """

    seen_ids: set[str] = set()
    for item in items:
        if not isinstance(item, dict) or item.get("id") in (None, ""):
            continue
        item_id = str(item.get("id"))
        seen_ids.add(item_id)
        values: list[Any] = [item_id]
        for _, source in column_specs:
            raw_value = source(item) if callable(source) else item.get(source)
            values.append(scalar_db_value(raw_value))
        values.extend([json_db_value(item), now_value()])
        execute(connection, statement, tuple(values))

    existing_rows = execute(connection, f"select id from {table}").fetchall()
    for row in existing_rows:
        item_id = str(row_get(row, "id"))
        if item_id not in seen_ids:
            execute(connection, f"delete from {table} where id = ?", (item_id,))


def sync_relational_tables(connection, state: dict, collection_keys: set[str] | None = None) -> None:
    keys = set(RELATIONAL_SYNC_SPECS.keys()) if collection_keys is None else collection_keys
    for collection_key in keys:
        sync_collection_table(connection, state, collection_key)


def changed_collection_keys(changes: dict | None) -> set[str]:
    if not isinstance(changes, dict):
        return set(RELATIONAL_SYNC_SPECS.keys())
    keys: set[str] = set()
    for section_name in ("upserts", "deletes"):
        section = changes.get(section_name)
        if isinstance(section, dict):
            keys.update(key for key in section.keys() if key in RELATIONAL_SYNC_SPECS)
    return keys


def sync_relational_tables_safely(state: dict, collection_keys: set[str] | None = None) -> None:
    try:
        with db() as connection:
            sync_relational_tables(connection, state, collection_keys)
    except Exception as error:
        print(f"Relational table sync skipped: {error}")


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
    if state:
        sync_relational_tables_safely(state)
    return state


def new_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(8)}"


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    with db() as connection:
        execute(
            connection,
            "insert into climaparc_sessions (token, user_id, expires_at) values (?, ?, ?)",
            (token, user_id, expires_value()),
        )
    return token


def read_session(cookie_header: str | None):
    if not cookie_header:
        return None
    cookie = SimpleCookie()
    cookie.load(cookie_header)
    token = cookie.get("climaparc_session")
    if not token:
        return None
    with db() as connection:
        execute(connection, "delete from climaparc_sessions where expires_at < ?", (now_value(),))
        return execute(
            connection,
            """
            select climaparc_users.* from climaparc_sessions
            join climaparc_users on climaparc_users.id = climaparc_sessions.user_id
            where climaparc_sessions.token = ? and climaparc_sessions.expires_at >= ?
            """,
            (token.value, now_value()),
        ).fetchone()


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
        if parsed.path == "/api/state":
            self.handle_save_state()
            return
        if parsed.path == "/api/equipment":
            self.handle_save_equipment()
            return
        if parsed.path == "/api/user":
            self.handle_save_user()
            return
        self.json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def handle_session(self) -> None:
        user = read_session(self.headers.get("Cookie"))
        if not user:
            self.json_response({"authenticated": False}, HTTPStatus.UNAUTHORIZED)
            return
        with db() as connection:
            state = get_state(connection)
        self.json_response({"authenticated": True, "user": public_user(user), "state": state})

    def handle_login(self) -> None:
        payload = self.read_json()
        state = ensure_bootstrap_state(payload.get("seed"))
        email = str(payload.get("email", "")).lower()
        password = str(payload.get("password", ""))
        with db() as connection:
            user = execute(connection, "select * from climaparc_users where email = ?", (email,)).fetchone()
        if not user or not verify_password(password, row_get(user, "password_hash"), row_get(user, "salt")):
            self.json_response({"error": "Courriel ou mot de passe invalide."}, HTTPStatus.UNAUTHORIZED)
            return
        token = create_session(row_get(user, "id"))
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", f"climaparc_session={token}; HttpOnly; Path=/; SameSite=Lax")
        self.end_headers()
        self.wfile.write(json.dumps({"user": public_user(user), "state": state}, ensure_ascii=False).encode("utf-8"))

    def handle_signup(self) -> None:
        payload = self.read_json()
        state = ensure_bootstrap_state(payload.get("seed"))
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        confirm_password = str(payload.get("confirmPassword", ""))
        company_name = str(payload.get("companyName", "")).strip()
        name = str(payload.get("name", "")).strip()
        phone = str(payload.get("phone", "")).strip()

        if not email or not password or not company_name or not name:
            self.json_response({"error": "Tous les champs obligatoires doivent être remplis."}, HTTPStatus.BAD_REQUEST)
            return
        if password != confirm_password:
            self.json_response({"error": "Les mots de passe ne correspondent pas."}, HTTPStatus.BAD_REQUEST)
            return
        if len(password) < 8:
            self.json_response({"error": "Le mot de passe doit contenir au moins 8 caractères."}, HTTPStatus.BAD_REQUEST)
            return

        with db() as connection:
            state = get_state(connection, lock=True) or state
            existing = execute(connection, "select id from climaparc_users where email = ?", (email,)).fetchone()
            if existing:
                self.json_response({"error": "Un compte existe déjà avec ce courriel."}, HTTPStatus.CONFLICT)
                return

            client = {
                "id": new_id("client"),
                "name": company_name,
                "contact": name,
                "email": email,
                "phone": phone,
            }
            user = {
                "id": new_id("u"),
                "name": name,
                "email": email,
                "password": password,
                "role": "client",
                "clientId": client["id"],
            }
            state.setdefault("clients", []).append(client)
            state.setdefault("users", []).append(user)
            save_state(connection, state)
            sync_users(connection, state)
        sync_relational_tables_safely(state, {"clients"})

        token = create_session(user["id"])
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", f"climaparc_session={token}; HttpOnly; Path=/; SameSite=Lax")
        self.end_headers()
        self.wfile.write(json.dumps({"user": {k: v for k, v in user.items() if k != "password"}, "state": state}, ensure_ascii=False).encode("utf-8"))

    def handle_password_reset_request(self) -> None:
        payload = self.read_json()
        state = ensure_bootstrap_state(payload.get("seed"))
        email = str(payload.get("email", "")).strip().lower()
        email_sent = False
        if email:
            with db() as connection:
                state = get_state(connection, lock=True) or state
                user = execute(connection, "select * from climaparc_users where email = ?", (email,)).fetchone()
                reset_record = {
                    "id": new_id("reset"),
                    "email": email,
                    "createdAt": datetime.now(timezone.utc).date().isoformat(),
                    "status": "nouvelle",
                    "emailSent": False,
                }
                if user:
                    token = secrets.token_urlsafe(32)
                    reset_url = f"{public_base_url(self.headers)}/?resetToken={token}"
                    email_sent = send_password_reset_email(email, reset_url)
                    reset_record.update({
                        "userId": row_get(user, "id"),
                        "tokenHash": token_hash(token),
                        "expiresAt": reset_expiry_iso(),
                        "status": "email_envoye" if email_sent else "email_non_configure",
                        "emailSent": email_sent,
                    })
                state.setdefault("passwordResetRequests", []).insert(0, reset_record)
                state["passwordResetRequests"] = state["passwordResetRequests"][:100]
                save_state(connection, state)
            sync_relational_tables_safely(state, {"passwordResetRequests"})
        self.json_response({"ok": True, "emailSent": email_sent, "mailConfigured": bool(SMTP_HOST)})

    def handle_password_reset_confirm(self) -> None:
        payload = self.read_json()
        state = ensure_bootstrap_state(payload.get("seed"))
        token = str(payload.get("token", "")).strip()
        password = str(payload.get("password", ""))
        confirm_password = str(payload.get("confirmPassword", ""))
        if not token:
            self.json_response({"error": "Lien de réinitialisation invalide."}, HTTPStatus.BAD_REQUEST)
            return
        if password != confirm_password:
            self.json_response({"error": "Les mots de passe ne correspondent pas."}, HTTPStatus.BAD_REQUEST)
            return
        if len(password) < 8:
            self.json_response({"error": "Le mot de passe doit contenir au moins 8 caractères."}, HTTPStatus.BAD_REQUEST)
            return

        with db() as connection:
            state = get_state(connection, lock=True) or state
        hashed = token_hash(token)
        reset_request = next(
            (
                item for item in state.get("passwordResetRequests", [])
                if item.get("tokenHash") == hashed and item.get("status") not in {"utilise", "expire"}
            ),
            None,
        )
        if not reset_request or reset_expired(reset_request.get("expiresAt")):
            if reset_request:
                reset_request["status"] = "expire"
                with db() as connection:
                    save_state(connection, state)
                sync_relational_tables_safely(state, {"passwordResetRequests"})
            self.json_response({"error": "Lien expiré ou invalide."}, HTTPStatus.BAD_REQUEST)
            return

        user = next((item for item in state.get("users", []) if item.get("id") == reset_request.get("userId")), None)
        if not user:
            self.json_response({"error": "Compte introuvable."}, HTTPStatus.BAD_REQUEST)
            return
        user["password"] = password
        reset_request["status"] = "utilise"
        reset_request["usedAt"] = datetime.now(timezone.utc).isoformat()
        with db() as connection:
            save_state(connection, state)
            sync_users(connection, state)
        sync_relational_tables_safely(state, {"passwordResetRequests"})
        self.json_response({"ok": True})

    def handle_logout(self) -> None:
        cookie_header = self.headers.get("Cookie")
        if cookie_header:
            cookie = SimpleCookie()
            cookie.load(cookie_header)
            token = cookie.get("climaparc_session")
            if token:
                with db() as connection:
                    execute(connection, "delete from climaparc_sessions where token = ?", (token.value,))
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", "climaparc_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0")
        self.end_headers()
        self.wfile.write(b'{"ok": true}')

    def handle_save_state(self) -> None:
        user = read_session(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expirée."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        state = payload.get("state")
        changes = payload.get("changes")
        if not isinstance(state, dict) and not isinstance(changes, dict):
            self.json_response({"error": "Invalid state"}, HTTPStatus.BAD_REQUEST)
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
            duplicate_email = duplicate_user_email(merged_state)
            if duplicate_email:
                self.json_response({"error": f"Un utilisateur existe déjà avec le courriel {duplicate_email}."}, HTTPStatus.CONFLICT)
                return
            save_state(connection, merged_state)
            sync_users(connection, merged_state)
        if sync_keys or sync_keys is None:
            sync_relational_tables_safely(merged_state, sync_keys)
        self.json_response({"ok": True, "state": merged_state})

    def handle_save_equipment(self) -> None:
        user = read_session(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        equipment = payload.get("equipment")
        if not isinstance(equipment, dict) or not equipment.get("id"):
            self.json_response({"error": "Machine invalide."}, HTTPStatus.BAD_REQUEST)
            return
        equipment = dict(equipment)
        equipment["serverUpdatedAt"] = server_timestamp()
        with db() as connection:
            state = get_state(connection, lock=True)
            if not state:
                self.json_response({"error": "Etat introuvable."}, HTTPStatus.BAD_REQUEST)
                return
            items = state.setdefault("equipment", [])
            if not isinstance(items, list):
                items = []
                state["equipment"] = items
            existing_index = next(
                (index for index, item in enumerate(items) if isinstance(item, dict) and item.get("id") == equipment["id"]),
                -1,
            )
            if existing_index >= 0:
                existing = items[existing_index]
                if isinstance(existing, dict) and existing.get("attachments") and not equipment.get("attachments"):
                    equipment["attachments"] = existing.get("attachments")
                items[existing_index] = equipment
            else:
                items.insert(0, equipment)
            state["sessionUserId"] = None
            state["modal"] = None
            state["toast"] = ""
            save_state(connection, state)
        sync_relational_tables_safely(state, {"equipment"})
        self.json_response({"ok": True, "state": state, "equipment": equipment})

    def handle_save_user(self) -> None:
        current_user = read_session(self.headers.get("Cookie"))
        if not current_user:
            self.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        user = payload.get("user")
        if not isinstance(user, dict) or not user.get("id"):
            self.json_response({"error": "Utilisateur invalide."}, HTTPStatus.BAD_REQUEST)
            return
        user = dict(user)
        user["email"] = str(user.get("email", "")).strip().lower()
        if not user["email"] or not user.get("name") or not user.get("role"):
            self.json_response({"error": "Nom, courriel et role sont obligatoires."}, HTTPStatus.BAD_REQUEST)
            return
        if not str(user.get("password") or "").strip():
            self.json_response({"error": "Mot de passe obligatoire."}, HTTPStatus.BAD_REQUEST)
            return
        user["serverUpdatedAt"] = server_timestamp()
        with db() as connection:
            state = get_state(connection, lock=True)
            if not state:
                self.json_response({"error": "Etat introuvable."}, HTTPStatus.BAD_REQUEST)
                return
            users = state.setdefault("users", [])
            if not isinstance(users, list):
                users = []
                state["users"] = users
            requester_id = row_get(current_user, "id")
            requester = next((item for item in users if isinstance(item, dict) and item.get("id") == requester_id), None)
            if not requester:
                self.json_response({"error": "Utilisateur courant introuvable."}, HTTPStatus.BAD_REQUEST)
                return
            requester_role = requester.get("role")
            if requester_role == "client":
                user["role"] = "client"
                user["clientId"] = requester.get("clientId")
            elif requester_role not in {"administrateur", "equipe_interne"}:
                self.json_response({"error": "Droits insuffisants."}, HTTPStatus.FORBIDDEN)
                return

            existing_index = next(
                (index for index, item in enumerate(users) if isinstance(item, dict) and item.get("id") == user["id"]),
                -1,
            )
            if requester_role == "client" and existing_index >= 0:
                existing_user = users[existing_index]
                if existing_user.get("clientId") != requester.get("clientId"):
                    self.json_response({"error": "Vous ne pouvez modifier que les utilisateurs de votre client."}, HTTPStatus.FORBIDDEN)
                    return

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
                self.json_response({"error": f"Un utilisateur existe deja avec le courriel {user['email']}."}, HTTPStatus.CONFLICT)
                return

            if existing_index >= 0:
                users[existing_index] = user
            else:
                users.append(user)
            state["sessionUserId"] = None
            state["modal"] = None
            state["toast"] = ""
            save_state(connection, state)
            sync_users(connection, state)
        sync_relational_tables_safely(state, {"users"})
        self.json_response({"ok": True, "state": state, "user": {k: v for k, v in user.items() if k != "password"}})

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

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(body or "{}")

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


def public_user(row) -> dict:
    return {
        "id": row_get(row, "id"),
        "email": row_get(row, "email"),
        "name": row_get(row, "name"),
        "role": row_get(row, "role"),
        "clientId": row_get(row, "client_id"),
    }


def main() -> None:
    init_db()
    database_name = "Supabase/Postgres" if USE_POSTGRES else f"SQLite ({DB_PATH.name})"
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ClimaParc online sur http://{HOST}:{PORT} avec {database_name}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
