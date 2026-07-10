from __future__ import annotations

import copy
import hashlib
import json
import os
import shutil
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-auth-fastapi-"))
DB_PATH = TMP_ROOT / "auth.sqlite3"

sys.path.insert(0, str(ROOT))

os.environ.pop("DATABASE_URL", None)
os.environ.pop("SUPABASE_DATABASE_URL", None)
os.environ["CLIMAPARC_DB"] = str(DB_PATH)
os.environ["APP_BASE_URL"] = "http://testserver"

import server  # noqa: E402
from src.climaparc.auth.infrastructure.repositories import DatabasePasswordResetTokenRepository  # noqa: E402
from src.climaparc.main import app  # noqa: E402


def base_state() -> dict:
    return {
        "users": [
            {"id": "u-admin", "name": "Admin", "email": "admin@test.local", "password": "Admin12345", "role": "administrateur"},
            {
                "id": "u-client-a",
                "name": "Client A",
                "email": "client-a@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "gestionnaire",
                "portalRights": ["portal", "lieux", "equipment", "tickets", "workorders"],
            },
        ],
        "clients": [
            {"id": "client-a", "name": "Client A"},
            {"id": "client-b", "name": "Client B"},
        ],
        "buildings": [
            {"id": "b-a", "clientId": "client-a", "name": "Lieu A"},
            {"id": "b-b", "clientId": "client-b", "name": "Lieu B"},
        ],
        "apartments": [],
        "equipment": [],
        "tickets": [],
        "workOrders": [],
        "interventions": [],
        "reminders": [],
        "clientDocuments": [],
        "serviceTypes": [],
        "interventionTypes": [],
        "formTemplates": [],
        "roleDefinitions": [],
        "dataFields": [],
        "passwordResetRequests": [],
        "sessionUserId": None,
        "modal": None,
        "toast": "",
    }


def assert_no_key(value, key: str) -> None:
    if isinstance(value, dict):
        assert key not in value, f"{key} leaked in {value}"
        for child in value.values():
            assert_no_key(child, key)
    elif isinstance(value, list):
        for child in value:
            assert_no_key(child, key)


def reset_database() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    server.init_db()
    seed = base_state()
    with server.db() as connection:
        server.save_state(connection, copy.deepcopy(seed))
        server.sync_users(connection, seed)
    server.sync_relational_tables_safely(seed)


def current_state() -> dict:
    with server.db() as connection:
        return server.get_state(connection)


def raw_state() -> dict:
    with server.db() as connection:
        row = server.execute(connection, "select state_json from climaparc_state where id = 1").fetchone()
    value = row["state_json"]
    return json.loads(value) if isinstance(value, str) else value


def table_row(table: str, item_id: str):
    with server.db() as connection:
        return server.execute(connection, f"select * from {table} where id = ?", (item_id,)).fetchone()


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    original_user_ids = {item["id"] for item in raw_state()["users"]}
    original_client_ids = {item["id"] for item in raw_state()["clients"]}
    with TestClient(app) as client:
        assert client.get("/api/session").status_code == 401

        invalid = client.post("/api/login", json={"email": "admin@test.local", "password": "wrong"})
        assert invalid.status_code == 401

        login = client.post("/api/login", json={"email": "admin@test.local", "password": "Admin12345"})
        assert login.status_code == 200, login.text
        login_payload = login.json()
        assert login_payload["user"]["id"] == "u-admin"
        assert "climaparc_session" in login.headers.get("set-cookie", "")
        assert_no_key(login_payload["state"], "password")

        session = client.get("/api/session")
        assert session.status_code == 200
        assert session.json()["authenticated"] is True

        logout = client.post("/api/logout")
        assert logout.status_code == 200
        assert client.get("/api/session").status_code == 401

        client_login = client.post("/api/login", json={"email": "client-a@test.local", "password": "Client12345"})
        assert client_login.status_code == 200
        client_state = client_login.json()["state"]
        assert {item["id"] for item in client_state["clients"]} == {"client-a"}
        assert all(item.get("clientId") != "client-b" for item in client_state.get("buildings", []))

        signup = client.post(
            "/api/signup",
            json={
                "email": "new-client@test.local",
                "password": "NewClient12345",
                "confirmPassword": "NewClient12345",
                "companyName": "New Client",
                "name": "New User",
            },
        )
        assert signup.status_code == 200, signup.text
        assert signup.json()["user"]["role"] == "client"
        assert_no_key(signup.json()["state"], "password")
        signup_user = signup.json()["user"]
        profile = table_row("climaparc_user_profiles", signup_user["id"])
        assert profile is not None
        assert "password" not in json.loads(profile["payload"])
        signup_client = signup.json()["state"]["clients"][0]
        assert table_row("climaparc_clients", signup_client["id"]) is not None
        assert {item["id"] for item in raw_state()["users"]} == original_user_ids
        assert {item["id"] for item in raw_state()["clients"]} == original_client_ids

        reset_request = client.post("/api/password-reset-request", json={"email": "admin@test.local"})
        assert reset_request.status_code == 200
        assert reset_request.json()["ok"] is True
        reset_rows = []
        with server.db() as connection:
            reset_rows = server.execute(connection, "select * from climaparc_password_reset_requests").fetchall()
        assert reset_rows
        assert all("token" not in json.loads(row["payload"]) for row in reset_rows)
        assert raw_state()["passwordResetRequests"] == []
        assert_no_key(current_state(), "tokenHash")

        token = "known-reset-token"
        hashed = hashlib.sha256(token.encode("utf-8")).hexdigest()
        request_id = reset_rows[0]["id"]
        DatabasePasswordResetTokenRepository().save(
            request_id,
            "u-admin",
            "admin@test.local",
            hashed,
            (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        confirm = client.post(
            "/api/password-reset-confirm",
            json={"token": token, "password": "Changed12345", "confirmPassword": "Changed12345"},
        )
        assert confirm.status_code == 200, confirm.text
        used_reset = table_row("climaparc_password_reset_requests", request_id)
        assert used_reset is not None
        assert json.loads(used_reset["payload"])["status"] == "utilise"

        changed_login = client.post("/api/login", json={"email": "admin@test.local", "password": "Changed12345"})
        assert changed_login.status_code == 200, changed_login.text

    print("auth_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
