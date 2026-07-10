from __future__ import annotations

import json
from typing import Any

from .database import execute, json_db_value, now_value, password_hash, row_get, server_timestamp, USE_POSTGRES
from .security import public_user, sanitize_state_for_storage


class StateRepository:
    def get(self, connection, lock: bool = False) -> dict | None:
        statement = "select state_json from climaparc_state where id = 1"
        if USE_POSTGRES and lock:
            statement += " for update"
        row = execute(connection, statement).fetchone()
        if not row:
            return None
        value = row_get(row, "state_json")
        state = json.loads(value) if isinstance(value, str) else value
        return hydrate_state_from_payload_tables(connection, state)

    def save(self, connection, state: dict) -> None:
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


class AuthUserRepository:
    def upsert(self, connection, user: dict) -> None:
        password = str(user.get("password") or "")
        email = str(user["email"]).lower()
        existing_email = execute(connection, "select id from climaparc_users where email = ?", (email,)).fetchone()
        if existing_email and row_get(existing_email, "id") != user["id"]:
            raise ValueError(f"Un utilisateur existe deja avec le courriel {email}.")

        existing = execute(connection, "select password_hash, salt from climaparc_users where id = ?", (user["id"],)).fetchone()
        if not password and existing:
            digest, salt = row_get(existing, "password_hash"), row_get(existing, "salt")
        elif password:
            digest, salt = password_hash(password, row_get(existing, "salt") if existing else None)
        else:
            raise ValueError("Mot de passe obligatoire pour un nouvel utilisateur.")
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

    def delete(self, connection, user_id: str) -> None:
        execute(connection, "delete from climaparc_sessions where user_id = ?", (user_id,))
        execute(connection, "delete from climaparc_users where id = ?", (user_id,))


class EquipmentRepository:
    def upsert(self, connection, equipment: dict) -> None:
        execute(
            connection,
            """
            insert into climaparc_equipment (
              id, apartment_id, equipment_type, brand, model, serial, location,
              unit_kind, status, install_date, last_service, next_service, payload, updated_at
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
              apartment_id = excluded.apartment_id,
              equipment_type = excluded.equipment_type,
              brand = excluded.brand,
              model = excluded.model,
              serial = excluded.serial,
              location = excluded.location,
              unit_kind = excluded.unit_kind,
              status = excluded.status,
              install_date = excluded.install_date,
              last_service = excluded.last_service,
              next_service = excluded.next_service,
              payload = excluded.payload,
              updated_at = excluded.updated_at
            """,
            (
                equipment["id"],
                equipment.get("apartmentId"),
                equipment.get("type"),
                equipment.get("brand"),
                equipment.get("model"),
                equipment.get("serial"),
                equipment.get("location"),
                equipment.get("unitKind"),
                equipment.get("status"),
                equipment.get("installDate"),
                equipment.get("lastService"),
                equipment.get("nextService"),
                json_db_value(equipment),
                now_value(),
            ),
        )


class PayloadTableRepository:
    def __init__(self, table: str, column_map: list[tuple[str, str]]):
        self.table = table
        self.column_map = column_map

    def upsert(self, connection, payload: dict) -> None:
        columns = ["id", *[column for column, _ in self.column_map], "payload", "updated_at"]
        placeholders = ", ".join("?" for _ in columns)
        updates = ", ".join(f"{column} = excluded.{column}" for column in columns if column != "id")
        values = [payload["id"]]
        values.extend(source(payload) if callable(source) else payload.get(source) for _, source in self.column_map)
        values.extend([json_db_value(payload), now_value()])
        execute(
            connection,
            f"""
            insert into {self.table} ({", ".join(columns)})
            values ({placeholders})
            on conflict(id) do update set {updates}
            """,
            tuple(values),
        )


PAYLOAD_TABLE_COLLECTIONS = {
    "users": "climaparc_user_profiles",
    "clients": "climaparc_clients",
    "buildings": "climaparc_buildings",
    "apartments": "climaparc_apartments",
    "equipment": "climaparc_equipment",
    "tickets": "climaparc_tickets",
    "workOrders": "climaparc_work_orders",
    "interventions": "climaparc_interventions",
    "reminders": "climaparc_reminders",
    "clientDocuments": "climaparc_client_documents",
    "serviceTypes": "climaparc_service_types",
    "interventionTypes": "climaparc_intervention_types",
    "formTemplates": "climaparc_form_templates",
    "roleDefinitions": "climaparc_role_definitions",
    "dataFields": "climaparc_data_fields",
    "passwordResetRequests": "climaparc_password_reset_requests",
}


def decode_payload(value: Any) -> dict | None:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return None
    return value if isinstance(value, dict) else None


def hydrate_state_from_payload_tables(connection, state: dict | None) -> dict | None:
    if not isinstance(state, dict):
        return state
    for collection_key, table in PAYLOAD_TABLE_COLLECTIONS.items():
        try:
            rows = execute(connection, f"select payload from {table} order by updated_at desc").fetchall()
        except Exception:
            continue
        payloads = [payload for payload in (decode_payload(row_get(row, "payload")) for row in rows) if payload]
        if payloads:
            state[collection_key] = payloads
    return state


def clean_public_user(user: dict) -> dict:
    return public_user(user)


def stamp_payload(payload: dict) -> dict:
    stamped = dict(payload)
    stamped["serverUpdatedAt"] = server_timestamp()
    return stamped
