from __future__ import annotations

import copy
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-users-fastapi-"))
DB_PATH = TMP_ROOT / "users.sqlite3"

sys.path.insert(0, str(ROOT))

os.environ.pop("DATABASE_URL", None)
os.environ.pop("SUPABASE_DATABASE_URL", None)
os.environ["CLIMAPARC_DB"] = str(DB_PATH)
os.environ["APP_BASE_URL"] = "http://testserver"

import server  # noqa: E402
from backend import legacy_domain_handlers  # noqa: E402
from src.climaparc.main import app  # noqa: E402


def base_state() -> dict:
    return {
        "users": [
            {"id": "u-admin", "name": "Admin", "email": "admin@test.local", "password": "Admin12345", "role": "administrateur"},
            {
                "id": "u-client-manager",
                "name": "Client Manager",
                "email": "manager@test.local",
                "password": "Manager12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "users", "lieux"],
            },
            {
                "id": "u-client-limited",
                "name": "Client Limited",
                "email": "limited@test.local",
                "password": "Limited12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "gestionnaire",
                "portalRights": ["portal", "lieux"],
            },
            {
                "id": "u-client-b",
                "name": "Client B",
                "email": "client-b@test.local",
                "password": "ClientB12345",
                "role": "client",
                "clientId": "client-b",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "users"],
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


def auth_row(user_id: str):
    with server.db() as connection:
        return server.execute(connection, "select * from climaparc_users where id = ?", (user_id,)).fetchone()


def profile_row(user_id: str):
    with server.db() as connection:
        return server.execute(connection, "select * from climaparc_user_profiles where id = ?", (user_id,)).fetchone()


def raw_state() -> dict:
    with server.db() as connection:
        row = server.execute(connection, "select state_json from climaparc_state where id = 1").fetchone()
    value = row["state_json"]
    return json.loads(value) if isinstance(value, str) else value


def assert_no_key(value, key: str) -> None:
    if isinstance(value, dict):
        assert key not in value, f"{key} leaked in {value}"
        for child in value.values():
            assert_no_key(child, key)
    elif isinstance(value, list):
        for child in value:
            assert_no_key(child, key)


def login(client, email: str, password: str):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    original_user_ids = {item["id"] for item in raw_state()["users"]}
    assert legacy_domain_handlers.save_user_with_use_cases.__module__ == "src.climaparc.users.presentation.dispatch"

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        created = admin_client.post(
            "/api/user",
            json={
                "user": {
                    "id": "u-created",
                    "name": "Created User",
                    "email": "created@test.local",
                    "password": "Created12345",
                    "role": "technicien",
                    "technicianPermissions": ["edit_apartments"],
                }
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["user"]["id"] == "u-created"
        assert_no_key(created.json()["state"], "password")
        assert auth_row("u-created") is not None
        profile = profile_row("u-created")
        assert profile is not None
        profile_payload = json.loads(profile["payload"])
        assert profile_payload["name"] == "Created User"
        assert profile_payload["technicianPermissions"] == ["edit_apartments"]
        assert "password" not in profile_payload
        assert {item["id"] for item in raw_state()["users"]} == original_user_ids

        updated = admin_client.post(
            "/api/user",
            json={
                "user": {
                    "id": "u-created",
                    "name": "Created User Updated",
                    "email": "created@test.local",
                    "password": "",
                    "role": "technicien",
                    "technicianPermissions": ["edit_apartments", "edit_equipment"],
                }
            },
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["user"]["name"] == "Created User Updated"
        assert json.loads(profile_row("u-created")["payload"])["name"] == "Created User Updated"
        assert json.loads(profile_row("u-created")["payload"])["technicianPermissions"] == ["edit_apartments", "edit_equipment"]
        assert {item["id"] for item in raw_state()["users"]} == original_user_ids
        assert_no_key(current_state(), "password")

        duplicate = admin_client.post(
            "/api/user",
            json={
                "user": {
                    "id": "u-duplicate",
                    "name": "Duplicate",
                    "email": "admin@test.local",
                    "password": "Duplicate12345",
                    "role": "client",
                    "clientId": "client-a",
                }
            },
        )
        assert duplicate.status_code == 409, duplicate.text

        scoped_client = admin_client.post(
            "/api/user",
            json={
                "user": {
                    "id": "u-client-scoped",
                    "name": "Scoped Client",
                    "email": "scoped@test.local",
                    "password": "Scoped12345",
                    "role": "client",
                    "clientId": "client-a",
                    "clientAccessLevel": "gestionnaire",
                    "allowedBuildingIds": ["b-a"],
                    "portalRights": ["lieux", "equipment"],
                }
            },
        )
        assert scoped_client.status_code == 200, scoped_client.text
        scoped_profile = json.loads(profile_row("u-client-scoped")["payload"])
        assert scoped_profile["clientId"] == "client-a"
        assert scoped_profile["allowedBuildingIds"] == ["b-a"]

        self_delete = admin_client.post("/api/user-delete", json={"userId": "u-admin"})
        assert self_delete.status_code == 400, self_delete.text

    with TestClient(app) as first_admin, TestClient(app) as second_admin:
        first_state = login(first_admin, "admin@test.local", "Admin12345").json()["state"]
        second_state = login(second_admin, "admin@test.local", "Admin12345").json()["state"]
        first_copy = copy.deepcopy(next(item for item in first_state["users"] if item["id"] == "u-client-limited"))
        stale_copy = copy.deepcopy(next(item for item in second_state["users"] if item["id"] == "u-client-limited"))
        assert first_copy["serverUpdatedAt"] == stale_copy["serverUpdatedAt"]

        first_copy.update({"name": "Client Limited First", "password": ""})
        first_update = first_admin.post("/api/user", json={"user": first_copy})
        assert first_update.status_code == 200, first_update.text

        stale_copy.update({"name": "Client Limited Stale", "password": ""})
        stale_update = second_admin.post("/api/user", json={"user": stale_copy})
        assert stale_update.status_code == 409, stale_update.text
        stored_profile = json.loads(profile_row("u-client-limited")["payload"])
        assert stored_profile["name"] == "Client Limited First"

    with TestClient(app) as created_client:
        login(created_client, "created@test.local", "Created12345")

    with TestClient(app) as scoped_client_session:
        scoped_login = login(scoped_client_session, "scoped@test.local", "Scoped12345")
        assert {item["id"] for item in scoped_login.json()["state"]["buildings"]} == {"b-a"}

    with TestClient(app) as manager_client:
        login(manager_client, "manager@test.local", "Manager12345")
        client_created = manager_client.post(
            "/api/user",
            json={
                "user": {
                    "id": "u-client-created",
                    "name": "Client Created",
                    "email": "client-created@test.local",
                    "password": "ClientCreated12345",
                    "role": "administrateur",
                    "clientId": "client-b",
                }
            },
        )
        assert client_created.status_code == 200, client_created.text
        user = client_created.json()["user"]
        assert user["role"] == "client"
        assert user["clientId"] == "client-a"
        visible_users = client_created.json()["state"]["users"]
        assert all(item.get("clientId") == "client-a" for item in visible_users)
        assert profile_row("u-client-created") is not None
        assert {item["id"] for item in raw_state()["users"]} == original_user_ids

        other_client_update = manager_client.post(
            "/api/user",
            json={
                "user": {
                    "id": "u-client-b",
                    "name": "Client B Changed",
                    "email": "client-b@test.local",
                    "password": "",
                    "role": "client",
                    "clientId": "client-b",
                }
            },
        )
        assert other_client_update.status_code == 403, other_client_update.text

    with TestClient(app) as limited_client:
        login(limited_client, "limited@test.local", "Limited12345")
        forbidden = limited_client.post(
            "/api/user",
            json={
                "user": {
                    "id": "u-forbidden",
                    "name": "Forbidden",
                    "email": "forbidden@test.local",
                    "password": "Forbidden12345",
                    "role": "client",
                    "clientId": "client-a",
                }
            },
        )
        assert forbidden.status_code == 403, forbidden.text

    with TestClient(app) as admin_delete_client:
        login(admin_delete_client, "admin@test.local", "Admin12345")
        deleted = admin_delete_client.post("/api/user-delete", json={"userId": "u-created"})
        assert deleted.status_code == 200, deleted.text
        assert deleted.json()["deletedUserId"] == "u-created"
        assert auth_row("u-created") is None
        assert profile_row("u-created") is None
        assert all(item.get("id") != "u-created" for item in current_state()["users"])
        assert {item["id"] for item in raw_state()["users"]} == original_user_ids

    print("users_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
