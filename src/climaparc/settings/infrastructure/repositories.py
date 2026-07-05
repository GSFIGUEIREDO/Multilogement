from __future__ import annotations

from backend.database import connect, execute
from backend.repositories import PayloadTableRepository
from backend.repositories import StateRepository as LegacyStateRepository
from src.climaparc.settings.domain.policies import require_supported_collection


PAYLOAD_REPOSITORIES = {
    "serviceTypes": PayloadTableRepository(
        "climaparc_service_types",
        [
            ("name", "name"),
            ("default_priority", "defaultPriority"),
            ("linked_intervention_type_id", "linkedInterventionTypeId"),
        ],
    ),
    "interventionTypes": PayloadTableRepository("climaparc_intervention_types", [("name", "name")]),
    "formTemplates": PayloadTableRepository("climaparc_form_templates", [("name", "name")]),
    "roleDefinitions": PayloadTableRepository("climaparc_role_definitions", [("name", "name")]),
    "dataFields": PayloadTableRepository(
        "climaparc_data_fields",
        [
            ("name", "name"),
            ("field_group", "group"),
            ("field_type", "type"),
        ],
    ),
}


TABLE_BY_COLLECTION = {
    "serviceTypes": "climaparc_service_types",
    "interventionTypes": "climaparc_intervention_types",
    "formTemplates": "climaparc_form_templates",
    "roleDefinitions": "climaparc_role_definitions",
    "dataFields": "climaparc_data_fields",
}


class DatabaseSettingsStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            return self.legacy_repository.get(connection, lock=lock)

    def save(self, state: dict) -> None:
        with connect() as connection:
            self.legacy_repository.save(connection, state)


class DatabaseSettingsPayloadRepository:
    def upsert(self, collection_key: str, item: dict) -> None:
        require_supported_collection(collection_key)
        repository = PAYLOAD_REPOSITORIES[collection_key]
        with connect() as connection:
            repository.upsert(connection, item)

    def delete(self, collection_key: str, item_id: str) -> None:
        require_supported_collection(collection_key)
        table = TABLE_BY_COLLECTION[collection_key]
        with connect() as connection:
            execute(connection, f"delete from {table} where id = ?", (item_id,))

