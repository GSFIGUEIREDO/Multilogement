from __future__ import annotations

from typing import Any, Protocol


class StateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...

    def save(self, state: dict) -> None:
        ...


class AuthUserRepository(Protocol):
    def get_by_email(self, email: str) -> dict | None:
        ...

    def get_by_id(self, user_id: str) -> dict | None:
        ...

    def upsert(self, user: dict) -> None:
        ...


class SessionRepository(Protocol):
    def create(self, user_id: str) -> str:
        ...

    def get_user_by_token(self, token: str) -> dict | None:
        ...

    def delete(self, token: str) -> None:
        ...


class PasswordResetTokenRepository(Protocol):
    def save(self, reset_id: str, user_id: str, email: str, token_hash: str, expires_at: str) -> None:
        ...

    def get_by_hash(self, token_hash: str) -> dict | None:
        ...

    def mark(self, token_hash: str, status: str) -> None:
        ...


class PasswordHasher(Protocol):
    def verify(self, password: str, expected_hash: str, salt: str) -> bool:
        ...


Row = Any
