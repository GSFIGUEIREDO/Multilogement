from __future__ import annotations

import copy
import hashlib
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


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
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

        reset_request = client.post("/api/password-reset-request", json={"email": "admin@test.local"})
        assert reset_request.status_code == 200
        assert reset_request.json()["ok"] is True
        assert_no_key(current_state(), "tokenHash")

        token = "known-reset-token"
        hashed = hashlib.sha256(token.encode("utf-8")).hexdigest()
        DatabasePasswordResetTokenRepository().save(
            "reset-known",
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

        changed_login = client.post("/api/login", json={"email": "admin@test.local", "password": "Changed12345"})
        assert changed_login.status_code == 200, changed_login.text

    print("auth_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
