from __future__ import annotations

import copy
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-documents-fastapi-"))
DB_PATH = TMP_ROOT / "documents.sqlite3"
UPLOAD_ROOT = TMP_ROOT / "uploads"

sys.path.insert(0, str(ROOT))

os.environ.pop("DATABASE_URL", None)
os.environ.pop("SUPABASE_DATABASE_URL", None)
os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)
os.environ["CLIMAPARC_DB"] = str(DB_PATH)
os.environ["CLIMAPARC_LOCAL_UPLOAD_ROOT"] = str(UPLOAD_ROOT)
os.environ["APP_BASE_URL"] = "http://testserver"

import server  # noqa: E402
from src.climaparc.main import app  # noqa: E402


def base_state() -> dict:
    return {
        "users": [
            {"id": "u-admin", "name": "Admin", "email": "admin@test.local", "password": "Admin12345", "role": "administrateur"},
            {"id": "u-tech", "name": "Tech", "email": "tech@test.local", "password": "Tech12345", "role": "technicien"},
            {
                "id": "u-client-a",
                "name": "Client A",
                "email": "client-a@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "lieux", "equipment", "tickets", "workorders", "documents"],
            },
            {
                "id": "u-client-b",
                "name": "Client B",
                "email": "client-b@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-b",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "lieux", "equipment", "tickets", "workorders", "documents"],
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
            {
                "id": "eq-a",
                "apartmentId": "apt-a",
                "type": "PTAC",
                "serial": "A",
                "attachments": [
                    {
                        "id": "file-eq-a",
                        "name": "Photo machine",
                        "fileName": "machine.jpg",
                        "fileType": "image/jpeg",
                        "storageBucket": "climaparc-documents",
                        "storagePath": "client-a/equipment/file-eq-a.jpg",
                        "workOrderId": "wo-a",
                        "equipmentId": "eq-a",
                    }
                ],
            },
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
            }
        ],
        "interventions": [
            {
                "id": "int-a",
                "workOrderId": "wo-a",
                "apartmentId": "apt-a",
                "equipmentId": "eq-a",
                "technicianId": "u-tech",
                "status": "en_cours",
                "attachments": [],
            }
        ],
        "clientDocuments": [
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
            }
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


def upload_document(client, *, file_id: str, client_id: str, building_id: str):
    return client.post(
        "/api/file-upload",
        data={
            "kind": "clientDocument",
            "id": file_id,
            "clientId": client_id,
            "buildingId": building_id,
            "name": "Contrat",
            "type": "Contrat",
            "visibleToClient": "true",
        },
        files={"file": ("contrat.pdf", b"%PDF-1.4 smoke", "application/pdf")},
    )


def run() -> None:
    from fastapi.testclient import TestClient

    reset_database()
    assert server.upload_file_with_use_case.__module__ == "src.climaparc.documents.presentation.dispatch"
    assert server.generate_file_url_with_use_case.__module__ == "src.climaparc.documents.presentation.dispatch"
    assert server.delete_file_with_use_case.__module__ == "src.climaparc.documents.presentation.dispatch"

    with TestClient(app) as admin_client:
        login(admin_client, "admin@test.local", "Admin12345")
        uploaded = upload_document(admin_client, file_id="doc-a", client_id="client-a", building_id="b-a")
        assert uploaded.status_code == 200, uploaded.text
        file = uploaded.json()["file"]
        assert file["id"] == "doc-a"
        assert file["storagePath"]
        assert "dataUrl" not in file
        assert any(item["id"] == "doc-a" for item in current_state()["clientDocuments"])

        url_response = admin_client.post("/api/file-url", json={"fileId": "doc-a"})
        assert url_response.status_code == 200, url_response.text
        assert "/api/local-file" in url_response.json()["url"]

        deleted_attachment = admin_client.post("/api/file-delete", json={"fileId": "file-eq-a"})
        assert deleted_attachment.status_code == 200, deleted_attachment.text
        state_after_attachment_delete = current_state()
        equipment = next(item for item in state_after_attachment_delete["equipment"] if item["id"] == "eq-a")
        assert equipment.get("attachments") == []

        deleted_doc = admin_client.post("/api/file-delete", json={"fileId": "doc-a"})
        assert deleted_doc.status_code == 200, deleted_doc.text
        assert all(item["id"] != "doc-a" for item in current_state()["clientDocuments"])

    with TestClient(app) as client_a:
        login(client_a, "client-a@test.local", "Client12345")
        forbidden_other_doc = client_a.post("/api/file-url", json={"fileId": "doc-b"})
        assert forbidden_other_doc.status_code == 403, forbidden_other_doc.text

        forbidden_upload = upload_document(client_a, file_id="doc-client", client_id="client-a", building_id="b-a")
        assert forbidden_upload.status_code == 403, forbidden_upload.text

    with TestClient(app) as tech_client:
        login(tech_client, "tech@test.local", "Tech12345")
        uploaded_attachment = tech_client.post(
            "/api/file-upload",
            data={
                "kind": "interventionAttachment",
                "id": "file-tech",
                "name": "Photo terrain",
                "apartmentId": "apt-a",
                "equipmentId": "eq-a",
                "workOrderId": "wo-a",
                "interventionId": "int-a",
            },
            files={"file": ("photo.jpg", b"fake-image", "image/jpeg")},
        )
        assert uploaded_attachment.status_code == 200, uploaded_attachment.text
        assert uploaded_attachment.json()["file"]["id"] == "file-tech"

    print("documents_fastapi_smoke: ok")


if __name__ == "__main__":
    try:
        run()
    finally:
        shutil.rmtree(TMP_ROOT, ignore_errors=True)
