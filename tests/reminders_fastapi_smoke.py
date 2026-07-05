from __future__ import annotations

import copy
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-reminders-fastapi-"))
DB_PATH = TMP_ROOT / "reminders.sqlite3"

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
            {"id": "u-internal", "name": "Internal", "email": "internal@test.local", "password": "Internal12345", "role": "equipe_interne"},
            {"id": "u-tech", "name": "Tech", "email": "tech@test.local", "password": "Tech12345", "role": "technicien"},
            {
                "id": "u-client",
                "name": "Client",
                "email": "client@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "lieux", "equipment", "alerts"],
            },
        ],
        "clients": [{"id": "client-a", "name": "Client A"}],
        "buildings": [{"id": "b-a", "clientId": "client-a", "name": "Lieu A"}],
        "apartments": [
            {"id": "apt-101", "buildingId": "b-a", "number": "101"},
            {"id": "apt-102", "buildingId": "b-a", "number": "102"},
            {"id": "apt-201", "buildingId": "b-a", "number": "201"},
        ],
        "equipment": [
            {"id": "eq-101", "apartmentId": "apt-101", "type": "PTAC", "serial": "101"},
            {"id": "eq-102", "apartmentId": "apt-102", "type": "PTAC", "serial": "102"},
            {"id": "eq-201", "apartmentId": "apt-201", "type": "PTAC", "serial": "201"},
        ],
        "tickets": [],
        "workOrders": [
            {"id": "wo-tech", "number": "BT-1", "equipmentId": "eq-101", "technicianId": "u-tech", "assignedTechnicianIds": ["u-tech"]}
        ],
        "interventions": [],
        "reminders": [
            {
                "id": "rem-existing",
                "equipmentId": "eq-101",
                "title": "Entretien annuel",
                "frequencyValue": 1,
                "frequencyUnit": "years",
                "startDate": "2026-07-05",
                "nextDueDate": "2027-07-05",
                "status": "active",
                "createdAt": "2026-07-05",
                "lastSeenDueDate": "",
                "lastWorkOrderId": "",
            }
        ],
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


def reminder_payload(reminder_id: str, equipment_id: str) -> dict:
    return {
        "id": reminder_id,
        "equipmentId": equipment_id,
        "title": "Entretien preventif",
        "frequencyValue": 1,
        "frequencyUnit": "years",
        "startDate": "2026-07-05",
        "nextDueDate": "2027-07-05",
        "status": "active",
        "notes": "Etage test",
        "createdAt": "2026-07-05",
        "lastSeenDueDate": "",
    }


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    assert server.save_reminder_with_use_case.__module__ == "src.climaparc.reminders.presentation.dispatch"
    assert server.delete_reminder_with_use_case.__module__ == "src.climaparc.reminders.presentation.dispatch"

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        created = admin_client.post("/api/reminder", json={"reminder": reminder_payload("rem-new", "eq-102")})
        assert created.status_code == 200, created.text
        assert created.json()["item"]["id"] == "rem-new"
        assert any(item["id"] == "rem-new" for item in current_state()["reminders"])

        updated = admin_client.post(
            "/api/reminder",
            json={"reminder": {**reminder_payload("rem-new", "eq-102"), "status": "inactive", "lastSeenDueDate": "2027-07-05"}},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["item"]["status"] == "inactive"

        batch = admin_client.post(
            "/api/reminder",
            json={"reminders": [reminder_payload("rem-batch-101", "eq-101"), reminder_payload("rem-batch-201", "eq-201")]},
        )
        assert batch.status_code == 200, batch.text
        assert {item["id"] for item in batch.json()["items"]} == {"rem-batch-101", "rem-batch-201"}

        missing_equipment = admin_client.post("/api/reminder", json={"reminder": reminder_payload("rem-missing", "eq-missing")})
        assert missing_equipment.status_code == 404, missing_equipment.text

        deleted = admin_client.post("/api/reminder-delete", json={"reminderId": "rem-new"})
        assert deleted.status_code == 200, deleted.text
        assert all(item["id"] != "rem-new" for item in current_state()["reminders"])

    with TestClient(app) as internal_client:
        login(internal_client, "internal@test.local", "Internal12345")
        internal_created = internal_client.post("/api/reminder", json={"reminder": reminder_payload("rem-internal", "eq-102")})
        assert internal_created.status_code == 200, internal_created.text

    with TestClient(app) as client_user:
        login(client_user, "client@test.local", "Client12345")
        forbidden = client_user.post("/api/reminder", json={"reminder": reminder_payload("rem-client", "eq-101")})
        assert forbidden.status_code == 403, forbidden.text
        forbidden_delete = client_user.post("/api/reminder-delete", json={"reminderId": "rem-existing"})
        assert forbidden_delete.status_code == 403, forbidden_delete.text

    with TestClient(app) as tech_client:
        login(tech_client, "tech@test.local", "Tech12345")
        tech_forbidden = tech_client.post("/api/reminder", json={"reminder": reminder_payload("rem-tech", "eq-101")})
        assert tech_forbidden.status_code == 403, tech_forbidden.text

    print("reminders_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
