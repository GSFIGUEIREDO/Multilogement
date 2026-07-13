from __future__ import annotations

import copy
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-reports-fastapi-"))
DB_PATH = TMP_ROOT / "reports.sqlite3"

sys.path.insert(0, str(ROOT))

os.environ.pop("DATABASE_URL", None)
os.environ.pop("SUPABASE_DATABASE_URL", None)
os.environ["CLIMAPARC_DB"] = str(DB_PATH)
os.environ["APP_BASE_URL"] = "http://testserver"

import server  # noqa: E402
from backend import legacy_domain_handlers  # noqa: E402
from backend.database import now_value  # noqa: E402
from src.climaparc.main import app  # noqa: E402


def base_state() -> dict:
    return {
        "users": [
            {"id": "u-admin", "name": "Admin", "email": "admin@test.local", "password": "Admin12345", "role": "administrateur"},
            {"id": "u-internal", "name": "Internal", "email": "internal@test.local", "password": "Internal12345", "role": "equipe_interne"},
            {"id": "u-tech", "name": "Tech", "email": "tech@test.local", "password": "Tech12345", "role": "technicien"},
            {
                "id": "u-client-a",
                "name": "Client A",
                "email": "clienta@test.local",
                "password": "ClientA12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "lieux", "equipment", "tickets", "workorders", "reports", "alerts"],
            },
            {
                "id": "u-client-no-reports",
                "name": "Client No Reports",
                "email": "noreports@test.local",
                "password": "NoReports12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "maintenance",
                "portalRights": ["portal", "lieux"],
            },
        ],
        "clients": [{"id": "client-a", "name": "Client A"}, {"id": "client-b", "name": "Client B"}],
        "buildings": [
            {"id": "b-a", "clientId": "client-a", "name": "Lieu A"},
            {"id": "b-b", "clientId": "client-b", "name": "Lieu B"},
        ],
        "apartments": [
            {"id": "apt-a", "buildingId": "b-a", "number": "101"},
            {"id": "apt-b", "buildingId": "b-b", "number": "202"},
        ],
        "equipment": [
            {"id": "eq-a", "apartmentId": "apt-a", "type": "PTAC", "status": "actif", "nextService": "2026-07-20"},
            {"id": "eq-b", "apartmentId": "apt-b", "type": "Fan coil", "status": "hors_service", "nextService": "2026-07-20"},
        ],
        "tickets": [
            {"id": "t-a", "clientId": "client-a", "buildingId": "b-a", "apartmentId": "apt-a", "equipmentId": "eq-a", "status": "ouvert", "createdAt": "2026-07-05"},
            {"id": "t-b", "clientId": "client-b", "buildingId": "b-b", "apartmentId": "apt-b", "equipmentId": "eq-b", "status": "ouvert", "createdAt": "2026-07-05"},
        ],
        "workOrders": [
            {
                "id": "wo-a",
                "number": "BT-A",
                "buildingId": "b-a",
                "apartmentId": "apt-a",
                "equipmentId": "eq-a",
                "technicianId": "u-tech",
                "assignedTechnicianIds": ["u-tech"],
                "status": "en_cours",
                "scheduledDate": "2026-07-05",
            },
            {"id": "wo-b", "number": "BT-B", "buildingId": "b-b", "apartmentId": "apt-b", "equipmentId": "eq-b", "status": "en_cours", "scheduledDate": "2026-07-05"},
        ],
        "interventions": [
            {"id": "int-a", "workOrderId": "wo-a", "equipmentId": "eq-a", "technicianId": "u-tech", "date": "2026-07-05", "status": "terminee"},
            {"id": "int-b", "workOrderId": "wo-b", "equipmentId": "eq-b", "date": "2026-07-05", "status": "terminee"},
        ],
        "reminders": [{"id": "rem-a", "equipmentId": "eq-a", "title": "A", "status": "active", "nextDueDate": "2026-07-05"}],
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


def login(client, email: str, password: str):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def clear_raw_report_collections() -> None:
    with server.db() as connection:
        row = server.execute(connection, "select state_json from climaparc_state where id = 1").fetchone()
        value = row["state_json"]
        state = json.loads(value) if isinstance(value, str) else value
        for key in ("buildings", "apartments", "equipment", "tickets", "workOrders", "interventions", "reminders"):
            state[key] = []
        server.execute(
            connection,
            "update climaparc_state set state_json = ?, updated_at = ? where id = 1",
            (json.dumps(state), now_value()),
        )


def report_request(client, **filters):
    payload = {
        "reportType": filters.get("reportType", "parc_mensuel"),
        "clientId": filters.get("clientId", "all"),
        "startDate": filters.get("startDate", "2026-07-01"),
        "endDate": filters.get("endDate", "2026-07-31"),
        "equipmentStatus": filters.get("equipmentStatus", "all"),
        "activityStatus": filters.get("activityStatus", "all"),
    }
    return client.post("/api/report-context", json={"filters": payload})


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    clear_raw_report_collections()
    assert legacy_domain_handlers.get_report_context_with_use_case.__module__ == "src.climaparc.reports.presentation.dispatch"

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        all_context = report_request(admin_client, reportType="dashboard_operationnel")
        assert all_context.status_code == 200, all_context.text
        assert all_context.json()["metrics"]["buildings"] == 2
        client_a = report_request(admin_client, reportType="dashboard_operationnel", clientId="client-a")
        assert client_a.status_code == 200, client_a.text
        assert client_a.json()["metrics"]["buildings"] == 1
        assert {item["id"] for item in client_a.json()["context"]["buildings"]} == {"b-a"}

    with TestClient(app) as client_a:
        login(client_a, "clienta@test.local", "ClientA12345")
        response = report_request(client_a, reportType="parc_mensuel", clientId="client-b")
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["audience"] == "client"
        assert payload["metrics"]["buildings"] == 1
        assert {item["id"] for item in payload["context"]["buildings"]} == {"b-a"}
        assert all(item[0] in {"parc_mensuel", "maintenance_preventive", "appels_service", "hors_service", "budget_annuel"} for item in payload["reportTypes"])

    with TestClient(app) as no_reports:
        login(no_reports, "noreports@test.local", "NoReports12345")
        forbidden = report_request(no_reports, reportType="parc_mensuel")
        assert forbidden.status_code == 403, forbidden.text

    with TestClient(app) as tech_client:
        login(tech_client, "tech@test.local", "Tech12345")
        response = report_request(tech_client, reportType="tech_journalier")
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["audience"] == "technician"
        assert {item["id"] for item in payload["context"]["workOrders"]} == {"wo-a", "wo-b"}
        assert {item["id"] for item in payload["context"]["equipment"]} == {"eq-a", "eq-b"}

    print("reports_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
