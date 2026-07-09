from __future__ import annotations

import copy
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-fastapi-app-"))
DB_PATH = TMP_ROOT / "app.sqlite3"

sys.path.insert(0, str(ROOT))

os.environ.pop("DATABASE_URL", None)
os.environ.pop("SUPABASE_DATABASE_URL", None)
os.environ["CLIMAPARC_DB"] = str(DB_PATH)
os.environ["APP_BASE_URL"] = "http://testserver"

import server  # noqa: E402
from src.climaparc.main import app  # noqa: E402


def base_state() -> dict:
    return {
        "users": [
            {"id": "u-admin", "name": "Admin", "email": "admin@test.local", "password": "Admin12345", "role": "administrateur"},
            {
                "id": "u-client",
                "name": "Client",
                "email": "client@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "lieux"],
            },
        ],
        "clients": [{"id": "client-a", "name": "Client A"}],
        "buildings": [{"id": "b-a", "clientId": "client-a", "name": "Lieu A"}],
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


def login(client, email: str, password: str):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["ok"] is True

        assert client.get("/").status_code == 200
        assert client.get("/app.js").status_code == 200
        assert client.get("/unhandled-ui-route").status_code == 200
        assert client.get("/api/unknown").status_code == 404

        login(client, "client@test.local", "Client12345")
        forbidden = client.post("/api/state", json={"changes": {"values": {"reportFilters": {"x": 1}}}})
        assert forbidden.status_code == 403, forbidden.text

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        saved = admin_client.post("/api/state", json={"changes": {"values": {"reportFilters": {"period": "month"}}}})
        assert saved.status_code == 200, saved.text
        assert saved.json()["ok"] is True
        assert current_state()["reportFilters"] == {"period": "month"}

        duplicate = copy.deepcopy(current_state())
        duplicate["users"].append({
            "id": "u-duplicate",
            "name": "Duplicate",
            "email": "admin@test.local",
            "role": "client",
            "clientId": "client-a",
        })
        conflict = admin_client.post("/api/state", json={"state": duplicate})
        assert conflict.status_code == 409, conflict.text

    print("fastapi_app_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
