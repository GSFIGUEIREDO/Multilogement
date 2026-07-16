from __future__ import annotations

import copy
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TMP_ROOT = Path(tempfile.mkdtemp(prefix="climaparc-field-operations-"))
DB_PATH = TMP_ROOT / "field-operations.sqlite3"

sys.path.insert(0, str(ROOT))
os.environ.pop("DATABASE_URL", None)
os.environ.pop("SUPABASE_DATABASE_URL", None)
os.environ["CLIMAPARC_DB"] = str(DB_PATH)
os.environ["APP_BASE_URL"] = "http://testserver"

import server  # noqa: E402
from backend.database import row_get  # noqa: E402
from src.climaparc.main import app  # noqa: E402
from src.climaparc.field_operations.domain.policies import normalize_replacement_bundle  # noqa: E402


def base_state() -> dict:
    return {
        "users": [
            {"id": "u-admin", "name": "Admin", "email": "admin@test.local", "password": "Admin12345", "role": "administrateur"},
            {"id": "u-tech", "name": "Tech", "email": "tech@test.local", "password": "Tech12345", "role": "technicien"},
            {"id": "u-tech-2", "name": "Tech 2", "email": "tech2@test.local", "password": "Tech12345", "role": "technicien"},
            {
                "id": "u-client",
                "name": "Client",
                "email": "client@test.local",
                "password": "Client12345",
                "role": "client",
                "clientId": "client-a",
                "clientAccessLevel": "direction",
                "portalRights": ["portal", "lieux", "equipment", "workorders", "recommendations", "recommendation_approve", "recommendation_prices"],
            },
        ],
        "clients": [{"id": "client-a", "name": "Client A"}],
        "buildings": [{"id": "b-a", "clientId": "client-a", "name": "Lieu A"}],
        "apartments": [
            {"id": "apt-a", "buildingId": "b-a", "number": "101"},
            {"id": "apt-a2", "buildingId": "b-a", "number": "102"},
        ],
        "equipment": [
            {"id": "eq-old", "apartmentId": "apt-a", "systemId": "system-a", "unitKind": "monobloc", "type": "PTAC", "brand": "Carrier", "model": "42C", "serial": "OLD-1", "status": "hors_service", "lifecycleStatus": "installed", "attachments": []},
        ],
        "tickets": [],
        "workOrders": [
            {"id": "wo-replace", "number": "BT-2026-001", "scope": "equipment", "equipmentId": "eq-old", "apartmentId": "apt-a", "buildingId": "b-a", "typeId": "remplacement_unite", "formTemplateId": "form_remplacement_unite", "technicianId": "u-tech", "assignedTechnicianIds": ["u-tech"], "status": "planifie"},
        ],
        "interventions": [
            {
                "id": "int-recommendation",
                "equipmentId": "eq-old",
                "apartmentId": "apt-a",
                "workOrderId": "wo-inspection",
                "recommendation": {"type": "remplacement", "status": "envoyee", "description": "Remplacer l'unité", "priority": "urgente", "price": "900.00", "delay": "10 jours"},
            }
        ],
        "reminders": [],
        "clientDocuments": [],
        "serviceTypes": [],
        "interventionTypes": [
            {"id": "remplacement_unite", "name": "Remplacement d'une unité", "behavior": "replacement", "defaultFormTemplateId": "form_remplacement_unite", "checklist": []},
            {"id": "inspection", "name": "Inspection", "behavior": "standard", "defaultFormTemplateId": "form_remplacement_unite", "checklist": []},
        ],
        "formTemplates": [{"id": "form_remplacement_unite", "name": "Remplacement", "fields": [], "activityFields": {}}],
        "hvacSystemTypes": [{"id": "system_type_ptac", "name": "PTAC", "topology": "monobloc", "sortOrder": 10, "active": True}],
        "hvacSystems": [],
        "roleDefinitions": [],
        "dataFields": [
            {"id": "activity_status", "name": "Résultat", "group": "Résultats d'activité", "type": "single", "appliesTo": ["activity"], "options": [{"id": "completee", "value": "completee", "label": "Terminée", "behavior": "completed", "active": True}]},
            {"id": "equipment_status", "name": "État", "group": "États de machine", "type": "single", "appliesTo": ["activity", "equipment"], "options": [{"id": "actif", "value": "actif", "label": "Opérationnelle", "behavior": "operational", "active": True}]},
            {"id": "recommendation_type", "name": "Recommandation", "group": "Types de recommandation", "type": "single", "appliesTo": ["activity"], "options": [{"id": "remplacement", "value": "remplacement", "label": "Remplacement", "behavior": "replacement", "active": True}]},
        ],
        "storageLocations": [{"id": "storage-a", "clientId": "client-a", "name": "Dépôt A", "active": True}],
        "equipmentMovements": [],
        "equipmentReplacements": [],
        "passwordResetRequests": [],
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


def login(client, email: str, password: str) -> None:
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def field_payload(suffix: str = "") -> dict:
    return {
        "apartment": None,
        "equipment": {"id": "eq-old", "apartmentId": "apt-a", "systemId": "system-a", "unitKind": "monobloc", "type": "PTAC", "brand": "Carrier", "model": "42C", "serial": "OLD-1", "status": "actif", "machineStatus": "actif", "manufactureAgeInfo": "", "lifecycleStatus": "installed", "attachments": []},
        "intervention": {"id": f"int-replace{suffix}", "equipmentId": "eq-old", "apartmentId": "apt-a", "workOrderId": "wo-replace", "typeId": "remplacement_unite", "date": "2026-07-14", "technicianId": "u-tech", "status": "terminee", "activityStatus": "completee", "machineStatus": "actif", "formResponses": {}},
        "workOrder": {"id": "wo-replace", "number": "BT-2026-001", "scope": "equipment", "equipmentId": "eq-old", "apartmentId": "apt-a", "buildingId": "b-a", "typeId": "remplacement_unite", "formTemplateId": "form_remplacement_unite", "technicianId": "u-tech", "assignedTechnicianIds": ["u-tech"], "status": "en_cours"},
        "replacement": {
            "action": "transfer_apartment",
            "destinationApartmentId": "apt-a2",
            "reason": "Remplacement planifié",
            "movementId": f"move-1{suffix}",
            "replacementId": f"replacement-1{suffix}",
            "newEquipment": {"id": f"eq-new{suffix}", "apartmentId": "apt-a", "systemId": "system-a", "unitKind": "monobloc", "type": "PTAC", "brand": "Carrier", "model": "NEW", "serial": f"NEW-1{suffix}", "status": "actif", "manufactureAgeInfo": "environ 2 ans", "attachments": []},
        },
    }


def assert_replacement_policy_variants() -> None:
    for action, expected_lifecycle in (("storage", "stored"), ("dispose", "disposed")):
        state = base_state()
        old_equipment = copy.deepcopy(state["equipment"][0])
        intervention = {
            "id": f"int-{action}",
            "equipmentId": "eq-old",
            "apartmentId": "apt-a",
            "workOrderId": "wo-replace",
            "typeId": "remplacement_unite",
            "activityStatus": "completee",
        }
        replacement = {
            "action": action,
            "destinationStorageLocationId": "storage-a" if action == "storage" else "",
            "movementId": f"move-{action}",
            "replacementId": f"relation-{action}",
            "newEquipment": {
                "id": f"eq-new-{action}",
                "unitKind": "interieure",
                "type": "PTAC",
                "status": "actif",
                "manufactureAgeInfo": "2024",
            },
        }
        updated_old, bundle = normalize_replacement_bundle(
            state,
            {"id": "u-tech"},
            old_equipment,
            intervention,
            state["workOrders"][0],
            replacement,
        )
        assert updated_old["lifecycleStatus"] == expected_lifecycle
        assert updated_old["apartmentId"] == ""
        assert bundle and bundle["newEquipment"]["apartmentId"] == "apt-a"
        if action == "storage":
            assert updated_old["storageLocationId"] == "storage-a"
        else:
            assert updated_old["disposedAt"]

    state = base_state()
    state["equipment"].append(
        {
            "id": "eq-stock",
            "clientId": "client-a",
            "apartmentId": "",
            "storageLocationId": "storage-a",
            "lifecycleStatus": "stored",
            "unitKind": "interieure",
            "type": "PTAC",
            "status": "actif",
        }
    )
    intervention = {
        "id": "int-existing-unit",
        "equipmentId": "eq-old",
        "apartmentId": "apt-a",
        "workOrderId": "wo-replace",
        "typeId": "remplacement_unite",
        "activityStatus": "completee",
    }
    _, bundle = normalize_replacement_bundle(
        state,
        {"id": "u-tech"},
        copy.deepcopy(state["equipment"][0]),
        intervention,
        state["workOrders"][0],
        {
            "action": "dispose",
            "movementId": "move-existing-unit",
            "replacementId": "relation-existing-unit",
            "newEquipment": copy.deepcopy(state["equipment"][1]),
        },
    )
    assert bundle and bundle["newEquipmentMovement"]
    assert bundle["newEquipmentMovement"]["fromStorageLocationId"] == "storage-a"
    assert bundle["newEquipmentMovement"]["toApartmentId"] == "apt-a"


def run() -> None:
    from fastapi.testclient import TestClient

    assert_replacement_policy_variants()
    reset_database()
    with TestClient(app) as technician:
        login(technician, "tech@test.local", "Tech12345")
        system = technician.post("/api/hvac-system", json={"system": {"id": "system-a", "apartmentId": "apt-a", "name": "PTAC 101", "systemTypeId": "system_type_ptac", "brand": "Carrier"}, "workOrderId": "wo-replace"})
        assert system.status_code == 200, system.text
        for suffix in ("-inspection", "-entretien"):
            activity = field_payload(suffix)
            activity["intervention"]["typeId"] = "inspection"
            activity["equipment"]["systemId"] = "system-a"
            activity["replacement"] = None
            multi_saved = technician.post("/api/field-intervention", json=activity)
            assert multi_saved.status_code == 200, multi_saved.text
        assert len([item for item in current_state()["interventions"] if item.get("workOrderId") == "wo-replace" and item.get("equipmentId") == "eq-old"]) == 2

        replacement_payload = field_payload()
        replacement_payload["equipment"]["systemId"] = "system-a"
        saved = technician.post("/api/field-intervention", json=replacement_payload)
        assert saved.status_code == 200, saved.text
        state = current_state()
        old_equipment = next(item for item in state["equipment"] if item["id"] == "eq-old")
        new_equipment = next(item for item in state["equipment"] if item["id"] == "eq-new")
        assert old_equipment["apartmentId"] == "apt-a2"
        assert old_equipment["lifecycleStatus"] == "installed"
        assert new_equipment["apartmentId"] == "apt-a"
        assert new_equipment["estimatedAgeYears"] == 2
        assert len(state["equipmentMovements"]) == 1
        assert len(state["equipmentReplacements"]) == 1

        replay = field_payload()
        replay["equipment"]["apartmentId"] = "apt-a2"
        replay["intervention"]["apartmentId"] = "apt-a2"
        replay["replacement"] = None
        replayed = technician.post("/api/field-intervention", json=replay)
        assert replayed.status_code == 200, replayed.text
        state = current_state()
        assert len(state["equipmentMovements"]) == 1
        assert len(state["equipmentReplacements"]) == 1

        completed = technician.post("/api/work-order/complete-apartment", json={"workOrderId": "wo-replace", "apartmentId": "apt-a"})
        assert completed.status_code == 200, completed.text
        assert completed.json()["workOrder"]["status"] == "termine"

    with TestClient(app) as unassigned_technician:
        login(unassigned_technician, "tech2@test.local", "Tech12345")
        forbidden_system = unassigned_technician.post("/api/hvac-system", json={"system": {"id": "system-forbidden", "apartmentId": "apt-a", "name": "Non autorisé", "systemTypeId": "system_type_ptac", "brand": "Carrier"}, "workOrderId": "wo-replace"})
        assert forbidden_system.status_code == 403, forbidden_system.text

    with TestClient(app) as client:
        login(client, "client@test.local", "Client12345")
        approval = client.post("/api/recommendation/client-response", json={"interventionId": "int-recommendation", "recommendation": {"status": "approuvee"}})
        assert approval.status_code == 200, approval.text
        assert approval.json().get("workOrder") is None
        second = client.post("/api/recommendation/client-response", json={"interventionId": "int-recommendation", "recommendation": {"status": "approuvee"}})
        assert second.status_code == 200, second.text

    with TestClient(app) as admin:
        login(admin, "admin@test.local", "Admin12345")
        routed = admin.post("/api/recommendation/route", json={"interventionId": "int-recommendation", "mode": "new"})
        assert routed.status_code == 200, routed.text
        draft = routed.json().get("workOrder")
        assert draft and draft["status"] == "brouillon"
        assert draft["defaultActivityTypeId"] == "remplacement_unite"
        assert draft["approvedPrice"] == "900.00"
        second_route = admin.post("/api/recommendation/route", json={"interventionId": "int-recommendation", "mode": "new"})
        assert second_route.status_code == 200, second_route.text
        assert len([item for item in current_state()["workOrderTargets"] if item.get("sourceRecommendationId") == "int-recommendation"]) == 1

    failing = field_payload("-fail")
    failing["equipment"]["apartmentId"] = "apt-a2"
    failing["intervention"]["apartmentId"] = "apt-a2"
    failing["replacement"]["destinationApartmentId"] = "apt-a"
    with server.db() as connection:
        server.execute(connection, "delete from climaparc_equipment_replacements")
        server.execute(connection, "delete from climaparc_equipment_movements")
        server.execute(connection, "create trigger fail_movement before insert on climaparc_equipment_movements when NEW.id = 'move-1-fail' begin select raise(abort, 'forced rollback'); end")
    with TestClient(app, raise_server_exceptions=False) as technician:
        login(technician, "tech@test.local", "Tech12345")
        failed = technician.post("/api/field-intervention", json=failing)
        assert failed.status_code == 500
    state = current_state()
    assert all(item["id"] != "eq-new-fail" for item in state["equipment"])
    assert all(item["id"] != "int-replace-fail" for item in state["interventions"])

    shutil.rmtree(TMP_ROOT, ignore_errors=True)
    print("field_operations_fastapi_smoke: ok")


if __name__ == "__main__":
    run()
