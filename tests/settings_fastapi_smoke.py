from __future__ import annotations

import copy
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-settings-fastapi-"))
DB_PATH = TMP_ROOT / "settings.sqlite3"

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
            {"id": "u-client", "name": "Client", "email": "client@test.local", "password": "Client12345", "role": "client", "clientId": "client-a"},
        ],
        "clients": [{"id": "client-a", "name": "Client A"}],
        "buildings": [],
        "apartments": [],
        "equipment": [],
        "tickets": [],
        "workOrders": [],
        "interventions": [],
        "reminders": [],
        "clientDocuments": [],
        "serviceTypes": [{"id": "svc-existing", "name": "Entretien", "defaultPriority": "normale", "linkedInterventionTypeId": ""}],
        "interventionTypes": [{"id": "int-existing", "name": "Inspection", "defaultDuration": 60, "checklist": ["Verifier"]}],
        "formTemplates": [{"id": "form-existing", "name": "Formulaire", "fields": [{"id": "q1", "label": "Etat", "type": "text"}], "activityFields": {}}],
        "roleDefinitions": [{"id": "role-existing", "name": "Role existant", "rights": ["equipment"]}],
        "dataFields": [{"id": "field-existing", "name": "Marque", "group": "Machine", "type": "single", "appliesTo": ["equipment"], "options": []}],
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
    assert server.save_setting_item_with_use_case.__module__ == "src.climaparc.settings.presentation.dispatch"
    assert server.delete_setting_item_with_use_case.__module__ == "src.climaparc.settings.presentation.dispatch"

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        data_field = {
            "id": "field-brand",
            "name": "Marque",
            "group": "Machine",
            "type": "single",
            "appliesTo": ["activity", "equipment"],
            "options": [{"id": "carrier", "label": "Carrier", "value": "Carrier", "active": True}],
        }
        created = admin_client.post("/api/setting-item", json={"collectionKey": "dataFields", "item": data_field})
        assert created.status_code == 200, created.text
        assert created.json()["item"]["id"] == "field-brand"
        assert any(item["id"] == "field-brand" for item in current_state()["dataFields"])

        service_type = {"id": "svc-new", "name": "Urgence", "defaultPriority": "urgente", "linkedInterventionTypeId": "int-existing"}
        service_created = admin_client.post("/api/setting-item", json={"collectionKey": "serviceTypes", "item": service_type})
        assert service_created.status_code == 200, service_created.text

        form_template = {
            "id": "form-new",
            "name": "Inspection PTAC",
            "activityFields": {},
            "fields": [{"id": "q-status", "label": "Statut", "type": "single", "options": ["OK"], "required": True}],
        }
        form_created = admin_client.post("/api/setting-item", json={"collectionKey": "formTemplates", "item": form_template})
        assert form_created.status_code == 200, form_created.text

        role = {"id": "role-new", "name": "Maintenance", "rights": ["equipment", "workorders"]}
        role_created = admin_client.post("/api/setting-item", json={"collectionKey": "roleDefinitions", "item": role})
        assert role_created.status_code == 200, role_created.text

        invalid_collection = admin_client.post("/api/setting-item", json={"collectionKey": "unknown", "item": {"id": "x"}})
        assert invalid_collection.status_code == 400, invalid_collection.text

        invalid_duration = admin_client.post(
            "/api/setting-item",
            json={"collectionKey": "interventionTypes", "item": {"id": "bad", "name": "Bad", "defaultDuration": "abc"}},
        )
        assert invalid_duration.status_code == 400, invalid_duration.text

        deleted = admin_client.post("/api/setting-item-delete", json={"collectionKey": "serviceTypes", "itemId": "svc-new"})
        assert deleted.status_code == 200, deleted.text
        assert all(item["id"] != "svc-new" for item in current_state()["serviceTypes"])

    with TestClient(app) as internal_client:
        login(internal_client, "internal@test.local", "Internal12345")
        internal_created = internal_client.post(
            "/api/setting-item",
            json={"collectionKey": "interventionTypes", "item": {"id": "int-new", "name": "Diagnostic", "defaultDuration": 45, "checklist": ["Photo"]}},
        )
        assert internal_created.status_code == 200, internal_created.text

    with TestClient(app) as client_user:
        login(client_user, "client@test.local", "Client12345")
        forbidden = client_user.post("/api/setting-item", json={"collectionKey": "serviceTypes", "item": {"id": "svc-client", "name": "Client"}})
        assert forbidden.status_code == 403, forbidden.text
        forbidden_delete = client_user.post("/api/setting-item-delete", json={"collectionKey": "dataFields", "itemId": "field-existing"})
        assert forbidden_delete.status_code == 403, forbidden_delete.text

    print("settings_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)

