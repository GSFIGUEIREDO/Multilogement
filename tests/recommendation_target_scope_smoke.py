from __future__ import annotations

import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tests"))

import field_operations_fastapi_smoke as fixture  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def run() -> None:
    fixture.reset_database()
    with TestClient(fixture.app) as admin:
        fixture.login(admin, "admin@test.local", "Admin12345")
        routed = admin.post(
            "/api/recommendation/route",
            json={"interventionId": "int-recommendation", "mode": "existing", "workOrderId": "wo-replace"},
        )
        assert routed.status_code == 200, routed.text
        assert routed.json()["target"]["approvalStatus"] == "pending"
        assert routed.json()["target"]["activityTypeId"] == "remplacement_unite"

    with TestClient(fixture.app) as technician:
        fixture.login(technician, "tech@test.local", "Tech12345")
        inspection = fixture.field_payload("-pending-inspection")
        inspection["intervention"]["typeId"] = "inspection"
        inspection["intervention"]["summary"] = "Inspection autorisee avant approbation"
        inspection["replacement"] = None
        inspection_saved = technician.post("/api/field-intervention", json=inspection)
        assert inspection_saved.status_code == 200, inspection_saved.text

        blocked = technician.post("/api/field-intervention", json=fixture.field_payload("-pending-replacement"))
        assert blocked.status_code == 409, blocked.text
        assert all(item.get("id") != "eq-new-pending-replacement" for item in fixture.current_state()["equipment"])

    with TestClient(fixture.app) as client:
        fixture.login(client, "client@test.local", "Client12345")
        approved = client.post(
            "/api/recommendation/client-response",
            json={"interventionId": "int-recommendation", "recommendation": {"status": "approuvee"}},
        )
        assert approved.status_code == 200, approved.text
        target = next(item for item in fixture.current_state()["workOrderTargets"] if item.get("sourceRecommendationId") == "int-recommendation")
        assert target["approvalStatus"] == "approved"

    with TestClient(fixture.app) as technician:
        fixture.login(technician, "tech@test.local", "Tech12345")
        released = technician.post("/api/field-intervention", json=fixture.field_payload("-approved-replacement"))
        assert released.status_code == 200, released.text

    shutil.rmtree(fixture.TMP_ROOT, ignore_errors=True)
    print("recommendation_target_scope_smoke: ok")


if __name__ == "__main__":
    run()
