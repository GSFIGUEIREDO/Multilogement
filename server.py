from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import sqlite3
import smtplib
import time
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DATABASE_URL")
DB_PATH = Path(os.environ.get("CLIMAPARC_DB", ROOT / "climaparc.sqlite3"))
SESSION_TTL_SECONDS = int(os.environ.get("CLIMAPARC_SESSION_TTL", "28800"))
HOST = os.environ.get("CLIMAPARC_HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT") or os.environ.get("CLIMAPARC_PORT", "8000"))
USE_POSTGRES = bool(DATABASE_URL)
PASSWORD_RESET_TTL_SECONDS = int(os.environ.get("CLIMAPARC_PASSWORD_RESET_TTL", "3600"))
APP_BASE_URL = os.environ.get("APP_BASE_URL", "").rstrip("/")
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER or "no-reply@climaparc.ca")

if USE_POSTGRES:
    import psycopg
    from psycopg.rows import dict_row


def db():
    if USE_POSTGRES:
        return psycopg.connect(DATABASE_URL, row_factory=dict_row)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def sql(statement: str) -> str:
    return statement.replace("?", "%s") if USE_POSTGRES else statement


def execute(connection, statement: str, params: tuple[Any, ...] = ()):
    return connection.execute(sql(statement), params)


def now_value():
    if USE_POSTGRES:
        return datetime.now(timezone.utc)
    return int(time.time())


def expires_value():
    if USE_POSTGRES:
        return datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
    return int(time.time()) + SESSION_TTL_SECONDS


def row_get(row, key: str):
    return row[key]


def init_db() -> None:
    with db() as connection:
        if USE_POSTGRES:
            connection.execute(
                """
                create table if not exists public.climaparc_state (
                  id integer primary key check (id = 1),
                  state_json jsonb not null,
                  updated_at timestamptz not null default now()
                )
                """
            )
            connection.execute(
                """
                create table if not exists public.climaparc_users (
                  id text primary key,
                  email text unique not null,
                  name text not null,
                  role text not null,
                  client_id text,
                  password_hash text not null,
                  salt text not null,
                  updated_at timestamptz not null default now()
                )
                """
            )
            connection.execute(
                """
                create table if not exists public.climaparc_sessions (
                  token text primary key,
                  user_id text not null references public.climaparc_users(id) on delete cascade,
                  expires_at timestamptz not null
                )
                """
            )
            connection.execute("create index if not exists climaparc_sessions_user_id_idx on public.climaparc_sessions(user_id)")
            connection.execute("create index if not exists climaparc_sessions_expires_at_idx on public.climaparc_sessions(expires_at)")
            return

        connection.executescript(
            """
            create table if not exists climaparc_state (
              id integer primary key check (id = 1),
              state_json text not null,
              updated_at integer not null
            );

            create table if not exists climaparc_users (
              id text primary key,
              email text unique not null,
              name text not null,
              role text not null,
              client_id text,
              password_hash text not null,
              salt text not null,
              updated_at integer not null
            );

            create table if not exists climaparc_sessions (
              token text primary key,
              user_id text not null references climaparc_users(id) on delete cascade,
              expires_at integer not null
            );
            """
        )


def password_hash(password: str, salt: str | None = None) -> tuple[str, str]:
    raw_salt = base64.b64decode(salt) if salt else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), raw_salt, 120_000)
    return base64.b64encode(digest).decode("ascii"), base64.b64encode(raw_salt).decode("ascii")


def verify_password(password: str, expected_hash: str, salt: str) -> bool:
    actual_hash, _ = password_hash(password, salt)
    return hmac.compare_digest(actual_hash, expected_hash)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def reset_expiry_iso() -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=PASSWORD_RESET_TTL_SECONDS)).isoformat()


def reset_expired(value: str | None) -> bool:
    if not value:
        return True
    try:
        return datetime.fromisoformat(value) < datetime.now(timezone.utc)
    except ValueError:
        return True


def public_base_url(headers) -> str:
    if APP_BASE_URL:
        return APP_BASE_URL
    host = headers.get("Host", f"{HOST}:{PORT}")
    scheme = headers.get("X-Forwarded-Proto", "https" if "onrender.com" in host else "http")
    return f"{scheme}://{host}".rstrip("/")


def send_password_reset_email(email: str, reset_url: str) -> bool:
    if not SMTP_HOST:
        return False
    message = EmailMessage()
    message["Subject"] = "Réinitialisation de votre mot de passe ClimaParc"
    message["From"] = SMTP_FROM
    message["To"] = email
    message.set_content(
        "\n".join([
            "Bonjour,",
            "",
            "Vous avez demandé la réinitialisation de votre mot de passe ClimaParc.",
            f"Utilisez ce lien dans la prochaine heure: {reset_url}",
            "",
            "Si vous n'avez pas demandé cette opération, vous pouvez ignorer ce message.",
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


def get_state(connection) -> dict | None:
    row = execute(connection, "select state_json from climaparc_state where id = 1").fetchone()
    if not row:
        return None
    value = row_get(row, "state_json")
    return json.loads(value) if isinstance(value, str) else value


def save_state(connection, state: dict) -> None:
    execute(
        connection,
        """
        insert into climaparc_state (id, state_json, updated_at)
        values (1, ?, ?)
        on conflict(id) do update set state_json = excluded.state_json, updated_at = excluded.updated_at
        """,
        (json.dumps(state, ensure_ascii=False), now_value()),
    )


MERGE_BY_ID_KEYS = {
    "users",
    "clients",
    "buildings",
    "apartments",
    "equipment",
    "tickets",
    "workOrders",
    "interventions",
    "reminders",
    "clientDocuments",
    "serviceTypes",
    "interventionTypes",
    "formTemplates",
    "roleDefinitions",
    "dataFields",
    "passwordResetRequests",
}


def item_timestamp(item: dict) -> str:
    for key in ("updatedAt", "updated_at", "modifiedAt", "createdAt", "uploadedAt", "date"):
        value = item.get(key)
        if value:
            return str(value)
    return ""


def merge_by_id(current_items: list[Any], incoming_items: list[Any]) -> list[Any]:
    current_items = current_items or []
    incoming_items = incoming_items or []
    current_map = {
        item.get("id"): item
        for item in current_items
        if isinstance(item, dict) and item.get("id")
    }
    incoming_map = {
        item.get("id"): item
        for item in incoming_items
        if isinstance(item, dict) and item.get("id")
    }
    ordered_ids: list[str] = []
    for item in incoming_items + current_items:
        if isinstance(item, dict) and item.get("id") and item["id"] not in ordered_ids:
            ordered_ids.append(item["id"])

    merged: list[Any] = []
    for item_id in ordered_ids:
        current = current_map.get(item_id)
        incoming = incoming_map.get(item_id)
        if current and incoming:
            current_stamp = item_timestamp(current)
            incoming_stamp = item_timestamp(incoming)
            chosen = current if current_stamp and incoming_stamp and current_stamp > incoming_stamp else incoming
            if isinstance(current.get("attachments"), list) or isinstance(incoming.get("attachments"), list):
                chosen = dict(chosen)
                chosen["attachments"] = merge_by_id(current.get("attachments", []), incoming.get("attachments", []))
            merged.append(chosen)
        else:
            merged.append(incoming or current)
    return merged


def merge_shared_state(current: dict | None, incoming: dict) -> dict:
    if not current:
        return incoming
    merged = {**current, **incoming}
    for key in MERGE_BY_ID_KEYS:
        if isinstance(current.get(key), list) or isinstance(incoming.get(key), list):
            merged[key] = merge_by_id(current.get(key, []), incoming.get(key, []))
    return merged


def sync_users(connection, state: dict) -> None:
    for user in state.get("users", []):
        password = str(user.get("password") or "")
        existing = execute(connection, "select salt from climaparc_users where id = ?", (user["id"],)).fetchone()
        digest, salt = password_hash(password, row_get(existing, "salt") if existing else None)
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
                user["email"].lower(),
                user.get("name", ""),
                user.get("role", ""),
                user.get("clientId"),
                digest,
                salt,
                now_value(),
            ),
        )


def ensure_bootstrap_state(seed: dict | None) -> dict:
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
        return state


def new_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(8)}"


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    with db() as connection:
        execute(
            connection,
            "insert into climaparc_sessions (token, user_id, expires_at) values (?, ?, ?)",
            (token, user_id, expires_value()),
        )
    return token


def read_session(cookie_header: str | None):
    if not cookie_header:
        return None
    cookie = SimpleCookie()
    cookie.load(cookie_header)
    token = cookie.get("climaparc_session")
    if not token:
        return None
    with db() as connection:
        execute(connection, "delete from climaparc_sessions where expires_at < ?", (now_value(),))
        return execute(
            connection,
            """
            select climaparc_users.* from climaparc_sessions
            join climaparc_users on climaparc_users.id = climaparc_sessions.user_id
            where climaparc_sessions.token = ? and climaparc_sessions.expires_at >= ?
            """,
            (token.value, now_value()),
        ).fetchone()


class Handler(BaseHTTPRequestHandler):
    server_version = "ClimaParc/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.json_response({"ok": True, "database": "postgres" if USE_POSTGRES else "sqlite"})
            return
        if parsed.path == "/api/session":
            self.handle_session()
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/login":
            self.handle_login()
            return
        if parsed.path == "/api/signup":
            self.handle_signup()
            return
        if parsed.path == "/api/password-reset-request":
            self.handle_password_reset_request()
            return
        if parsed.path == "/api/password-reset-confirm":
            self.handle_password_reset_confirm()
            return
        if parsed.path == "/api/logout":
            self.handle_logout()
            return
        if parsed.path == "/api/state":
            self.handle_save_state()
            return
        self.json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def handle_session(self) -> None:
        user = read_session(self.headers.get("Cookie"))
        if not user:
            self.json_response({"authenticated": False}, HTTPStatus.UNAUTHORIZED)
            return
        with db() as connection:
            state = get_state(connection)
        self.json_response({"authenticated": True, "user": public_user(user), "state": state})

    def handle_login(self) -> None:
        payload = self.read_json()
        state = ensure_bootstrap_state(payload.get("seed"))
        email = str(payload.get("email", "")).lower()
        password = str(payload.get("password", ""))
        with db() as connection:
            user = execute(connection, "select * from climaparc_users where email = ?", (email,)).fetchone()
        if not user or not verify_password(password, row_get(user, "password_hash"), row_get(user, "salt")):
            self.json_response({"error": "Courriel ou mot de passe invalide."}, HTTPStatus.UNAUTHORIZED)
            return
        token = create_session(row_get(user, "id"))
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", f"climaparc_session={token}; HttpOnly; Path=/; SameSite=Lax")
        self.end_headers()
        self.wfile.write(json.dumps({"user": public_user(user), "state": state}, ensure_ascii=False).encode("utf-8"))

    def handle_signup(self) -> None:
        payload = self.read_json()
        state = ensure_bootstrap_state(payload.get("seed"))
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        confirm_password = str(payload.get("confirmPassword", ""))
        company_name = str(payload.get("companyName", "")).strip()
        name = str(payload.get("name", "")).strip()
        phone = str(payload.get("phone", "")).strip()

        if not email or not password or not company_name or not name:
            self.json_response({"error": "Tous les champs obligatoires doivent être remplis."}, HTTPStatus.BAD_REQUEST)
            return
        if password != confirm_password:
            self.json_response({"error": "Les mots de passe ne correspondent pas."}, HTTPStatus.BAD_REQUEST)
            return
        if len(password) < 8:
            self.json_response({"error": "Le mot de passe doit contenir au moins 8 caractères."}, HTTPStatus.BAD_REQUEST)
            return

        with db() as connection:
            existing = execute(connection, "select id from climaparc_users where email = ?", (email,)).fetchone()
            if existing:
                self.json_response({"error": "Un compte existe déjà avec ce courriel."}, HTTPStatus.CONFLICT)
                return

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
            state.setdefault("users", []).append(user)
            save_state(connection, state)
            sync_users(connection, state)

        token = create_session(user["id"])
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", f"climaparc_session={token}; HttpOnly; Path=/; SameSite=Lax")
        self.end_headers()
        self.wfile.write(json.dumps({"user": {k: v for k, v in user.items() if k != "password"}, "state": state}, ensure_ascii=False).encode("utf-8"))

    def handle_password_reset_request(self) -> None:
        payload = self.read_json()
        state = ensure_bootstrap_state(payload.get("seed"))
        email = str(payload.get("email", "")).strip().lower()
        email_sent = False
        if email:
            with db() as connection:
                user = execute(connection, "select * from climaparc_users where email = ?", (email,)).fetchone()
                reset_record = {
                    "id": new_id("reset"),
                    "email": email,
                    "createdAt": datetime.now(timezone.utc).date().isoformat(),
                    "status": "nouvelle",
                    "emailSent": False,
                }
                if user:
                    token = secrets.token_urlsafe(32)
                    reset_url = f"{public_base_url(self.headers)}/?resetToken={token}"
                    email_sent = send_password_reset_email(email, reset_url)
                    reset_record.update({
                        "userId": row_get(user, "id"),
                        "tokenHash": token_hash(token),
                        "expiresAt": reset_expiry_iso(),
                        "status": "email_envoye" if email_sent else "email_non_configure",
                        "emailSent": email_sent,
                    })
                state.setdefault("passwordResetRequests", []).insert(0, reset_record)
                state["passwordResetRequests"] = state["passwordResetRequests"][:100]
                save_state(connection, state)
        self.json_response({"ok": True, "emailSent": email_sent, "mailConfigured": bool(SMTP_HOST)})

    def handle_password_reset_confirm(self) -> None:
        payload = self.read_json()
        state = ensure_bootstrap_state(payload.get("seed"))
        token = str(payload.get("token", "")).strip()
        password = str(payload.get("password", ""))
        confirm_password = str(payload.get("confirmPassword", ""))
        if not token:
            self.json_response({"error": "Lien de réinitialisation invalide."}, HTTPStatus.BAD_REQUEST)
            return
        if password != confirm_password:
            self.json_response({"error": "Les mots de passe ne correspondent pas."}, HTTPStatus.BAD_REQUEST)
            return
        if len(password) < 8:
            self.json_response({"error": "Le mot de passe doit contenir au moins 8 caractères."}, HTTPStatus.BAD_REQUEST)
            return

        hashed = token_hash(token)
        reset_request = next(
            (
                item for item in state.get("passwordResetRequests", [])
                if item.get("tokenHash") == hashed and item.get("status") not in {"utilise", "expire"}
            ),
            None,
        )
        if not reset_request or reset_expired(reset_request.get("expiresAt")):
            if reset_request:
                reset_request["status"] = "expire"
                with db() as connection:
                    save_state(connection, state)
            self.json_response({"error": "Lien expiré ou invalide."}, HTTPStatus.BAD_REQUEST)
            return

        user = next((item for item in state.get("users", []) if item.get("id") == reset_request.get("userId")), None)
        if not user:
            self.json_response({"error": "Compte introuvable."}, HTTPStatus.BAD_REQUEST)
            return
        user["password"] = password
        reset_request["status"] = "utilise"
        reset_request["usedAt"] = datetime.now(timezone.utc).isoformat()
        with db() as connection:
            save_state(connection, state)
            sync_users(connection, state)
        self.json_response({"ok": True})

    def handle_logout(self) -> None:
        cookie_header = self.headers.get("Cookie")
        if cookie_header:
            cookie = SimpleCookie()
            cookie.load(cookie_header)
            token = cookie.get("climaparc_session")
            if token:
                with db() as connection:
                    execute(connection, "delete from climaparc_sessions where token = ?", (token.value,))
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", "climaparc_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0")
        self.end_headers()
        self.wfile.write(b'{"ok": true}')

    def handle_save_state(self) -> None:
        user = read_session(self.headers.get("Cookie"))
        if not user:
            self.json_response({"error": "Session expirée."}, HTTPStatus.UNAUTHORIZED)
            return
        payload = self.read_json()
        state = payload.get("state")
        if not isinstance(state, dict):
            self.json_response({"error": "Invalid state"}, HTTPStatus.BAD_REQUEST)
            return
        state["sessionUserId"] = None
        state["modal"] = None
        state["toast"] = ""
        with db() as connection:
            current_state = get_state(connection)
            merged_state = merge_shared_state(current_state, state)
            merged_state["sessionUserId"] = None
            merged_state["modal"] = None
            merged_state["toast"] = ""
            save_state(connection, merged_state)
            sync_users(connection, merged_state)
        self.json_response({"ok": True, "state": merged_state})

    def serve_static(self, raw_path: str) -> None:
        path = "/index.html" if raw_path in ("", "/") else raw_path
        requested = (ROOT / unquote(path).lstrip("/")).resolve()
        if not str(requested).startswith(str(ROOT)) or not requested.is_file():
            self.json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)
            return
        content_type = mimetypes.guess_type(requested.name)[0] or "application/octet-stream"
        body = requested.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if requested.name in {"app.js", "index.html"} else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(body or "{}")

    def json_response(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        if os.environ.get("CLIMAPARC_DEBUG"):
            super().log_message(format, *args)


def public_user(row) -> dict:
    return {
        "id": row_get(row, "id"),
        "email": row_get(row, "email"),
        "name": row_get(row, "name"),
        "role": row_get(row, "role"),
        "clientId": row_get(row, "client_id"),
    }


def main() -> None:
    init_db()
    database_name = "Supabase/Postgres" if USE_POSTGRES else f"SQLite ({DB_PATH.name})"
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ClimaParc online sur http://{HOST}:{PORT} avec {database_name}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
