from __future__ import annotations

import copy
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-places-fastapi-"))
DB_PATH = TMP_ROOT / "places.sqlite3"

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
                "portalRights": ["portal", "lieux"],
            },
        ],
        "clients": [
            {"id": "client-a", "name": "Client A"},
            {"id": "client-b", "name": "Client B"},
        ],
        "buildings": [
            {"id": "b-existing", "clientId": "client-a", "name": "Lieu existant", "address": "1 Rue A"},
            {"id": "b-other", "clientId": "client-b", "name": "Lieu B", "address": "2 Rue B"},
        ],
        "apartments": [
            {"id": "apt-existing", "buildingId": "b-existing", "number": "101", "occupant": "Mme A"},
            {"id": "apt-other", "buildingId": "b-other", "number": "202", "occupant": "M. B"},
        ],
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


def raw_state_json() -> dict:
    with server.db() as connection:
        row = server.execute(connection, "select state_json from climaparc_state where id = 1").fetchone()
    value = row_get(row, "state_json")
    return json.loads(value) if isinstance(value, str) else value


def raw_places_snapshot() -> dict:
    raw = raw_state_json()
    return {
        "buildings": copy.deepcopy(raw.get("buildings", [])),
        "apartments": copy.deepcopy(raw.get("apartments", [])),
    }


def table_row(table: str, item_id: str):
    with server.db() as connection:
        return server.execute(connection, f"select id, payload from {table} where id = ?", (item_id,)).fetchone()


def building_contact_rows(building_id: str) -> list:
    with server.db() as connection:
        return server.execute(
            connection,
            "select contact_role, name, email from climaparc_building_contacts where building_id = ? order by contact_role",
            (building_id,),
        ).fetchall()


def login(client, email: str, password: str):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    assert legacy_domain_handlers.save_building_with_use_cases.__module__ == "src.climaparc.places.presentation.dispatch"
    assert legacy_domain_handlers.save_apartment_with_use_cases.__module__ == "src.climaparc.places.presentation.dispatch"
    before_raw_places = raw_places_snapshot()

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        create_building = admin_client.post(
            "/api/building",
            json={
                "building": {
                    "id": "b-created",
                    "clientId": "client-a",
                    "name": "Lieu cree",
                    "address": "3 Rue A",
                    "onsiteContactName": "Contact",
                    "onsiteContactEmail": "contact@test.local",
                }
            },
        )
        assert create_building.status_code == 200, create_building.text
        assert create_building.json()["item"]["id"] == "b-created"
        assert any(item["id"] == "b-created" for item in current_state()["buildings"])
        assert any(item["id"] == "b-created" for item in create_building.json()["state"]["buildings"])
        assert table_row("climaparc_buildings", "b-created") is not None
        contacts = building_contact_rows("b-created")
        assert len(contacts) == 1
        assert row_get(contacts[0], "contact_role") == "onsite"
        assert raw_places_snapshot() == before_raw_places

        update_building = admin_client.post(
            "/api/building",
            json={
                "building": {
                    "id": "b-created",
                    "clientId": "client-a",
                    "name": "Lieu cree modifie",
                    "address": "3 Rue A",
                }
            },
        )
        assert update_building.status_code == 200, update_building.text
        assert update_building.json()["item"]["name"] == "Lieu cree modifie"
        assert next(item for item in update_building.json()["state"]["buildings"] if item["id"] == "b-created")["name"] == "Lieu cree modifie"
        assert not building_contact_rows("b-created")
        assert raw_places_snapshot() == before_raw_places

        create_apartment = admin_client.post(
            "/api/apartment",
            json={"apartment": {"id": "apt-created", "buildingId": "b-created", "number": "303", "occupant": "Mme C"}},
        )
        assert create_apartment.status_code == 200, create_apartment.text
        assert any(item["id"] == "apt-created" for item in current_state()["apartments"])
        assert any(item["id"] == "apt-created" for item in create_apartment.json()["state"]["apartments"])
        assert table_row("climaparc_apartments", "apt-created") is not None
        assert raw_places_snapshot() == before_raw_places

        update_apartment = admin_client.post(
            "/api/apartment",
            json={"apartment": {"id": "apt-created", "buildingId": "b-created", "number": "303", "occupant": "Mme D"}},
        )
        assert update_apartment.status_code == 200, update_apartment.text
        assert update_apartment.json()["item"]["occupant"] == "Mme D"
        assert next(item for item in update_apartment.json()["state"]["apartments"] if item["id"] == "apt-created")["occupant"] == "Mme D"
        assert raw_places_snapshot() == before_raw_places

        missing_building = admin_client.post(
            "/api/apartment",
            json={"apartment": {"id": "apt-missing", "buildingId": "b-missing", "number": "404"}},
        )
        assert missing_building.status_code == 404, missing_building.text

    with TestClient(app) as client_a:
        login(client_a, "client-a@test.local", "ClientA12345")
        forbidden = client_a.post(
            "/api/building",
            json={"building": {"id": "b-client", "clientId": "client-a", "name": "Client edit"}},
        )
        assert forbidden.status_code == 403, forbidden.text

        session = client_a.get("/api/session")
        assert session.status_code == 200, session.text
        visible = session.json()["state"]
        assert {item["id"] for item in visible["clients"]} == {"client-a"}
        assert all(item.get("clientId") != "client-b" for item in visible["buildings"])
        assert all(item.get("buildingId") != "b-other" for item in visible["apartments"])

    print("places_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
