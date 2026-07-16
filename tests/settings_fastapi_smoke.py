from __future__ import annotations

import copy
from concurrent.futures import ThreadPoolExecutor
import json
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
from backend import legacy_domain_handlers  # noqa: E402
from backend.database import row_get  # noqa: E402
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
        "hvacSystemTypes": [{"id": "system_type_ptac", "name": "PTAC", "topology": "monobloc", "sortOrder": 10, "active": True}],
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


def settings_snapshot(state: dict) -> dict:
    keys = ["serviceTypes", "interventionTypes", "formTemplates", "roleDefinitions", "dataFields", "hvacSystemTypes"]
    return {key: copy.deepcopy(state.get(key, [])) for key in keys}


def table_rows(statement: str, params: tuple = ()) -> list:
    with server.db() as connection:
        return server.execute(connection, statement, params).fetchall()


def login(client, email: str, password: str):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    assert legacy_domain_handlers.save_setting_item_with_use_case.__module__ == "src.climaparc.settings.presentation.dispatch"
    assert legacy_domain_handlers.delete_setting_item_with_use_case.__module__ == "src.climaparc.settings.presentation.dispatch"

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
        assert len(table_rows("select option_id from climaparc_data_field_options where data_field_id = ?", ("field-brand",))) == 1
        before_raw_settings = settings_snapshot(raw_state_json())

        service_type = {"id": "svc-new", "name": "Urgence", "defaultPriority": "urgente", "linkedInterventionTypeId": "int-existing"}
        service_created = admin_client.post("/api/setting-item", json={"collectionKey": "serviceTypes", "item": service_type})
        assert service_created.status_code == 200, service_created.text
        assert any(item["id"] == "svc-new" for item in service_created.json()["state"]["serviceTypes"])
        assert settings_snapshot(raw_state_json()) == before_raw_settings

        form_template = {
            "id": "form-new",
            "name": "Inspection PTAC",
            "associatedActivityTypeIds": ["int-existing"],
            "activityFields": {},
            "fields": [{"id": "q-status", "label": "Statut", "type": "single", "options": ["OK"], "required": True, "unitScopes": ["interieure", "exterieure"], "systemTypeIds": ["system_type_ptac"]}],
        }
        form_created = admin_client.post("/api/setting-item", json={"collectionKey": "formTemplates", "item": form_template})
        assert form_created.status_code == 200, form_created.text
        assert len(table_rows("select field_id from climaparc_form_template_fields where template_id = ?", ("form-new",))) == 1
        field_row = table_rows("select unit_scopes, system_type_ids from climaparc_form_template_fields where template_id = ?", ("form-new",))[0]
        assert json.loads(row_get(field_row, "unit_scopes")) == ["interieure", "exterieure"]
        assert json.loads(row_get(field_row, "system_type_ids")) == ["system_type_ptac"]
        assert next(item for item in form_created.json()["state"]["interventionTypes"] if item["id"] == "int-existing")["defaultFormTemplateId"] == "form-new"

        # Two independent sessions must never silently overwrite the same
        # form. This is the exact scenario that used to resurrect questions.
        with TestClient(app) as second_editor:
            login(second_editor, "internal@test.local", "Internal12345")
            shared_form = copy.deepcopy(form_created.json()["item"])
            admin_version = copy.deepcopy(shared_form)
            admin_version["fields"] = [
                {"id": "q-admin", "label": "Question conservee", "type": "text", "unitScopes": ["all"]}
            ]
            admin_saved = admin_client.post("/api/setting-item", json={"collectionKey": "formTemplates", "item": admin_version})
            assert admin_saved.status_code == 200, admin_saved.text

            stale_version = copy.deepcopy(shared_form)
            stale_version["fields"].append(
                {"id": "q-stale", "label": "Copie ancienne", "type": "text", "unitScopes": ["all"]}
            )
            stale_save = second_editor.post("/api/setting-item", json={"collectionKey": "formTemplates", "item": stale_version})
            assert stale_save.status_code == 409, stale_save.text
            persisted_form = next(item for item in current_state()["formTemplates"] if item["id"] == "form-new")
            assert [field["id"] for field in persisted_form["fields"]] == ["q-admin"]

            distinct_items = [
                {"id": "svc-concurrent-a", "name": "Concurrent A", "defaultPriority": "normale"},
                {"id": "svc-concurrent-b", "name": "Concurrent B", "defaultPriority": "normale"},
            ]
            with ThreadPoolExecutor(max_workers=2) as executor:
                responses = list(executor.map(
                    lambda args: args[0].post("/api/setting-item", json={"collectionKey": "serviceTypes", "item": args[1]}),
                    [(admin_client, distinct_items[0]), (second_editor, distinct_items[1])],
                ))
            assert all(response.status_code == 200 for response in responses), [response.text for response in responses]
            service_ids = {item["id"] for item in current_state()["serviceTypes"]}
            assert {"svc-concurrent-a", "svc-concurrent-b"}.issubset(service_ids)

            deletable = {
                "id": "form-delete-concurrent",
                "name": "Suppression concurrente",
                "activityFields": {},
                "fields": [{"id": "q-delete", "label": "Question", "type": "text", "unitScopes": ["all"]}],
            }
            created_for_delete = admin_client.post("/api/setting-item", json={"collectionKey": "formTemplates", "item": deletable})
            assert created_for_delete.status_code == 200, created_for_delete.text
            stale_deleted_form = copy.deepcopy(created_for_delete.json()["item"])
            deleted_form = admin_client.post(
                "/api/setting-item-delete",
                json={"collectionKey": "formTemplates", "itemId": "form-delete-concurrent"},
            )
            assert deleted_form.status_code == 200, deleted_form.text
            resurrection = second_editor.post(
                "/api/setting-item",
                json={"collectionKey": "formTemplates", "item": stale_deleted_form},
            )
            assert resurrection.status_code == 409, resurrection.text
            assert all(item["id"] != "form-delete-concurrent" for item in current_state()["formTemplates"])

        system_type = {"id": "system_type_split_test", "name": "Thermopompe test", "topology": "split", "sortOrder": 90, "active": True}
        system_type_created = admin_client.post("/api/setting-item", json={"collectionKey": "hvacSystemTypes", "item": system_type})
        assert system_type_created.status_code == 200, system_type_created.text
        assert len(table_rows("select id from climaparc_hvac_system_types where id = ?", ("system_type_split_test",))) == 1

        role = {"id": "role-new", "name": "Maintenance", "rights": ["equipment", "workorders"]}
        role_created = admin_client.post("/api/setting-item", json={"collectionKey": "roleDefinitions", "item": role})
        assert role_created.status_code == 200, role_created.text
        assert len(table_rows("select permission from climaparc_role_permissions where role_id = ?", ("role-new",))) == 2

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
        assert all(item["id"] != "svc-new" for item in deleted.json()["state"]["serviceTypes"])
        assert settings_snapshot(raw_state_json()) == before_raw_settings

        field_deleted = admin_client.post("/api/setting-item-delete", json={"collectionKey": "dataFields", "itemId": "field-brand"})
        assert field_deleted.status_code == 200, field_deleted.text
        assert not table_rows("select option_id from climaparc_data_field_options where data_field_id = ?", ("field-brand",))
        assert all(item["id"] != "field-brand" for item in field_deleted.json()["state"]["dataFields"])

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
