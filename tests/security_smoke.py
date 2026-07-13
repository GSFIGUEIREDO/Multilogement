from __future__ import annotations

import copy
import os
import shutil
import sys
import tempfile
from http import HTTPStatus
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-smoke-"))
DB_PATH = TMP_ROOT / "smoke.sqlite3"
UPLOAD_ROOT = TMP_ROOT / "uploads"

sys.path.insert(0, str(ROOT))

os.environ.pop("DATABASE_URL", None)
os.environ.pop("SUPABASE_DATABASE_URL", None)
os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)
os.environ["CLIMAPARC_DB"] = str(DB_PATH)
os.environ["CLIMAPARC_LOCAL_UPLOAD_ROOT"] = str(UPLOAD_ROOT)

import server  # noqa: E402
from backend.auth_services import AuthService, PasswordResetService  # noqa: E402
import backend.file_storage as file_storage  # noqa: E402
from backend.file_storage import FileService, SupabaseStorageBackend, migrate_legacy_data_urls  # noqa: E402
from backend.security import can_save_collection, filter_state_for_user  # noqa: E402
from backend.services import EquipmentService, InterventionService, ServiceError, WorkOrderService  # noqa: E402


def base_state() -> dict:
    return {
        "users": [
            {"id": "u-admin", "name": "Admin", "email": "admin@test.local", "password": "Admin12345", "role": "administrateur"},
            {"id": "u-tech", "name": "Tech A", "email": "tech@test.local", "password": "Tech12345", "role": "technicien"},
            {
                "id": "u-client-a",
                "name": "Client A",
                "email": "client-a@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "gestionnaire",
                "portalRights": ["portal", "lieux", "equipment", "tickets", "workorders", "recommendations", "documents"],
            },
            {
                "id": "u-client-b",
                "name": "Client B",
                "email": "client-b@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-b",
                "clientAccessLevel": "direction",
            },
        ],
        "clients": [
            {"id": "client-a", "name": "Client A"},
            {"id": "client-b", "name": "Client B"},
        ],
        "buildings": [
            {"id": "b-a", "clientId": "client-a", "name": "Lieu A", "address": "1 Rue A"},
            {"id": "b-b", "clientId": "client-b", "name": "Lieu B", "address": "2 Rue B"},
        ],
        "apartments": [
            {"id": "apt-a", "buildingId": "b-a", "number": "101"},
            {"id": "apt-b", "buildingId": "b-b", "number": "202"},
        ],
        "equipment": [
            {"id": "eq-a", "apartmentId": "apt-a", "type": "PTAC", "brand": "A", "model": "A1", "serial": "AAA"},
            {"id": "eq-b", "apartmentId": "apt-b", "type": "PTAC", "brand": "B", "model": "B1", "serial": "BBB"},
        ],
        "tickets": [
            {"id": "t-a", "number": "AS-A", "clientId": "client-a", "buildingId": "b-a", "apartmentId": "apt-a", "equipmentId": "eq-a"},
            {"id": "t-b", "number": "AS-B", "clientId": "client-b", "buildingId": "b-b", "apartmentId": "apt-b", "equipmentId": "eq-b"},
        ],
        "workOrders": [
            {"id": "wo-a", "number": "BT-A", "ticketId": "t-a", "buildingId": "b-a", "apartmentId": "apt-a", "equipmentId": "eq-a", "technicianId": "u-tech", "status": "En cours"},
            {"id": "wo-b", "number": "BT-B", "ticketId": "t-b", "buildingId": "b-b", "apartmentId": "apt-b", "equipmentId": "eq-b", "technicianId": "", "status": "En cours"},
        ],
        "interventions": [
            {
                "id": "int-a",
                "workOrderId": "wo-a",
                "apartmentId": "apt-a",
                "equipmentId": "eq-a",
                "technicianId": "u-tech",
                "status": "Terminee",
                "recommendation": {"status": "envoyee", "price": "120.00", "delay": "2 jours", "description": "Test"},
            },
            {
                "id": "int-b",
                "workOrderId": "wo-b",
                "apartmentId": "apt-b",
                "equipmentId": "eq-b",
                "status": "Terminee",
                "recommendation": {"status": "envoyee", "price": "500.00", "delay": "7 jours"},
            },
        ],
        "clientDocuments": [
            {
                "id": "doc-a",
                "name": "Doc A",
                "fileName": "a.pdf",
                "fileType": "application/pdf",
                "fileSize": 12,
                "storageBucket": "climaparc-documents",
                "storagePath": "client-a/document/a.pdf",
                "clientId": "client-a",
                "buildingId": "b-a",
                "visibleToClient": True,
            },
            {
                "id": "doc-b",
                "name": "Doc B",
                "fileName": "b.pdf",
                "fileType": "application/pdf",
                "fileSize": 12,
                "storageBucket": "climaparc-documents",
                "storagePath": "client-b/document/b.pdf",
                "clientId": "client-b",
                "buildingId": "b-b",
                "visibleToClient": True,
            },
        ],
        "reminders": [],
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


def row(user_id: str):
    with server.db() as connection:
        return server.execute(connection, "select * from climaparc_users where id = ?", (user_id,)).fetchone()


def current_state() -> dict:
    with server.db() as connection:
        return server.get_state(connection)


def assert_raises_status(expected_status: HTTPStatus, callback) -> None:
    try:
        callback()
    except Exception as error:
        status = getattr(error, "status", None)
        assert status == expected_status, f"expected {expected_status}, got {status}: {error}"
        return
    raise AssertionError(f"expected exception with status {expected_status}")


def assert_no_key(value, key: str) -> None:
    if isinstance(value, dict):
        assert key not in value, f"{key} leaked in {value}"
        for child in value.values():
            assert_no_key(child, key)
    elif isinstance(value, list):
        for child in value:
            assert_no_key(child, key)


def reset_database() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    server.init_db()
    seed = base_state()
    with server.db() as connection:
        server.save_state(connection, copy.deepcopy(seed))
        server.sync_users(connection, seed)
    server.sync_relational_tables_safely(seed)


def run() -> None:
    reset_database()
    admin = row("u-admin")
    tech = row("u-tech")
    client_a = row("u-client-a")

    filtered_a = filter_state_for_user(current_state(), client_a)
    assert {item["id"] for item in filtered_a["clients"]} == {"client-a"}
    assert {item["id"] for item in filtered_a["buildings"]} == {"b-a"}
    assert all(item.get("clientId") != "client-b" for item in filtered_a.get("tickets", []))

    assert_raises_status(HTTPStatus.FORBIDDEN, lambda: FileService().temporary_url(client_a, "doc-b"))
    assert_raises_status(HTTPStatus.FORBIDDEN, lambda: FileService().delete(client_a, "doc-b"))

    approval_payload = {"id": "int-a", "recommendation": {"status": "approuvee"}}
    assert_raises_status(HTTPStatus.FORBIDDEN, lambda: InterventionService().save(client_a, approval_payload))

    filtered_recommendation = next(item for item in filtered_a["interventions"] if item["id"] == "int-a")["recommendation"]
    assert "price" not in filtered_recommendation
    assert "delay" not in filtered_recommendation

    filtered_tech = filter_state_for_user(current_state(), tech)
    assert {item["id"] for item in filtered_tech["workOrders"]} == {"wo-a"}
    assert {item["id"] for item in filtered_tech["interventions"]} == {"int-a"}

    technician_state = current_state()
    assert can_save_collection(
        technician_state,
        tech,
        "equipment",
        {"id": "eq-new-tech", "apartmentId": "apt-a", "type": "PTAC", "serial": "NEW"},
    )
    existing_equipment = next(item for item in technician_state["equipment"] if item["id"] == "eq-a")
    assert can_save_collection(technician_state, tech, "equipment", {**existing_equipment, "status": "surveillance"})
    assert not can_save_collection(technician_state, tech, "equipment", {**existing_equipment, "serial": "CHANGED"})
    existing_apartment = next(item for item in technician_state["apartments"] if item["id"] == "apt-a")
    assert not can_save_collection(technician_state, tech, "apartments", {**existing_apartment, "number": "102"})
    assert can_save_collection(technician_state, tech, "apartments", {"id": "apt-new-tech", "buildingId": "b-a", "number": "103"})
    next(item for item in technician_state["users"] if item["id"] == "u-tech")["technicianPermissions"] = [
        "edit_apartments",
        "edit_equipment",
    ]
    assert can_save_collection(technician_state, tech, "equipment", {**existing_equipment, "serial": "AUTHORIZED"})
    assert can_save_collection(technician_state, tech, "apartments", {**existing_apartment, "number": "104"})

    bad_work_order = {"id": "wo-b", "number": "BT-B", "buildingId": "b-b", "apartmentId": "apt-b", "equipmentId": "eq-b", "status": "Terminee"}
    assert_raises_status(HTTPStatus.FORBIDDEN, lambda: WorkOrderService().save(tech, bad_work_order))

    EquipmentService().save(admin, {"id": "eq-new", "apartmentId": "apt-a", "type": "PTAC", "brand": "A", "model": "A2", "serial": "NEW"})
    assert any(item["id"] == "eq-new" for item in current_state()["equipment"])

    upload_result = FileService().upload(
        admin,
        {"kind": "clientDocument", "clientId": "client-a", "buildingId": "b-a", "name": "Upload test"},
        {"filename": "upload-test.pdf", "contentType": "application/pdf", "content": b"%PDF-1.4 smoke"},
    )
    uploaded = upload_result["file"]
    assert uploaded["storagePath"]
    assert uploaded["storageBucket"] == "climaparc-documents"
    assert "dataUrl" not in uploaded
    assert_no_key(upload_result["state"], "dataUrl")

    legacy_state = {"clientDocuments": [{"id": "legacy-doc", "clientId": "client-a", "kind": "clientDocument", "name": "Legacy", "fileName": "legacy.pdf", "dataUrl": "data:application/pdf;base64,JVBERi0xLjQ="}]}
    migrated, warnings = migrate_legacy_data_urls(legacy_state)
    assert migrated is True, warnings
    assert legacy_state["clientDocuments"][0]["storagePath"]
    assert "dataUrl" not in legacy_state["clientDocuments"][0]

    login_result = AuthService().login("admin@test.local", "Admin12345")
    assert login_result["user"]["id"] == "u-admin"
    assert "token" in login_result
    assert_no_key(login_result["state"], "password")

    signup_result = AuthService().signup(
        {
            "email": "new-client@test.local",
            "password": "NewClient12345",
            "confirmPassword": "NewClient12345",
            "companyName": "New Client",
            "name": "New User",
        }
    )
    assert signup_result["user"]["role"] == "client"
    assert_no_key(signup_result["state"], "password")

    reset_result = PasswordResetService().request_reset("admin@test.local", "http://localhost")
    assert reset_result["ok"] is True
    assert_no_key(reset_result["state"], "tokenHash")
    assert_no_key(reset_result["state"], "token")

    original_request = file_storage.supabase_request
    original_url = file_storage.SUPABASE_URL
    original_key = file_storage.SUPABASE_SERVICE_ROLE_KEY
    try:
        file_storage.SUPABASE_URL = "https://example.supabase.co"
        file_storage.SUPABASE_SERVICE_ROLE_KEY = "service-role"

        def fake_supabase_request(method, path, body=None, headers=None):
            assert path == "/object/sign/bucket/path.pdf"
            return {"signedURL": "/object/sign/bucket/path.pdf?token=abc"}

        file_storage.supabase_request = fake_supabase_request
        assert SupabaseStorageBackend().signed_url("bucket", "path.pdf") == "https://example.supabase.co/storage/v1/object/sign/bucket/path.pdf?token=abc"
    finally:
        file_storage.supabase_request = original_request
        file_storage.SUPABASE_URL = original_url
        file_storage.SUPABASE_SERVICE_ROLE_KEY = original_key

    print("security_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
