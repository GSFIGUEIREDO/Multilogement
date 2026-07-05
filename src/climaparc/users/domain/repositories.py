from __future__ import annotations

from typing import Any, Protocol


class UserStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...

    def save(self, state: dict) -> None:
        ...


class AuthUserRepository(Protocol):
    def upsert(self, user: dict) -> None:
        ...

    def delete(self, user_id: str) -> None:
        ...


class UserLookupRepository(Protocol):
    def exists_in_state(self, user_id: str) -> bool:
        ...

    def get_auth_user_by_id(self, user_id: str) -> dict | None:
        ...

