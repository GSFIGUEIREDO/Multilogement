from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from backend.database import USE_POSTGRES, connect, execute, expires_value, json_db_value, now_value, row_get, verify_password
from backend.repositories import AuthUserRepository as LegacyAuthUserRepository
from backend.repositories import StateRepository as LegacyStateRepository
from src.climaparc.shared.infrastructure.user_profiles import enrich_user_with_profile
from src.climaparc.users.infrastructure.repositories import DatabaseUserAccountRepository


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

class DatabaseAuthUserRepository:
    def __init__(self, legacy_repository: LegacyAuthUserRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyAuthUserRepository()

    def get_by_email(self, email: str) -> dict | None:
        with connect() as connection:
            row = execute(connection, "select * from climaparc_users where email = ?", (str(email or "").lower(),)).fetchone()
            return enrich_user_with_profile(connection, row_to_dict(row))

    def get_by_id(self, user_id: str) -> dict | None:
        with connect() as connection:
            row = execute(connection, "select * from climaparc_users where id = ?", (user_id,)).fetchone()
            return enrich_user_with_profile(connection, row_to_dict(row))

    def upsert(self, user: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, user)


class DatabaseSignupUserRepository:
    """Auth-facing adapter that creates the authentication and public profile atomically."""

    def __init__(
        self,
        auth_repository: DatabaseAuthUserRepository | None = None,
        account_repository: DatabaseUserAccountRepository | None = None,
    ):
        self.auth_repository = auth_repository or DatabaseAuthUserRepository()
        self.account_repository = account_repository or DatabaseUserAccountRepository()

    def get_by_email(self, email: str) -> dict | None:
        return self.auth_repository.get_by_email(email)

    def get_by_id(self, user_id: str) -> dict | None:
        return self.auth_repository.get_by_id(user_id)

    def upsert(self, user: dict) -> None:
        self.account_repository.upsert(user)


def relation_table(name: str) -> str:
    return f"public.{name}" if USE_POSTGRES else name


def decode_payload(value: Any) -> dict:
    if isinstance(value, str):
        import json

        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return {}
    return dict(value) if isinstance(value, dict) else {}


class DatabaseClientRepository:
    def upsert(self, client: dict) -> None:
        with connect() as connection:
            execute(
                connection,
                f"""
                insert into {relation_table('climaparc_clients')} (
                  id, name, contact, email, phone, payload, updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict(id) do update set
                  name = excluded.name,
                  contact = excluded.contact,
                  email = excluded.email,
                  phone = excluded.phone,
                  payload = excluded.payload,
                  updated_at = excluded.updated_at
                """,
                (
                    client["id"],
                    client.get("name", ""),
                    client.get("contact", ""),
                    client.get("email", ""),
                    client.get("phone", ""),
                    json_db_value(client),
                    now_value(),
                ),
            )


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
            return enrich_user_with_profile(connection, row_to_dict(row))

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


class DatabasePasswordResetRequestRepository:
    def upsert(self, request: dict) -> None:
        with connect() as connection:
            self._upsert(connection, request)

    def mark(self, request_id: str, status: str, used_at: str | None = None) -> None:
        with connect() as connection:
            row = execute(
                connection,
                f"select payload from {relation_table('climaparc_password_reset_requests')} where id = ?",
                (request_id,),
            ).fetchone()
            if not row:
                return
            request = decode_payload(row_get(row, "payload"))
            request["status"] = status
            if used_at:
                request["usedAt"] = used_at
            request["serverUpdatedAt"] = datetime.now(timezone.utc).isoformat()
            self._upsert(connection, request)

    @staticmethod
    def _upsert(connection, request: dict) -> None:
        execute(
            connection,
            f"""
            insert into {relation_table('climaparc_password_reset_requests')} (
              id, email, user_id, status, created_at_text, expires_at_text, payload, updated_at
            )
            values (?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
              email = excluded.email,
              user_id = excluded.user_id,
              status = excluded.status,
              created_at_text = excluded.created_at_text,
              expires_at_text = excluded.expires_at_text,
              payload = excluded.payload,
              updated_at = excluded.updated_at
            """,
            (
                request["id"],
                request.get("email", ""),
                request.get("userId", ""),
                request.get("status", ""),
                request.get("createdAt", ""),
                request.get("expiresAt", ""),
                json_db_value(request),
                now_value(),
            ),
        )


class Pbkdf2PasswordHasher:
    def verify(self, password: str, expected_hash: str, salt: str) -> bool:
        return verify_password(password, expected_hash, salt)
