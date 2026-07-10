from __future__ import annotations

from typing import Any

from backend.database import connect, execute, row_get
from backend.repositories import AuthUserRepository as LegacyAuthUserRepository
from backend.repositories import StateRepository as LegacyStateRepository
from src.climaparc.shared.infrastructure.user_profiles import (
    delete_user_profile,
    enrich_user_with_profile,
    profile_table,
    upsert_user_profile,
)


def row_to_dict(row: Any) -> dict | None:
    if row is None:
        return None
    if isinstance(row, dict):
        return dict(row)
    return {key: row[key] for key in row.keys()}


class DatabaseUserStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            return self.legacy_repository.get(connection, lock=lock)


class DatabaseUserAccountRepository:
    def __init__(self, legacy_repository: LegacyAuthUserRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyAuthUserRepository()

    def upsert(self, user: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, user)
            upsert_user_profile(connection, user)

    def delete(self, user_id: str) -> None:
        with connect() as connection:
            delete_user_profile(connection, user_id)
            self.legacy_repository.delete(connection, user_id)


class DatabaseUserLookupRepository:
    def exists_in_state(self, user_id: str) -> bool:
        with connect() as connection:
            row = execute(connection, f"select 1 from {profile_table()} where id = ?", (user_id,)).fetchone()
        return bool(row)

    def get_auth_user_by_id(self, user_id: str) -> dict | None:
        with connect() as connection:
            row = execute(connection, "select * from climaparc_users where id = ?", (user_id,)).fetchone()
            user = row_to_dict(row)
            return enrich_user_with_profile(connection, user)
