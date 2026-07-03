from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DATABASE_URL")
DB_PATH = Path(os.environ.get("CLIMAPARC_DB", ROOT / "climaparc.sqlite3"))
SESSION_TTL_SECONDS = int(os.environ.get("CLIMAPARC_SESSION_TTL", "28800"))
USE_POSTGRES = bool(DATABASE_URL)

if USE_POSTGRES:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Jsonb


def connect():
    if USE_POSTGRES:
        return psycopg.connect(DATABASE_URL, row_factory=dict_row)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def sql(statement: str) -> str:
    return statement.replace("?", "%s") if USE_POSTGRES else statement


def execute(connection, statement: str, params: tuple[Any, ...] = ()):
    return connection.execute(sql(statement), params)


def row_get(row, key: str):
    return row[key]


def now_value():
    if USE_POSTGRES:
        return datetime.now(timezone.utc)
    return int(time.time())


def expires_value():
    if USE_POSTGRES:
        return datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
    return int(time.time()) + SESSION_TTL_SECONDS


def server_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_db_value(value: Any):
    if USE_POSTGRES:
        return Jsonb(value)
    return json.dumps(value, ensure_ascii=False)


def password_hash(password: str, salt: str | None = None) -> tuple[str, str]:
    raw_salt = base64.b64decode(salt) if salt else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), raw_salt, 120_000)
    return base64.b64encode(digest).decode("ascii"), base64.b64encode(raw_salt).decode("ascii")


def verify_password(password: str, expected_hash: str, salt: str) -> bool:
    actual_hash, _ = password_hash(password, salt)
    return hmac.compare_digest(actual_hash, expected_hash)
