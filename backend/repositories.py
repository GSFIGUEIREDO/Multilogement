from __future__ import annotations

import json
from typing import Any

from .database import execute, json_db_value, now_value, password_hash, row_get, server_timestamp, USE_POSTGRES


class StateRepository:
    def get(self, connection, lock: bool = False) -> dict | None:
        statement = "select state_json from climaparc_state where id = 1"
        if USE_POSTGRES and lock:
            statement += " for update"
        row = execute(connection, statement).fetchone()
        if not row:
            return None
        value = row_get(row, "state_json")
        return json.loads(value) if isinstance(value, str) else value

    def save(self, connection, state: dict) -> None:
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


def clean_public_user(user: dict) -> dict:
    return {key: value for key, value in user.items() if key != "password"}


def stamp_payload(payload: dict) -> dict:
    stamped = dict(payload)
    stamped["serverUpdatedAt"] = server_timestamp()
    return stamped
