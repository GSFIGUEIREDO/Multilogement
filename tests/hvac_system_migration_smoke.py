from __future__ import annotations

import copy
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.operational_migrations import migrate_operational_state


def fixture_state() -> dict:
    return {
        "clients": [{"id": "client-a", "name": "Client A"}],
        "buildings": [{"id": "building-a", "clientId": "client-a", "name": "Lieu A"}],
        "apartments": [
            {"id": "apt-ptac", "buildingId": "building-a", "number": "101"},
            {"id": "apt-split", "buildingId": "building-a", "number": "102"},
            {"id": "apt-conflict", "buildingId": "building-a", "number": "103"},
        ],
        "equipment": [
            {"id": "eq-ptac", "apartmentId": "apt-ptac", "type": "PTAC", "brand": "Carrier"},
            {"id": "eq-out", "apartmentId": "apt-split", "unitKind": "exterieure", "type": "Thermopompe murale", "brand": "Gree"},
            {"id": "eq-in-1", "apartmentId": "apt-split", "unitKind": "interieure", "type": "Thermopompe murale", "brand": "Gree"},
            {"id": "eq-in-2", "apartmentId": "apt-split", "unitKind": "interieure", "type": "Thermopompe murale", "brand": "Gree"},
            {"id": "eq-conflict-out", "apartmentId": "apt-conflict", "unitKind": "exterieure", "type": "Thermopompe murale", "brand": "Carrier"},
            {"id": "eq-conflict-in", "apartmentId": "apt-conflict", "unitKind": "interieure", "type": "Thermopompe murale", "brand": "Lennox"},
        ],
        "formTemplates": [
            {"id": "form-a", "name": "Inspection", "fields": [{"id": "q-a", "label": "Etat", "type": "text", "unitScope": "exterieure"}]}
        ],
        "hvacSystemTypes": [],
        "hvacSystems": [],
        "storageLocations": [],
        "workOrders": [],
        "workOrderTargets": [],
    }


def run() -> None:
    state = fixture_state()
    changed = migrate_operational_state(state)
    assert {"hvacSystemTypes", "hvacSystems", "equipment", "formTemplates"}.issubset(changed)

    ptac = next(item for item in state["equipment"] if item["id"] == "eq-ptac")
    ptac_system = next(item for item in state["hvacSystems"] if item["id"] == ptac["systemId"])
    assert ptac["unitKind"] == "monobloc"
    assert ptac_system["topology"] == "monobloc"
    assert ptac_system["systemTypeId"] == "system_type_ptac"

    split_system_ids = {item["systemId"] for item in state["equipment"] if item["apartmentId"] == "apt-split"}
    assert len(split_system_ids) == 1
    split_system = next(item for item in state["hvacSystems"] if item["id"] in split_system_ids)
    assert split_system["topology"] == "split"
    assert split_system["brand"] == "Gree"

    conflict_system_ids = {item["systemId"] for item in state["equipment"] if item["apartmentId"] == "apt-conflict"}
    assert len(conflict_system_ids) == 1
    conflict_system = next(item for item in state["hvacSystems"] if item["id"] in conflict_system_ids)
    assert conflict_system["brandConflict"] is True
    assert conflict_system["brand"] == "A confirmer"
    assert {item["brand"] for item in state["equipment"] if item["apartmentId"] == "apt-conflict"} == {"Carrier", "Lennox"}

    field = state["formTemplates"][0]["fields"][0]
    assert field["unitScopes"] == ["exterieure"]
    assert field["systemTypeIds"] == []

    first_result = copy.deepcopy(state)
    second_changed = migrate_operational_state(state)
    assert not second_changed
    assert state == first_result
    print("hvac_system_migration_smoke: ok")


if __name__ == "__main__":
    run()
