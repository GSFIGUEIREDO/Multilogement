from __future__ import annotations

import os

from backend.database import execute, now_value, password_hash, row_get
from backend.file_storage import migrate_legacy_data_urls
from backend.operational_migrations import migrate_operational_state
from backend.security import sanitize_state_for_storage


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


def ensure_bootstrap_state(
    seed: dict | None,
    *,
    db,
    get_state,
    save_state,
    sync_relational_tables_safely,
) -> dict:
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
            operational_changes = migrate_operational_state(state)
            migrated, warnings = migrate_legacy_data_urls(state)
            for warning in warnings:
                print(warning)
            if migrated or operational_changes:
                save_state(connection, state)
    if state:
        sync_relational_tables_safely(state)
    return state
