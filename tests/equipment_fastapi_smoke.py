from __future__ import annotations

import copy
import json
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
from backend import legacy_domain_handlers  # noqa: E402
from backend.database import row_get  # noqa: E402
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


def raw_state_json() -> dict:
    with server.db() as connection:
        row = server.execute(connection, "select state_json from climaparc_state where id = 1").fetchone()
    value = row_get(row, "state_json")
    return json.loads(value) if isinstance(value, str) else value


def raw_equipment() -> list:
    return copy.deepcopy(raw_state_json().get("equipment", []))


def equipment_row(equipment_id: str):
    with server.db() as connection:
        return server.execute(connection, "select id, serial, payload from climaparc_equipment where id = ?", (equipment_id,)).fetchone()


def equipment_payload(equipment_id: str) -> dict:
    row = equipment_row(equipment_id)
    payload = row_get(row, "payload")
    return json.loads(payload) if isinstance(payload, str) else payload


def login(client, email: str, password: str):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    assert legacy_domain_handlers.save_equipment_with_use_cases.__module__ == "src.climaparc.equipment.presentation.dispatch"
    before_raw_equipment = raw_equipment()
    migrated_version = equipment_payload("eq-existing").get("serverUpdatedAt")
    assert migrated_version
    server.init_db()
    assert equipment_payload("eq-existing").get("serverUpdatedAt") == migrated_version

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
        assert any(item["id"] == "eq-created" for item in created.json()["state"]["equipment"])
        assert row_get(equipment_row("eq-created"), "serial") == "NEW-1"
        assert raw_equipment() == before_raw_equipment

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
        assert next(item for item in updated.json()["state"]["equipment"] if item["id"] == "eq-existing")["serial"] == "SER-UPDATED"
        assert row_get(equipment_row("eq-existing"), "serial") == "SER-UPDATED"
        assert equipment_payload("eq-existing")["attachments"][0]["id"] == "file-1"
        assert raw_equipment() == before_raw_equipment

    with TestClient(app) as first_admin, TestClient(app) as second_admin:
        first_state = login(first_admin, "admin@test.local", "Admin12345").json()["state"]
        second_state = login(second_admin, "admin@test.local", "Admin12345").json()["state"]
        first_copy = copy.deepcopy(next(item for item in first_state["equipment"] if item["id"] == "eq-existing"))
        stale_copy = copy.deepcopy(next(item for item in second_state["equipment"] if item["id"] == "eq-existing"))
        assert first_copy["serverUpdatedAt"] == stale_copy["serverUpdatedAt"]

        first_copy["serial"] = "SER-FIRST-SESSION"
        first_update = first_admin.post("/api/equipment", json={"equipment": first_copy})
        assert first_update.status_code == 200, first_update.text

        stale_copy["serial"] = "SER-STALE-SESSION"
        stale_update = second_admin.post("/api/equipment", json={"equipment": stale_copy})
        assert stale_update.status_code == 409, stale_update.text
        assert equipment_payload("eq-existing")["serial"] == "SER-FIRST-SESSION"

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
        assert row_get(equipment_row("eq-tech"), "serial") == "TECH-1"
        assert raw_equipment() == before_raw_equipment

        other_building = tech_client.post(
            "/api/equipment",
            json={"equipment": {"id": "eq-tech-other", "apartmentId": "apt-b", "type": "PTAC"}},
        )
        assert other_building.status_code == 200, other_building.text
        assert equipment_payload("eq-tech-other")["apartmentId"] == "apt-b"

    print("equipment_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
