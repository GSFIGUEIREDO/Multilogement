from __future__ import annotations

import copy
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-tickets-fastapi-"))
DB_PATH = TMP_ROOT / "tickets.sqlite3"

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
            {
                "id": "u-client-a",
                "name": "Client A",
                "email": "client-a@test.local",
                "password": "ClientA12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "lieux", "equipment", "tickets"],
            },
            {
                "id": "u-client-limited",
                "name": "Client Limited",
                "email": "limited@test.local",
                "password": "Limited12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "maintenance",
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
            {"id": "eq-a", "apartmentId": "apt-a", "type": "PTAC", "serial": "A"},
            {"id": "eq-b", "apartmentId": "apt-b", "type": "PTAC", "serial": "B"},
        ],
        "tickets": [
            {
                "id": "tk-existing",
                "number": "AS-2026-001",
                "clientId": "client-a",
                "buildingId": "b-a",
                "apartmentId": "apt-a",
                "equipmentId": "eq-a",
                "title": "Bruit",
                "priority": "normale",
                "status": "ouvert",
                "createdAt": "2026-07-05",
            },
            {
                "id": "tk-other",
                "number": "AS-2026-002",
                "clientId": "client-b",
                "buildingId": "b-b",
                "apartmentId": "apt-b",
                "equipmentId": "eq-b",
                "title": "Panne",
                "priority": "urgente",
                "status": "ouvert",
                "createdAt": "2026-07-05",
            },
        ],
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


def raw_state_json() -> dict:
    with server.db() as connection:
        row = server.execute(connection, "select state_json from climaparc_state where id = 1").fetchone()
    value = row_get(row, "state_json")
    return json.loads(value) if isinstance(value, str) else value


def raw_tickets() -> list:
    return copy.deepcopy(raw_state_json().get("tickets", []))


def ticket_row(ticket_id: str):
    with server.db() as connection:
        return server.execute(connection, "select id, title, status, payload from climaparc_tickets where id = ?", (ticket_id,)).fetchone()


def ticket_payload(ticket_id: str) -> dict:
    row = ticket_row(ticket_id)
    payload = row_get(row, "payload")
    return json.loads(payload) if isinstance(payload, str) else payload


def login(client, email: str, password: str):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    assert legacy_domain_handlers.save_ticket_with_use_cases.__module__ == "src.climaparc.tickets.presentation.dispatch"
    before_raw_tickets = raw_tickets()

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        created = admin_client.post(
            "/api/ticket",
            json={
                "ticket": {
                    "id": "tk-created",
                    "number": "AS-2026-003",
                    "clientId": "client-a",
                    "buildingId": "b-a",
                    "apartmentId": "apt-a",
                    "equipmentId": "eq-a",
                    "title": "Entretien",
                    "priority": "normale",
                    "status": "ouvert",
                    "createdAt": "2026-07-05",
                }
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["item"]["id"] == "tk-created"
        assert any(item["id"] == "tk-created" for item in current_state()["tickets"])
        assert any(item["id"] == "tk-created" for item in created.json()["state"]["tickets"])
        assert row_get(ticket_row("tk-created"), "title") == "Entretien"
        assert raw_tickets() == before_raw_tickets

        updated = admin_client.post(
            "/api/ticket",
            json={
                "ticket": {
                    "id": "tk-created",
                    "number": "AS-2026-003",
                    "clientId": "client-a",
                    "buildingId": "b-a",
                    "apartmentId": "apt-a",
                    "equipmentId": "eq-a",
                    "title": "Entretien modifie",
                    "priority": "urgente",
                    "status": "en_cours",
                    "createdAt": "2026-07-05",
                }
            },
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["item"]["title"] == "Entretien modifie"
        assert next(item for item in updated.json()["state"]["tickets"] if item["id"] == "tk-created")["status"] == "en_cours"
        assert row_get(ticket_row("tk-created"), "status") == "en_cours"
        assert ticket_payload("tk-created")["title"] == "Entretien modifie"
        assert raw_tickets() == before_raw_tickets

    with TestClient(app) as client_a:
        login(client_a, "client-a@test.local", "ClientA12345")
        client_created = client_a.post(
            "/api/ticket",
            json={
                "ticket": {
                    "id": "tk-client",
                    "number": "AS-2026-004",
                    "clientId": "client-a",
                    "buildingId": "b-a",
                    "apartmentId": "apt-a",
                    "equipmentId": "eq-a",
                    "title": "Client demande",
                    "priority": "normale",
                    "status": "ouvert",
                    "createdAt": "2026-07-05",
                }
            },
        )
        assert client_created.status_code == 200, client_created.text
        visible = client_created.json()["state"]["tickets"]
        assert all(item.get("clientId") == "client-a" for item in visible)
        assert row_get(ticket_row("tk-client"), "title") == "Client demande"
        assert raw_tickets() == before_raw_tickets

        cross_client = client_a.post(
            "/api/ticket",
            json={
                "ticket": {
                    "id": "tk-cross",
                    "number": "AS-2026-005",
                    "clientId": "client-a",
                    "buildingId": "b-b",
                    "apartmentId": "apt-b",
                    "equipmentId": "eq-b",
                    "title": "Hors scope",
                    "priority": "normale",
                    "status": "ouvert",
                    "createdAt": "2026-07-05",
                }
            },
        )
        assert cross_client.status_code == 403, cross_client.text

    with TestClient(app) as limited_client:
        login(limited_client, "limited@test.local", "Limited12345")
        forbidden = limited_client.post(
            "/api/ticket",
            json={
                "ticket": {
                    "id": "tk-forbidden",
                    "number": "AS-2026-006",
                    "clientId": "client-a",
                    "buildingId": "b-a",
                    "apartmentId": "apt-a",
                    "equipmentId": "eq-a",
                    "title": "Sans droit",
                    "priority": "normale",
                    "status": "ouvert",
                    "createdAt": "2026-07-05",
                }
            },
        )
        assert forbidden.status_code == 403, forbidden.text

    print("tickets_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
