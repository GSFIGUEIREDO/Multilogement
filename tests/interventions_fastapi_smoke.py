from __future__ import annotations

import copy
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-interventions-fastapi-"))
DB_PATH = TMP_ROOT / "interventions.sqlite3"

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
                "id": "u-client-approver",
                "name": "Client Approver",
                "email": "approver@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "direction",
                "portalRights": [
                    "portal",
                    "lieux",
                    "equipment",
                    "tickets",
                    "workorders",
                    "recommendations",
                    "recommendation_prices",
                    "recommendation_approve",
                ],
            },
            {
                "id": "u-client-limited",
                "name": "Client Limited",
                "email": "limited@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "gestionnaire",
                "portalRights": ["portal", "lieux", "equipment", "tickets", "workorders", "recommendations"],
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
            {"id": "tk-a", "number": "AS-1", "clientId": "client-a", "buildingId": "b-a", "apartmentId": "apt-a", "equipmentId": "eq-a"},
            {"id": "tk-b", "number": "AS-2", "clientId": "client-b", "buildingId": "b-b", "apartmentId": "apt-b", "equipmentId": "eq-b"},
        ],
        "workOrders": [
            {
                "id": "wo-a",
                "number": "BT-2026-001",
                "ticketId": "tk-a",
                "scope": "equipment",
                "buildingId": "b-a",
                "apartmentId": "apt-a",
                "equipmentId": "eq-a",
                "technicianId": "u-tech",
                "assignedTechnicianIds": ["u-tech"],
                "status": "en_cours",
            },
            {
                "id": "wo-b",
                "number": "BT-2026-002",
                "ticketId": "tk-b",
                "scope": "equipment",
                "buildingId": "b-b",
                "apartmentId": "apt-b",
                "equipmentId": "eq-b",
                "technicianId": "",
                "assignedTechnicianIds": [],
                "status": "en_cours",
            },
        ],
        "interventions": [
            {
                "id": "int-a",
                "workOrderId": "wo-a",
                "apartmentId": "apt-a",
                "equipmentId": "eq-a",
                "technicianId": "u-tech",
                "status": "terminee",
                "recommendation": {
                    "status": "envoyee",
                    "price": "250.00",
                    "delay": "3 jours",
                    "description": "Remplacement recommande",
                    "messages": [],
                },
            },
            {
                "id": "int-b",
                "workOrderId": "wo-b",
                "apartmentId": "apt-b",
                "equipmentId": "eq-b",
                "status": "terminee",
                "recommendation": {"status": "envoyee", "price": "500.00", "delay": "7 jours"},
            },
        ],
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
    write_seed_state()


def write_seed_state() -> None:
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


def raw_interventions() -> list:
    return copy.deepcopy(raw_state_json().get("interventions", []))


def intervention_row(intervention_id: str):
    with server.db() as connection:
        return server.execute(
            connection,
            "select id, status, payload from climaparc_interventions where id = ?",
            (intervention_id,),
        ).fetchone()


def intervention_payload(intervention_id: str) -> dict:
    row = intervention_row(intervention_id)
    payload = row_get(row, "payload")
    return json.loads(payload) if isinstance(payload, str) else payload


def response_rows(intervention_id: str) -> list:
    with server.db() as connection:
        return server.execute(
            connection,
            "select field_key, response_text from climaparc_intervention_responses where intervention_id = ? order by field_key",
            (intervention_id,),
        ).fetchall()


def response_value_rows(intervention_id: str) -> list:
    with server.db() as connection:
        return server.execute(
            connection,
            """
            select field_key, value_index, value_text
            from climaparc_intervention_response_values
            where intervention_id = ?
            order by field_key, value_index
            """,
            (intervention_id,),
        ).fetchall()


def recommendation_message_rows(intervention_id: str) -> list:
    with server.db() as connection:
        return server.execute(
            connection,
            "select author_role, message_text from climaparc_recommendation_messages where intervention_id = ? order by message_text",
            (intervention_id,),
        ).fetchall()


def login(client, email: str, password: str):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    assert legacy_domain_handlers.save_intervention_with_use_cases.__module__ == "src.climaparc.interventions.presentation.dispatch"
    before_raw_interventions = raw_interventions()

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        created = admin_client.post(
            "/api/intervention",
            json={
                "intervention": {
                    "id": "int-created",
                    "workOrderId": "wo-a",
                    "apartmentId": "apt-a",
                    "equipmentId": "eq-a",
                    "technicianId": "u-tech",
                    "status": "en_cours",
                    "formResponses": {"statut": "OK"},
                }
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["item"]["id"] == "int-created"
        assert any(item["id"] == "int-created" for item in current_state()["interventions"])
        assert any(item["id"] == "int-created" for item in created.json()["state"]["interventions"])
        assert row_get(intervention_row("int-created"), "status") == "en_cours"
        assert intervention_payload("int-created")["formResponses"]["statut"] == "OK"
        assert row_get(response_rows("int-created")[0], "response_text") == "OK"
        assert row_get(response_value_rows("int-created")[0], "value_text") == "OK"
        assert raw_interventions() == before_raw_interventions

    with TestClient(app) as tech_client:
        login(tech_client, "tech@test.local", "Tech12345")
        tech_update = tech_client.post(
            "/api/intervention",
            json={
                "intervention": {
                    "id": "int-a",
                    "workOrderId": "wo-a",
                    "apartmentId": "apt-a",
                    "equipmentId": "eq-a",
                    "technicianId": "u-tech",
                    "status": "terminee",
                    "formResponses": {"statut": "Termine"},
                    "recommendation": {
                        "status": "envoyee",
                        "price": "250.00",
                        "delay": "3 jours",
                        "description": "Remplacement recommande",
                        "messages": [],
                    },
                }
            },
        )
        assert tech_update.status_code == 200, tech_update.text
        assert tech_update.json()["item"]["formResponses"]["statut"] == "Termine"
        assert row_get(intervention_row("int-a"), "status") == "terminee"
        assert intervention_payload("int-a")["formResponses"]["statut"] == "Termine"
        assert row_get(response_rows("int-a")[0], "response_text") == "Termine"
        assert raw_interventions() == before_raw_interventions

        blocked = tech_client.post(
            "/api/intervention",
            json={
                "intervention": {
                    "id": "int-b",
                    "workOrderId": "wo-b",
                    "apartmentId": "apt-b",
                    "equipmentId": "eq-b",
                    "status": "terminee",
                }
            },
        )
        assert blocked.status_code == 403, blocked.text

    with TestClient(app) as approver_client:
        login(approver_client, "approver@test.local", "Client12345")
        approved = approver_client.post(
            "/api/intervention",
            json={
                "intervention": {
                    "id": "int-a",
                    "status": "tampered",
                    "recommendation": {
                        "status": "approuvee",
                        "clientComment": "Approuve",
                        "messages": [{"authorRole": "client", "authorName": "Client", "text": "Merci", "createdAt": "2026-07-05"}],
                    },
                }
            },
        )
        assert approved.status_code == 200, approved.text
        item = approved.json()["item"]
        assert item["status"] != "tampered"
        assert item["recommendation"]["status"] == "approuvee"
        assert item["recommendation"]["clientComment"] == "Approuve"
        assert item["recommendation"]["messages"][0]["text"] == "Merci"
        assert intervention_payload("int-a")["recommendation"]["status"] == "approuvee"
        assert row_get(recommendation_message_rows("int-a")[0], "message_text") == "Merci"
        assert raw_interventions() == before_raw_interventions

    write_seed_state()
    before_raw_interventions = raw_interventions()
    with TestClient(app) as limited_client:
        login(limited_client, "limited@test.local", "Client12345")
        forbidden_approval = limited_client.post(
            "/api/intervention",
            json={"intervention": {"id": "int-a", "recommendation": {"status": "approuvee"}}},
        )
        assert forbidden_approval.status_code == 403, forbidden_approval.text

        info_request = limited_client.post(
            "/api/intervention",
            json={
                "intervention": {
                    "id": "int-a",
                    "recommendation": {
                        "status": "information_demandee",
                        "clientComment": "Pouvez-vous preciser le delai?",
                    },
                }
            },
        )
        assert info_request.status_code == 200, info_request.text
        assert info_request.json()["item"]["recommendation"]["status"] == "information_demandee"
        assert intervention_payload("int-a")["recommendation"]["status"] == "information_demandee"
        assert raw_interventions() == before_raw_interventions

        cross_client = limited_client.post(
            "/api/intervention",
            json={"intervention": {"id": "int-b", "recommendation": {"status": "information_demandee"}}},
        )
        assert cross_client.status_code == 403, cross_client.text

    print("interventions_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
