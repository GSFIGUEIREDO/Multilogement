from __future__ import annotations

import copy
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-work-orders-fastapi-"))
DB_PATH = TMP_ROOT / "work-orders.sqlite3"

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
                "id": "u-client",
                "name": "Client",
                "email": "client@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "lieux", "equipment", "tickets", "workorders"],
            },
        ],
        "clients": [{"id": "client-a", "name": "Client A"}],
        "buildings": [{"id": "b-a", "clientId": "client-a", "name": "Lieu A"}],
        "apartments": [{"id": "apt-a", "buildingId": "b-a", "number": "101"}],
        "equipment": [{"id": "eq-a", "apartmentId": "apt-a", "type": "PTAC"}],
        "tickets": [{"id": "tk-a", "number": "AS-1", "clientId": "client-a", "buildingId": "b-a", "apartmentId": "apt-a", "equipmentId": "eq-a"}],
        "workOrders": [
            {
                "id": "wo-assigned",
                "number": "BT-2026-001",
                "ticketId": "tk-a",
                "scope": "equipment",
                "buildingId": "",
                "equipmentId": "eq-a",
                "typeId": "preventif",
                "technicianId": "u-tech",
                "assignedTechnicianIds": ["u-tech"],
                "scheduledDate": "2026-07-05",
                "status": "en_cours",
            },
            {
                "id": "wo-unassigned",
                "number": "BT-2026-002",
                "ticketId": "tk-a",
                "scope": "equipment",
                "buildingId": "",
                "equipmentId": "eq-a",
                "typeId": "preventif",
                "technicianId": "",
                "assignedTechnicianIds": [],
                "scheduledDate": "2026-07-06",
                "status": "planifie",
            },
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


def raw_work_orders() -> list:
    return copy.deepcopy(raw_state_json().get("workOrders", []))


def work_order_row(work_order_id: str):
    with server.db() as connection:
        return server.execute(
            connection,
            "select id, status, scheduled_date, payload from climaparc_work_orders where id = ?",
            (work_order_id,),
        ).fetchone()


def work_order_payload(work_order_id: str) -> dict:
    row = work_order_row(work_order_id)
    payload = row_get(row, "payload")
    return json.loads(payload) if isinstance(payload, str) else payload


def assigned_technician_rows(work_order_id: str) -> list:
    with server.db() as connection:
        return server.execute(
            connection,
            "select user_id, is_primary from climaparc_work_order_technicians where work_order_id = ? order by user_id",
            (work_order_id,),
        ).fetchall()


def login(client, email: str, password: str):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    assert legacy_domain_handlers.save_work_order_with_use_cases.__module__ == "src.climaparc.work_orders.presentation.dispatch"
    before_raw_work_orders = raw_work_orders()

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        created = admin_client.post(
            "/api/work-order",
            json={
                "workOrder": {
                    "id": "wo-created",
                    "number": "BT-2026-003",
                    "ticketId": "tk-a",
                    "scope": "equipment",
                    "buildingId": "",
                    "equipmentId": "eq-a",
                    "typeId": "reparation",
                    "technicianId": "u-tech",
                    "assignedTechnicianIds": ["u-tech"],
                    "scheduledDate": "2026-07-07",
                    "status": "planifie",
                }
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["item"]["id"] == "wo-created"
        assert any(item["id"] == "wo-created" for item in current_state()["workOrders"])
        assert any(item["id"] == "wo-created" for item in created.json()["state"]["workOrders"])
        assert row_get(work_order_row("wo-created"), "status") == "planifie"
        assert len(assigned_technician_rows("wo-created")) == 1
        assert raw_work_orders() == before_raw_work_orders

        updated = admin_client.post(
            "/api/work-order",
            json={
                "workOrder": {
                    "id": "wo-created",
                    "number": "BT-2026-003",
                    "ticketId": "tk-a",
                    "scope": "equipment",
                    "buildingId": "",
                    "equipmentId": "eq-a",
                    "typeId": "reparation",
                    "technicianId": "u-tech",
                    "assignedTechnicianIds": ["u-tech"],
                    "scheduledDate": "2026-07-08",
                    "status": "en_cours",
                }
            },
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["item"]["scheduledDate"] == "2026-07-08"
        assert next(item for item in updated.json()["state"]["workOrders"] if item["id"] == "wo-created")["status"] == "en_cours"
        assert row_get(work_order_row("wo-created"), "scheduled_date") == "2026-07-08"
        assert work_order_payload("wo-created")["status"] == "en_cours"
        assert raw_work_orders() == before_raw_work_orders

    with TestClient(app) as tech_client:
        login(tech_client, "tech@test.local", "Tech12345")
        tech_update = tech_client.post(
            "/api/work-order",
            json={
                "workOrder": {
                    "id": "wo-assigned",
                    "number": "BT-2026-001",
                    "ticketId": "tk-a",
                    "scope": "equipment",
                    "buildingId": "",
                    "equipmentId": "eq-a",
                    "typeId": "preventif",
                    "technicianId": "u-tech",
                    "assignedTechnicianIds": ["u-tech"],
                    "scheduledDate": "2026-07-05",
                    "status": "termine",
                }
            },
        )
        assert tech_update.status_code == 200, tech_update.text
        assert tech_update.json()["item"]["status"] == "termine"
        assert row_get(work_order_row("wo-assigned"), "status") == "termine"
        assert raw_work_orders() == before_raw_work_orders

        blocked = tech_client.post(
            "/api/work-order",
            json={
                "workOrder": {
                    "id": "wo-unassigned",
                    "number": "BT-2026-002",
                    "ticketId": "tk-a",
                    "scope": "equipment",
                    "buildingId": "",
                    "equipmentId": "eq-a",
                    "typeId": "preventif",
                    "technicianId": "",
                    "assignedTechnicianIds": [],
                    "scheduledDate": "2026-07-06",
                    "status": "termine",
                }
            },
        )
        assert blocked.status_code == 403, blocked.text

    with TestClient(app) as client_user:
        login(client_user, "client@test.local", "Client12345")
        forbidden = client_user.post(
            "/api/work-order",
            json={
                "workOrder": {
                    "id": "wo-client",
                    "number": "BT-2026-004",
                    "ticketId": "tk-a",
                    "scope": "equipment",
                    "equipmentId": "eq-a",
                    "status": "planifie",
                }
            },
        )
        assert forbidden.status_code == 403, forbidden.text

    print("work_orders_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
