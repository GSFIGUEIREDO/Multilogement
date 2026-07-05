from __future__ import annotations

from backend.database import connect, execute
from backend.file_storage import StorageBackend, storage_backend
from backend.repositories import EquipmentRepository, PayloadTableRepository
from backend.repositories import StateRepository as LegacyStateRepository


class DatabaseDocumentStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            return self.legacy_repository.get(connection, lock=lock)

    def save(self, state: dict) -> None:
        with connect() as connection:
            self.legacy_repository.save(connection, state)


class DatabaseDocumentPayloadRepository:
    def __init__(self):
        self.client_documents = PayloadTableRepository(
            "climaparc_client_documents",
            [
                ("client_id", "clientId"),
                ("building_id", "buildingId"),
                ("apartment_id", "apartmentId"),
                ("equipment_id", "equipmentId"),
                ("name", "name"),
                ("document_type", "type"),
                ("file_name", "fileName"),
                ("file_type", "fileType"),
                ("file_size", lambda item: item.get("fileSize")),
                ("storage_bucket", "storageBucket"),
                ("storage_path", "storagePath"),
                ("uploaded_at", "uploadedAt"),
                ("visible_to_client", lambda item: item.get("visibleToClient") is not False),
            ],
        )
        self.equipment = EquipmentRepository()
        self.interventions = PayloadTableRepository(
            "climaparc_interventions",
            [
                ("work_order_id", "workOrderId"),
                ("apartment_id", "apartmentId"),
                ("equipment_id", "equipmentId"),
                ("technician_id", "technicianId"),
                ("form_template_id", "formTemplateId"),
                ("status", "status"),
                ("activity_status", "activityStatus"),
                ("machine_status", "machineStatus"),
                ("date_text", "date"),
            ],
        )

    def upsert_client_document(self, document: dict) -> None:
        with connect() as connection:
            self.client_documents.upsert(connection, document)

    def upsert_equipment(self, equipment: dict) -> None:
        with connect() as connection:
            self.equipment.upsert(connection, equipment)

    def upsert_intervention(self, intervention: dict) -> None:
        with connect() as connection:
            self.interventions.upsert(connection, intervention)

    def delete_file(self, file_id: str) -> None:
        with connect() as connection:
            execute(connection, "delete from climaparc_client_documents where id = ?", (file_id,))
            execute(connection, "delete from climaparc_equipment_attachments where id = ?", (file_id,))
            execute(connection, "delete from climaparc_intervention_attachments where id = ?", (file_id,))


def get_storage_gateway() -> StorageBackend:
    return storage_backend()
