from __future__ import annotations

from typing import Any

from backend.database import connect, execute, row_get
from backend.repositories import AuthUserRepository as LegacyAuthUserRepository
from backend.repositories import StateRepository as LegacyStateRepository


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

    def save(self, state: dict) -> None:
        with connect() as connection:
            self.legacy_repository.save(connection, state)


class DatabaseAuthUserRepository:
    def __init__(self, legacy_repository: LegacyAuthUserRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyAuthUserRepository()

    def upsert(self, user: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, user)

    def delete(self, user_id: str) -> None:
        with connect() as connection:
            self.legacy_repository.delete(connection, user_id)


class DatabaseUserLookupRepository:
    def exists_in_state(self, user_id: str) -> bool:
        state = DatabaseUserStateRepository().get(lock=False) or {}
        return any(item.get("id") == user_id for item in state.get("users", []) if isinstance(item, dict))

    def get_auth_user_by_id(self, user_id: str) -> dict | None:
        with connect() as connection:
            row = execute(connection, "select * from climaparc_users where id = ?", (user_id,)).fetchone()
        return row_to_dict(row)

