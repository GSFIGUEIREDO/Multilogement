from __future__ import annotations

from backend.database import USE_POSTGRES, connect, execute, row_get
from backend.repositories import PayloadTableRepository, decode_payload, stamp_payload
from backend.repositories import StateRepository as LegacyStateRepository
from backend.sync_services import rel_table, sync_data_field_options, sync_form_template_children, sync_role_permissions
from src.climaparc.settings.domain.policies import require_supported_collection
from src.climaparc.settings.domain.repositories import SettingsConflictError


PAYLOAD_REPOSITORIES = {
    "serviceTypes": PayloadTableRepository(
        "climaparc_service_types",
        [
            ("name", "name"),
            ("default_priority", "defaultPriority"),
            ("linked_intervention_type_id", "linkedInterventionTypeId"),
        ],
    ),
    "interventionTypes": PayloadTableRepository("climaparc_intervention_types", [("name", "name"), ("default_form_template_id", "defaultFormTemplateId"), ("behavior", "behavior")]),
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
    "storageLocations": PayloadTableRepository(
        "climaparc_storage_locations",
        [("client_id", "clientId"), ("building_id", "buildingId"), ("scope_type", "scopeType"), ("name", "name"), ("address", "address"), ("active", lambda item: item.get("active") is not False)],
    ),
    "hvacSystemTypes": PayloadTableRepository(
        "climaparc_hvac_system_types",
        [("name", "name"), ("topology", "topology"), ("sort_order", "sortOrder"), ("active", lambda item: item.get("active") is not False)],
    ),
}


TABLE_BY_COLLECTION = {
    "serviceTypes": "climaparc_service_types",
    "interventionTypes": "climaparc_intervention_types",
    "formTemplates": "climaparc_form_templates",
    "roleDefinitions": "climaparc_role_definitions",
    "dataFields": "climaparc_data_fields",
    "storageLocations": "climaparc_storage_locations",
    "hvacSystemTypes": "climaparc_hvac_system_types",
}


def load_collection(connection, collection_key: str) -> list[dict]:
    require_supported_collection(collection_key)
    table = TABLE_BY_COLLECTION[collection_key]
    rows = execute(connection, f"select payload from {rel_table(table)} order by updated_at desc").fetchall()
    return [payload for payload in (decode_payload(row_get(row, "payload")) for row in rows) if payload]


def load_collection_for_update(connection, collection_key: str) -> list[dict]:
    require_supported_collection(collection_key)
    table = TABLE_BY_COLLECTION[collection_key]
    statement = f"select payload from {rel_table(table)} order by id"
    if USE_POSTGRES:
        statement += " for update"
    rows = execute(connection, statement).fetchall()
    return [payload for payload in (decode_payload(row_get(row, "payload")) for row in rows) if payload]


def sync_setting_children(connection, collection_key: str, item: dict) -> None:
    if collection_key == "dataFields":
        sync_data_field_options(connection, [item])
    elif collection_key == "formTemplates":
        sync_form_template_children(connection, [item])
    elif collection_key == "roleDefinitions":
        sync_role_permissions(connection, [item])


def delete_setting_children(connection, collection_key: str, item_id: str) -> None:
    if collection_key == "dataFields":
        execute(connection, f"delete from {rel_table('climaparc_data_field_options')} where data_field_id = ?", (item_id,))
    elif collection_key == "formTemplates":
        execute(connection, f"delete from {rel_table('climaparc_form_template_fields')} where template_id = ?", (item_id,))
        execute(connection, f"delete from {rel_table('climaparc_form_template_field_options')} where template_id = ?", (item_id,))
    elif collection_key == "roleDefinitions":
        execute(connection, f"delete from {rel_table('climaparc_role_permissions')} where role_id = ?", (item_id,))


class DatabaseSettingsStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            state = self.legacy_repository.get(connection, lock=False) or {}
            for collection_key in TABLE_BY_COLLECTION:
                state[collection_key] = load_collection(connection, collection_key)
            return state


class DatabaseSettingsPayloadRepository:
    def upsert(self, collection_key: str, item: dict, expected_server_updated_at: str = "") -> None:
        require_supported_collection(collection_key)
        repository = PAYLOAD_REPOSITORIES[collection_key]
        with connect() as connection:
            if not USE_POSTGRES:
                execute(connection, "begin immediate")
            statement = f"select payload from {rel_table(TABLE_BY_COLLECTION[collection_key])} where id = ?"
            if USE_POSTGRES:
                statement += " for update"
            row = execute(connection, statement, (item["id"],)).fetchone()
            current_item = decode_payload(row_get(row, "payload")) if row else None
            current_version = str((current_item or {}).get("serverUpdatedAt") or "")
            expected_version = str(expected_server_updated_at or "")
            if (current_item is None and expected_version) or (
                current_item is not None
                and current_version != expected_version
                and (current_version or expected_version)
            ):
                raise SettingsConflictError("La version du formulaire a change.")
            repository.upsert(connection, item)
            sync_setting_children(connection, collection_key, item)
            if collection_key == "formTemplates":
                selected_ids = set(item.get("associatedActivityTypeIds") or [])
                for activity_type in load_collection_for_update(connection, "interventionTypes"):
                    should_link = activity_type.get("id") in selected_ids
                    is_linked = activity_type.get("defaultFormTemplateId") == item.get("id")
                    if should_link == is_linked:
                        continue
                    activity_type["defaultFormTemplateId"] = item.get("id") if should_link else ""
                    PAYLOAD_REPOSITORIES["interventionTypes"].upsert(connection, stamp_payload(activity_type))

    def delete(self, collection_key: str, item_id: str) -> None:
        require_supported_collection(collection_key)
        table = TABLE_BY_COLLECTION[collection_key]
        with connect() as connection:
            delete_setting_children(connection, collection_key, item_id)
            execute(connection, f"delete from {rel_table(table)} where id = ?", (item_id,))
