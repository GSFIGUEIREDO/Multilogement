from __future__ import annotations

import copy
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-equipment-fastapi-"))
DB_PATH = TMP_ROOT / "equipment.sqlite3"

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
            {"id": "u-tech", "name": "Tech", "email": "tech@test.local", "password": "Tech12345", "role": "technicien"},
            {
                "id": "u-client-a",
                "name": "Client A",
                "email": "client-a@test.local",
                "password": "ClientA12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "lieux", "equipment"],
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
        "apartments": [
            {"id": "apt-a", "buildingId": "b-a", "number": "101"},
            {"id": "apt-b", "buildingId": "b-b", "number": "202"},
        ],
        "equipment": [
            {
                "id": "eq-existing",
                "apartmentId": "apt-a",
                "type": "PTAC",
                "brand": "Carrier",
                "model": "42C",
                "serial": "SER-1",
                "attachments": [{"id": "file-1", "name": "Photo 1", "storagePath": "client-a/equipment/file-1.jpg"}],
            }
        ],
        "tickets": [],
        "workOrders": [
            {
                "id": "wo-a",
                "number": "BT-A",
                "buildingId": "b-a",
                "apartmentId": "apt-a",
                "technicianId": "u-tech",
                "assignedTechnicianIds": ["u-tech"],
                "status": "En cours",
            }
        ],
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
    assert server.save_equipment_with_use_cases.__module__ == "src.climaparc.equipment.presentation.dispatch"

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        created = admin_client.post(
            "/api/equipment",
            json={
                "equipment": {
                    "id": "eq-created",
                    "apartmentId": "apt-a",
                    "type": "Fan coil",
                    "brand": "Gree",
                    "model": "G1",
                    "serial": "NEW-1",
                    "status": "Actif",
                }
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["equipment"]["id"] == "eq-created"
        assert any(item["id"] == "eq-created" for item in current_state()["equipment"])

        updated = admin_client.post(
            "/api/equipment",
            json={
                "equipment": {
                    "id": "eq-existing",
                    "apartmentId": "apt-a",
                    "type": "PTAC",
                    "brand": "Carrier",
                    "model": "42C",
                    "serial": "SER-UPDATED",
                    "status": "Surveillance",
                }
            },
        )
        assert updated.status_code == 200, updated.text
        payload = updated.json()["equipment"]
        assert payload["serial"] == "SER-UPDATED"
        assert payload["attachments"][0]["id"] == "file-1"

    with TestClient(app) as client_a:
        login(client_a, "client-a@test.local", "ClientA12345")
        forbidden = client_a.post(
            "/api/equipment",
            json={"equipment": {"id": "eq-client", "apartmentId": "apt-a", "type": "PTAC"}},
        )
        assert forbidden.status_code == 403, forbidden.text

    with TestClient(app) as tech_client:
        login(tech_client, "tech@test.local", "Tech12345")
        allowed = tech_client.post(
            "/api/equipment",
            json={"equipment": {"id": "eq-tech", "apartmentId": "apt-a", "type": "Mini split", "serial": "TECH-1"}},
        )
        assert allowed.status_code == 200, allowed.text
        assert allowed.json()["equipment"]["id"] == "eq-tech"

        blocked = tech_client.post(
            "/api/equipment",
            json={"equipment": {"id": "eq-tech-blocked", "apartmentId": "apt-b", "type": "PTAC"}},
        )
        assert blocked.status_code == 403, blocked.text

    print("equipment_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)

