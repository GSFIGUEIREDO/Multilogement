from __future__ import annotations

import secrets
from typing import Any

from backend.database import connect, execute, expires_value, now_value, row_get, verify_password
from backend.repositories import AuthUserRepository as LegacyAuthUserRepository
from backend.repositories import StateRepository as LegacyStateRepository


def row_to_dict(row: Any) -> dict | None:
    if row is None:
        return None
    if isinstance(row, dict):
        return dict(row)
    return {key: row[key] for key in row.keys()}


class DatabaseStateRepository:
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

    def get_by_email(self, email: str) -> dict | None:
        with connect() as connection:
            row = execute(connection, "select * from climaparc_users where email = ?", (str(email or "").lower(),)).fetchone()
        return row_to_dict(row)

    def get_by_id(self, user_id: str) -> dict | None:
        with connect() as connection:
            row = execute(connection, "select * from climaparc_users where id = ?", (user_id,)).fetchone()
        return row_to_dict(row)

    def upsert(self, user: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, user)


class DatabaseSessionRepository:
    def create(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        with connect() as connection:
            execute(
                connection,
                "insert into climaparc_sessions (token, user_id, expires_at) values (?, ?, ?)",
                (token, user_id, expires_value()),
            )
        return token

    def get_user_by_token(self, token: str) -> dict | None:
        with connect() as connection:
            row = execute(
                connection,
                """
                select u.*
                from climaparc_sessions s
                join climaparc_users u on u.id = s.user_id
                where s.token = ? and s.expires_at > ?
                """,
                (token, now_value()),
            ).fetchone()
        return row_to_dict(row)

    def delete(self, token: str) -> None:
        with connect() as connection:
            execute(connection, "delete from climaparc_sessions where token = ?", (token,))


class DatabasePasswordResetTokenRepository:
    def save(self, reset_id: str, user_id: str, email: str, token_hash: str, expires_at: str) -> None:
        with connect() as connection:
            execute(
                connection,
                """
                insert into climaparc_password_reset_tokens (
                  token_hash, reset_id, user_id, email, status, expires_at_text, updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict(token_hash) do update set
                  reset_id = excluded.reset_id,
                  user_id = excluded.user_id,
                  email = excluded.email,
                  status = excluded.status,
                  expires_at_text = excluded.expires_at_text,
                  updated_at = excluded.updated_at
                """,
                (token_hash, reset_id, user_id, email, "active", expires_at, now_value()),
            )

    def get_by_hash(self, token_hash: str) -> dict | None:
        with connect() as connection:
            row = execute(
                connection,
                """
                select token_hash, reset_id, user_id, email, status, expires_at_text
                from climaparc_password_reset_tokens
                where token_hash = ?
                """,
                (token_hash,),
            ).fetchone()
        return row_to_dict(row)

    def mark(self, token_hash: str, status: str) -> None:
        with connect() as connection:
            execute(
                connection,
                "update climaparc_password_reset_tokens set status = ?, updated_at = ? where token_hash = ?",
                (status, now_value(), token_hash),
            )


class Pbkdf2PasswordHasher:
    def verify(self, password: str, expected_hash: str, salt: str) -> bool:
        return verify_password(password, expected_hash, salt)
