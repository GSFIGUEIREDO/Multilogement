from __future__ import annotations

import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from http import HTTPStatus
from http.cookies import SimpleCookie
from typing import Any

from .database import connect, execute, now_value, expires_value, row_get, verify_password
from .repositories import AuthUserRepository, StateRepository
from .security import filter_state_for_user, public_user, public_user_from_row


PASSWORD_RESET_TTL_SECONDS = int(os.environ.get("CLIMAPARC_PASSWORD_RESET_TTL", "3600"))
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER or "no-reply@climaparc.ca")


class AuthServiceError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status = status


def new_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(6)}"


def reset_expiry_iso() -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=PASSWORD_RESET_TTL_SECONDS)).isoformat()


def reset_expired(value: str | None) -> bool:
    if not value:
        return True
    try:
        return datetime.fromisoformat(value) < datetime.now(timezone.utc)
    except ValueError:
        return True


def token_hash(token: str) -> str:
    import hashlib

    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class SessionService:
    def create(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        with connect() as connection:
            execute(
                connection,
                "insert into climaparc_sessions (token, user_id, expires_at) values (?, ?, ?)",
                (token, user_id, expires_value()),
            )
        return token

    def read(self, cookie_header: str | None):
        if not cookie_header:
            return None
        cookie = SimpleCookie()
        cookie.load(cookie_header)
        token = cookie.get("climaparc_session")
        if not token:
            return None
        with connect() as connection:
            row = execute(
                connection,
                """
                select u.*
                from climaparc_sessions s
                join climaparc_users u on u.id = s.user_id
                where s.token = ? and s.expires_at > ?
                """,
                (token.value, now_value()),
            ).fetchone()
        return row

    def logout(self, cookie_header: str | None) -> None:
        if not cookie_header:
            return
        cookie = SimpleCookie()
        cookie.load(cookie_header)
        token = cookie.get("climaparc_session")
        if not token:
            return
        with connect() as connection:
            execute(connection, "delete from climaparc_sessions where token = ?", (token.value,))


class AuthService:
    def __init__(
        self,
        state_repository: StateRepository | None = None,
        auth_repository: AuthUserRepository | None = None,
        session_service: SessionService | None = None,
    ):
        self.state_repository = state_repository or StateRepository()
        self.auth_repository = auth_repository or AuthUserRepository()
        self.session_service = session_service or SessionService()

    def login(self, email: str, password: str, fallback_state: dict | None = None) -> dict:
        clean_email = str(email or "").strip().lower()
        with connect() as connection:
            state = self.state_repository.get(connection) or fallback_state or {}
            user = execute(connection, "select * from climaparc_users where email = ?", (clean_email,)).fetchone()
        if not user or not verify_password(password, row_get(user, "password_hash"), row_get(user, "salt")):
            raise AuthServiceError("Courriel ou mot de passe invalide.", HTTPStatus.UNAUTHORIZED)
        token = self.session_service.create(row_get(user, "id"))
        return {
            "token": token,
            "user": public_user_from_row(user),
            "state": filter_state_for_user(state, user),
        }

    def signup(self, payload: dict, fallback_state: dict | None = None) -> dict:
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        confirm_password = str(payload.get("confirmPassword", ""))
        company_name = str(payload.get("companyName", "")).strip()
        name = str(payload.get("name", "")).strip()
        phone = str(payload.get("phone", "")).strip()

        if not email or not password or not company_name or not name:
            raise AuthServiceError("Tous les champs obligatoires doivent etre remplis.")
        if password != confirm_password:
            raise AuthServiceError("Les mots de passe ne correspondent pas.")
        if len(password) < 8:
            raise AuthServiceError("Le mot de passe doit contenir au moins 8 caracteres.")

        with connect() as connection:
            state = self.state_repository.get(connection, lock=True) or fallback_state or {}
            existing = execute(connection, "select id from climaparc_users where email = ?", (email,)).fetchone()
            if existing:
                raise AuthServiceError("Un compte existe deja avec ce courriel.", HTTPStatus.CONFLICT)

            client = {
                "id": new_id("client"),
                "name": company_name,
                "contact": name,
                "email": email,
                "phone": phone,
            }
            user = {
                "id": new_id("u"),
                "name": name,
                "email": email,
                "password": password,
                "role": "client",
                "clientId": client["id"],
            }
            state.setdefault("clients", []).append(client)
            state.setdefault("users", []).append(public_user(user))
            self.auth_repository.upsert(connection, user)
            self.state_repository.save(connection, state)

        token = self.session_service.create(user["id"])
        return {
            "token": token,
            "client": client,
            "user": public_user(user),
            "state": state,
        }


class PasswordResetService:
    def __init__(
        self,
        state_repository: StateRepository | None = None,
        auth_repository: AuthUserRepository | None = None,
    ):
        self.state_repository = state_repository or StateRepository()
        self.auth_repository = auth_repository or AuthUserRepository()

    def request_reset(self, email: str, base_url: str, fallback_state: dict | None = None) -> dict:
        clean_email = str(email or "").strip().lower()
        email_sent = False
        state = fallback_state or {}
        if not clean_email:
            return {"ok": True, "emailSent": False, "mailConfigured": bool(SMTP_HOST), "state": state}

        with connect() as connection:
            state = self.state_repository.get(connection, lock=True) or state
            user = execute(connection, "select * from climaparc_users where email = ?", (clean_email,)).fetchone()
            reset_record = {
                "id": new_id("reset"),
                "email": clean_email,
                "createdAt": datetime.now(timezone.utc).date().isoformat(),
                "status": "nouvelle",
                "emailSent": False,
            }
            if user:
                token = secrets.token_urlsafe(32)
                expires_at = reset_expiry_iso()
                reset_url = f"{base_url}/?resetToken={token}"
                email_sent = self._send_password_reset_email(clean_email, reset_url)
                self._save_password_reset_token(
                    connection,
                    reset_record["id"],
                    row_get(user, "id"),
                    clean_email,
                    token_hash(token),
                    expires_at,
                )
                reset_record.update({
                    "userId": row_get(user, "id"),
                    "expiresAt": expires_at,
                    "status": "email_envoye" if email_sent else "email_non_configure",
                    "emailSent": email_sent,
                })
            state.setdefault("passwordResetRequests", []).insert(0, reset_record)
            state["passwordResetRequests"] = state["passwordResetRequests"][:100]
            self.state_repository.save(connection, state)

        return {"ok": True, "emailSent": email_sent, "mailConfigured": bool(SMTP_HOST), "state": state}

    def confirm_reset(self, token: str, password: str, confirm_password: str, fallback_state: dict | None = None) -> dict:
        clean_token = str(token or "").strip()
        if not clean_token:
            raise AuthServiceError("Lien de reinitialisation invalide.")
        if password != confirm_password:
            raise AuthServiceError("Les mots de passe ne correspondent pas.")
        if len(password) < 8:
            raise AuthServiceError("Le mot de passe doit contenir au moins 8 caracteres.")

        hashed = token_hash(clean_token)
        with connect() as connection:
            reset_token = self._password_reset_token_row(connection, hashed)
        if not reset_token or row_get(reset_token, "status") != "active" or reset_expired(row_get(reset_token, "expires_at_text")):
            if reset_token:
                with connect() as connection:
                    state = self.state_repository.get(connection, lock=True) or fallback_state or {}
                    reset_request = self._reset_request_from_state(state, row_get(reset_token, "reset_id"))
                    if reset_request:
                        reset_request["status"] = "expire"
                        reset_request["usedAt"] = datetime.now(timezone.utc).isoformat()
                        self.state_repository.save(connection, state)
                    self._mark_password_reset_token(connection, hashed, "expire")
            raise AuthServiceError("Lien expire ou invalide.")

        with connect() as connection:
            state = self.state_repository.get(connection, lock=True) or fallback_state or {}
            reset_request = self._reset_request_from_state(state, row_get(reset_token, "reset_id"))
            user = next((item for item in state.get("users", []) if item.get("id") == row_get(reset_token, "user_id")), None)
            if not user:
                raise AuthServiceError("Compte introuvable.")
            user_payload = {**user, "password": password}
            self.auth_repository.upsert(connection, user_payload)
            if reset_request:
                reset_request["status"] = "utilise"
                reset_request["usedAt"] = datetime.now(timezone.utc).isoformat()
            self._mark_password_reset_token(connection, hashed, "utilise")
            self.state_repository.save(connection, state)
        return {"ok": True, "state": state}

    @staticmethod
    def _reset_request_from_state(state: dict, reset_id: str) -> dict | None:
        return next(
            (
                item for item in state.get("passwordResetRequests", [])
                if isinstance(item, dict) and item.get("id") == reset_id
            ),
            None,
        )

    @staticmethod
    def _save_password_reset_token(connection, reset_id: str, user_id: str, email: str, hashed_token: str, expires_at: str) -> None:
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
            (hashed_token, reset_id, user_id, email, "active", expires_at, now_value()),
        )

    @staticmethod
    def _password_reset_token_row(connection, hashed_token: str):
        return execute(
            connection,
            """
            select token_hash, reset_id, user_id, email, status, expires_at_text
            from climaparc_password_reset_tokens
            where token_hash = ?
            """,
            (hashed_token,),
        ).fetchone()

    @staticmethod
    def _mark_password_reset_token(connection, hashed_token: str, status: str) -> None:
        execute(
            connection,
            "update climaparc_password_reset_tokens set status = ?, updated_at = ? where token_hash = ?",
            (status, now_value(), hashed_token),
        )

    @staticmethod
    def _send_password_reset_email(email: str, reset_url: str) -> bool:
        if not SMTP_HOST:
            return False
        message = EmailMessage()
        message["Subject"] = "Reinitialisation de votre mot de passe ClimaParc"
        message["From"] = SMTP_FROM
        message["To"] = email
        message.set_content(
            "\n".join([
                "Bonjour,",
                "",
                "Vous avez demande la reinitialisation de votre mot de passe ClimaParc.",
                f"Utilisez ce lien dans la prochaine heure: {reset_url}",
                "",
                "Si vous n'avez pas demande cette operation, vous pouvez ignorer ce message.",
            ])
        )
        try:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
                smtp.starttls()
                if SMTP_USER or SMTP_PASSWORD:
                    smtp.login(SMTP_USER, SMTP_PASSWORD)
                smtp.send_message(message)
            return True
        except Exception as error:
            print(f"Password reset email failed: {error}")
            return False
