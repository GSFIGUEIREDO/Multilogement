from __future__ import annotations

import json
from typing import Any

from backend.database import USE_POSTGRES, execute, json_db_value, now_value, row_get
from backend.security import public_user


def profile_table() -> str:
    return "public.climaparc_user_profiles" if USE_POSTGRES else "climaparc_user_profiles"


def decode_profile(value: Any) -> dict:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return {}
    return dict(value) if isinstance(value, dict) else {}


def load_user_profile(connection, user_id: str) -> dict:
    row = execute(connection, f"select payload from {profile_table()} where id = ?", (user_id,)).fetchone()
    return decode_profile(row_get(row, "payload")) if row else {}


def enrich_user_with_profile(connection, user: dict | None) -> dict | None:
    if not user:
        return user
    profile = load_user_profile(connection, str(user.get("id") or ""))
    return {**user, **profile}


def upsert_user_profile(connection, user: dict) -> dict:
    profile = public_user(user)
    execute(
        connection,
        f"""
        insert into {profile_table()} (
          id, name, email, role, client_id, client_access_level, payload, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          name = excluded.name,
          email = excluded.email,
          role = excluded.role,
          client_id = excluded.client_id,
          client_access_level = excluded.client_access_level,
          payload = excluded.payload,
          updated_at = excluded.updated_at
        """,
        (
            profile["id"],
            profile.get("name", ""),
            profile.get("email", ""),
            profile.get("role", ""),
            profile.get("clientId"),
            profile.get("clientAccessLevel"),
            json_db_value(profile),
            now_value(),
        ),
    )
    return profile


def delete_user_profile(connection, user_id: str) -> None:
    execute(connection, f"delete from {profile_table()} where id = ?", (user_id,))
