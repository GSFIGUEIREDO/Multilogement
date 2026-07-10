from __future__ import annotations

import copy
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-recommendations-fastapi-"))
DB_PATH = TMP_ROOT / "recommendations.sqlite3"

sys.path.insert(0, str(ROOT))

os.environ.pop("DATABASE_URL", None)
os.environ.pop("SUPABASE_DATABASE_URL", None)
os.environ["CLIMAPARC_DB"] = str(DB_PATH)
os.environ["APP_BASE_URL"] = "http://testserver"

import server  # noqa: E402
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
                "number": "BT-1",
                "ticketId": "tk-a",
                "buildingId": "b-a",
                "apartmentId": "apt-a",
                "equipmentId": "eq-a",
                "technicianId": "u-tech",
                "assignedTechnicianIds": ["u-tech"],
                "status": "en_cours",
            },
            {
                "id": "wo-b",
                "number": "BT-2",
                "ticketId": "tk-b",
                "buildingId": "b-b",
                "apartmentId": "apt-b",
                "equipmentId": "eq-b",
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
                    "type": "remplacement",
                    "status": "a_valider",
                    "description": "Remplacement recommande",
                    "priority": "normale",
                    "messages": [],
                },
            },
            {
                "id": "int-b",
                "workOrderId": "wo-b",
                "apartmentId": "apt-b",
                "equipmentId": "eq-b",
                "status": "terminee",
                "recommendation": {
                    "type": "diagnostic",
                    "status": "envoyee",
                    "price": "500.00",
                    "delay": "7 jours",
                    "messages": [],
                },
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
    before_raw_interventions = raw_interventions()

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        missing_price = admin_client.post(
            "/api/recommendation/review",
            json={"interventionId": "int-a", "recommendation": {"status": "envoyee", "delay": "5 jours"}},
        )
        assert missing_price.status_code == 400, missing_price.text

        reviewed = admin_client.post(
            "/api/recommendation/review",
            json={
                "interventionId": "int-a",
                "recommendation": {
                    "status": "envoyee",
                    "price": "450.00",
                    "delay": "5 jours",
                    "clientMessage": "Nous recommandons le remplacement.",
                    "messages": [{"authorRole": "interne", "authorName": "Admin", "text": "Nous recommandons le remplacement.", "createdAt": "2026-07-05"}],
                },
            },
        )
        assert reviewed.status_code == 200, reviewed.text
        recommendation = reviewed.json()["item"]["recommendation"]
        assert recommendation["status"] == "envoyee"
        assert recommendation["price"] == "450.00"
        assert recommendation["messages"][0]["authorRole"] == "interne"
        assert intervention_payload("int-a")["recommendation"]["price"] == "450.00"
        assert row_get(recommendation_message_rows("int-a")[0], "author_role") == "interne"
        assert raw_interventions() == before_raw_interventions

    with TestClient(app) as limited_client:
        login(limited_client, "limited@test.local", "Client12345")
        forbidden_approval = limited_client.post(
            "/api/recommendation/client-response",
            json={"interventionId": "int-a", "recommendation": {"status": "approuvee"}},
        )
        assert forbidden_approval.status_code == 403, forbidden_approval.text

        info_request = limited_client.post(
            "/api/recommendation/client-response",
            json={
                "interventionId": "int-a",
                "recommendation": {
                    "status": "information_demandee",
                    "clientComment": "Pouvez-vous confirmer le delai?",
                    "messages": [{"authorRole": "client", "authorName": "Client", "text": "Pouvez-vous confirmer le delai?", "createdAt": "2026-07-05"}],
                },
            },
        )
        assert info_request.status_code == 200, info_request.text
        assert info_request.json()["item"]["recommendation"]["status"] == "information_demandee"
        assert info_request.json()["item"]["recommendation"]["messages"][-1]["authorRole"] == "client"
        assert intervention_payload("int-a")["recommendation"]["status"] == "information_demandee"
        assert any(row_get(row, "author_role") == "client" for row in recommendation_message_rows("int-a"))
        assert raw_interventions() == before_raw_interventions

        cross_client = limited_client.post(
            "/api/recommendation/client-response",
            json={"interventionId": "int-b", "recommendation": {"status": "information_demandee"}},
        )
        assert cross_client.status_code == 403, cross_client.text

    write_seed_state()
    before_raw_interventions = raw_interventions()
    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        sent = admin_client.post(
            "/api/recommendation/review",
            json={
                "interventionId": "int-a",
                "recommendation": {"status": "envoyee", "price": "450.00", "delay": "5 jours"},
            },
        )
        assert sent.status_code == 200, sent.text
        assert intervention_payload("int-a")["recommendation"]["status"] == "envoyee"
        assert raw_interventions() == before_raw_interventions

    with TestClient(app) as approver_client:
        login(approver_client, "approver@test.local", "Client12345")
        legacy_intervention_path = approver_client.post(
            "/api/intervention",
            json={
                "intervention": {
                    "id": "int-a",
                    "status": "tampered",
                    "recommendation": {
                        "status": "approuvee",
                        "messages": [{"authorRole": "client", "authorName": "Client", "text": "Approuve", "createdAt": "2026-07-05"}],
                    },
                }
            },
        )
        assert legacy_intervention_path.status_code == 200, legacy_intervention_path.text
        item = legacy_intervention_path.json()["item"]
        assert item["status"] != "tampered"
        assert item["recommendation"]["status"] == "approuvee"
        assert item["recommendation"]["messages"][-1]["text"] == "Approuve"
        assert intervention_payload("int-a")["recommendation"]["status"] == "approuvee"
        assert any(row_get(row, "message_text") == "Approuve" for row in recommendation_message_rows("int-a"))
        assert raw_interventions() == before_raw_interventions

    with TestClient(app) as client_a:
        login(client_a, "approver@test.local", "Client12345")
        forbidden_internal = client_a.post(
            "/api/recommendation/review",
            json={"interventionId": "int-a", "recommendation": {"status": "envoyee", "price": "1", "delay": "1 jour"}},
        )
        assert forbidden_internal.status_code == 403, forbidden_internal.text

    assert any(item["id"] == "int-a" and item["recommendation"]["status"] == "approuvee" for item in current_state()["interventions"])
    print("recommendations_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
