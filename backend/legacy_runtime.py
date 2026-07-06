from __future__ import annotations

import os
from pathlib import Path

from backend.bootstrap import (
    bootstrap_password_for_user as bootstrap_password_for_user_impl,
    ensure_bootstrap_state as ensure_bootstrap_state_impl,
    sync_users as sync_users_impl,
)
from backend.database import DB_PATH, USE_POSTGRES, connect as db, execute
from backend.legacy_endpoint_bridge import LegacyEndpointContext
from backend.repositories import StateRepository
from backend.schema import init_db as init_database_schema
from backend.sync_services import (
    sync_relational_tables as sync_relational_tables_external,
    sync_relational_tables_safely as sync_relational_tables_safely_external,
)


ROOT = Path(__file__).resolve().parent.parent
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


LEGACY_ENDPOINT_CONTEXT = LegacyEndpointContext(
    db=db,
    get_state=get_state,
    save_state=save_state,
    sync_users=sync_users,
    sync_relational_tables_safely=sync_relational_tables_safely,
    ensure_bootstrap_state=ensure_bootstrap_state,
    public_base_url=public_base_url,
)
