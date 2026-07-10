from __future__ import annotations

import hashlib
import json
from typing import Any

from .database import USE_POSTGRES, connect, execute, json_db_value, now_value, row_get
from .security import sanitize_state_for_storage


def rel_table(name: str) -> str:
    return f"public.{name}" if USE_POSTGRES else name


def scalar_db_value(value: Any):
    if value is None:
        return None
    if isinstance(value, bool):
        return value if USE_POSTGRES else int(value)
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def int_db_value(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def stable_child_id(prefix: str, *parts: Any) -> str:
    raw = "|".join(str(part or "") for part in parts)
    return f"{prefix}-{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:16]}"


def normalized_option(option: Any, index: int) -> dict[str, Any]:
    if isinstance(option, dict):
        label = str(option.get("label") or option.get("value") or option.get("id") or "").strip()
        value = str(option.get("value") or label).strip()
        option_id = str(option.get("id") or stable_child_id("opt", value or label, index))
        return {
            "id": option_id,
            "label": label,
            "value": value,
            "active": option.get("active") is not False,
            "isDefault": bool(option.get("isDefault") or option.get("default")),
            "goTo": option.get("goTo") or option.get("branchTo") or "",
        }
    label = str(option or "").strip()
    return {
        "id": stable_child_id("opt", label, index),
        "label": label,
        "value": label,
        "active": True,
        "isDefault": False,
        "goTo": "",
    }


def response_values(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item not in (None, "")]
    if value in (None, ""):
        return []
    return [str(value)]


RELATIONAL_SYNC_SPECS = {
    "users": {
        "table": "climaparc_user_profiles",
        "columns": [
            ("name", "name"),
            ("email", "email"),
            ("role", "role"),
            ("client_id", "clientId"),
            ("client_access_level", "clientAccessLevel"),
        ],
    },
    "clients": {"table": "climaparc_clients", "columns": [("name", "name"), ("contact", "contact"), ("email", "email"), ("phone", "phone")]},
    "buildings": {
        "table": "climaparc_buildings",
        "columns": [
            ("client_id", "clientId"),
            ("name", "name"),
            ("address", "address"),
            ("onsite_contact_name", "onsiteContactName"),
            ("onsite_contact_email", "onsiteContactEmail"),
            ("billing_contact_name", "billingContactName"),
            ("billing_contact_email", "billingContactEmail"),
        ],
    },
    "apartments": {"table": "climaparc_apartments", "columns": [("building_id", "buildingId"), ("number", "number"), ("occupant", "occupant")]},
    "equipment": {
        "table": "climaparc_equipment",
        "columns": [
            ("apartment_id", "apartmentId"),
            ("equipment_type", "type"),
            ("brand", "brand"),
            ("model", "model"),
            ("serial", "serial"),
            ("location", "location"),
            ("unit_kind", "unitKind"),
            ("status", "status"),
            ("install_date", "installDate"),
            ("last_service", "lastService"),
            ("next_service", "nextService"),
        ],
    },
    "tickets": {
        "table": "climaparc_tickets",
        "columns": [
            ("number", "number"),
            ("client_id", "clientId"),
            ("building_id", "buildingId"),
            ("apartment_id", "apartmentId"),
            ("equipment_id", "equipmentId"),
            ("title", "title"),
            ("priority", "priority"),
            ("status", "status"),
            ("service_type_id", "serviceTypeId"),
            ("created_at_text", "createdAt"),
            ("closed_at_text", "closedAt"),
        ],
    },
    "workOrders": {
        "table": "climaparc_work_orders",
        "columns": [
            ("number", "number"),
            ("ticket_id", "ticketId"),
            ("building_id", "buildingId"),
            ("apartment_id", "apartmentId"),
            ("equipment_id", "equipmentId"),
            ("type_id", "typeId"),
            ("status", "status"),
            ("scheduled_date", "scheduledDate"),
            ("technician_id", "technicianId"),
        ],
    },
    "interventions": {
        "table": "climaparc_interventions",
        "columns": [
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
    },
    "reminders": {
        "table": "climaparc_reminders",
        "columns": [
            ("equipment_id", "equipmentId"),
            ("title", "title"),
            ("status", "status"),
            ("frequency_value", lambda item: int_db_value(item.get("frequencyValue"))),
            ("frequency_unit", "frequencyUnit"),
            ("start_date", "startDate"),
            ("next_due_date", "nextDueDate"),
            ("last_work_order_id", "lastWorkOrderId"),
        ],
    },
    "clientDocuments": {
        "table": "climaparc_client_documents",
        "columns": [
            ("client_id", "clientId"),
            ("building_id", "buildingId"),
            ("apartment_id", "apartmentId"),
            ("equipment_id", "equipmentId"),
            ("name", "name"),
            ("document_type", "type"),
            ("file_name", "fileName"),
            ("file_type", "fileType"),
            ("file_size", lambda item: int_db_value(item.get("fileSize"))),
            ("storage_bucket", "storageBucket"),
            ("storage_path", "storagePath"),
            ("uploaded_at", "uploadedAt"),
            ("visible_to_client", lambda item: item.get("visibleToClient") is not False),
        ],
    },
    "serviceTypes": {"table": "climaparc_service_types", "columns": [("name", "name"), ("default_priority", "defaultPriority"), ("linked_intervention_type_id", "linkedInterventionTypeId")]},
    "interventionTypes": {"table": "climaparc_intervention_types", "columns": [("name", "name")]},
    "formTemplates": {"table": "climaparc_form_templates", "columns": [("name", "name")]},
    "roleDefinitions": {"table": "climaparc_role_definitions", "columns": [("name", "name")]},
    "dataFields": {"table": "climaparc_data_fields", "columns": [("name", "name"), ("field_group", "group"), ("field_type", "type")]},
    "passwordResetRequests": {
        "table": "climaparc_password_reset_requests",
        "columns": [("email", "email"), ("user_id", "userId"), ("status", "status"), ("created_at_text", "createdAt"), ("expires_at_text", "expiresAt")],
    },
}


def sync_collection_table(connection, state: dict, collection_key: str) -> None:
    spec = RELATIONAL_SYNC_SPECS.get(collection_key)
    if not spec:
        return
    items = state.get(collection_key)
    if not isinstance(items, list):
        return
    table = rel_table(spec["table"])
    column_specs = spec["columns"]
    data_columns = [column for column, _ in column_specs]
    all_columns = ["id", *data_columns, "payload", "updated_at"]
    placeholders = ", ".join("?" for _ in all_columns)
    update_clause = ", ".join(f"{column} = excluded.{column}" for column in all_columns if column != "id")
    statement = f"""
        insert into {table} ({", ".join(all_columns)})
        values ({placeholders})
        on conflict(id) do update set {update_clause}
    """
    seen_ids: set[str] = set()
    for item in items:
        if not isinstance(item, dict) or item.get("id") in (None, ""):
            continue
        item_id = str(item.get("id"))
        seen_ids.add(item_id)
        values: list[Any] = [item_id]
        for _, source in column_specs:
            raw_value = source(item) if callable(source) else item.get(source)
            values.append(scalar_db_value(raw_value))
        values.extend([json_db_value(item), now_value()])
        execute(connection, statement, tuple(values))
    existing_rows = execute(connection, f"select id from {table}").fetchall()
    for row in existing_rows:
        item_id = str(row_get(row, "id"))
        if item_id not in seen_ids:
            execute(connection, f"delete from {table} where id = ?", (item_id,))


def sync_building_contacts(connection, buildings: list[Any]) -> None:
    for building in buildings:
        if not isinstance(building, dict) or not building.get("id"):
            continue
        building_id = str(building["id"])
        execute(connection, f"delete from {rel_table('climaparc_building_contacts')} where building_id = ?", (building_id,))
        contacts = [
            ("onsite", building.get("onsiteContactName"), building.get("onsiteContactPhone"), building.get("onsiteContactPoste"), building.get("onsiteContactEmail")),
            ("billing", building.get("billingContactName"), building.get("billingContactPhone"), building.get("billingContactPoste"), building.get("billingContactEmail")),
        ]
        for role, name, phone, poste, email in contacts:
            if not any([name, phone, poste, email]):
                continue
            execute(
                connection,
                f"""
                insert into {rel_table('climaparc_building_contacts')} (
                  building_id, contact_role, name, phone, phone_poste, email, updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict(building_id, contact_role) do update set
                  name = excluded.name,
                  phone = excluded.phone,
                  phone_poste = excluded.phone_poste,
                  email = excluded.email,
                  updated_at = excluded.updated_at
                """,
                (building_id, role, name, phone, poste, email, now_value()),
            )


def sync_work_order_technicians(connection, work_orders: list[Any]) -> None:
    for order in work_orders:
        if not isinstance(order, dict) or not order.get("id"):
            continue
        order_id = str(order["id"])
        execute(connection, f"delete from {rel_table('climaparc_work_order_technicians')} where work_order_id = ?", (order_id,))
        technician_ids: list[str] = []
        if order.get("technicianId"):
            technician_ids.append(str(order["technicianId"]))
        for user_id in order.get("assignedTechnicianIds", []) if isinstance(order.get("assignedTechnicianIds"), list) else []:
            if user_id and str(user_id) not in technician_ids:
                technician_ids.append(str(user_id))
        for user_id in technician_ids:
            execute(
                connection,
                f"""
                insert into {rel_table('climaparc_work_order_technicians')} (
                  work_order_id, user_id, is_primary, updated_at
                )
                values (?, ?, ?, ?)
                on conflict(work_order_id, user_id) do update set
                  is_primary = excluded.is_primary,
                  updated_at = excluded.updated_at
                """,
                (order_id, user_id, user_id == str(order.get("technicianId") or ""), now_value()),
            )


def sync_data_field_options(connection, data_fields: list[Any]) -> None:
    for field in data_fields:
        if not isinstance(field, dict) or not field.get("id"):
            continue
        field_id = str(field["id"])
        execute(connection, f"delete from {rel_table('climaparc_data_field_options')} where data_field_id = ?", (field_id,))
        for index, raw_option in enumerate(field.get("options", []) if isinstance(field.get("options"), list) else []):
            option = normalized_option(raw_option, index)
            if not option["label"]:
                continue
            execute(
                connection,
                f"""
                insert into {rel_table('climaparc_data_field_options')} (
                  data_field_id, option_id, label, value, sort_order, active, updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict(data_field_id, option_id) do update set
                  label = excluded.label,
                  value = excluded.value,
                  sort_order = excluded.sort_order,
                  active = excluded.active,
                  updated_at = excluded.updated_at
                """,
                (field_id, option["id"], option["label"], option["value"], index, option["active"], now_value()),
            )


def sync_form_template_children(connection, templates: list[Any]) -> None:
    for template in templates:
        if not isinstance(template, dict) or not template.get("id"):
            continue
        template_id = str(template["id"])
        execute(connection, f"delete from {rel_table('climaparc_form_template_fields')} where template_id = ?", (template_id,))
        execute(connection, f"delete from {rel_table('climaparc_form_template_field_options')} where template_id = ?", (template_id,))
        current_section_id = ""
        for index, field in enumerate(template.get("fields", []) if isinstance(template.get("fields"), list) else []):
            if not isinstance(field, dict):
                continue
            field_id = str(field.get("id") or stable_child_id("field", template_id, index))
            if field.get("type") == "section":
                current_section_id = field_id
            show_when = field.get("showWhen") if isinstance(field.get("showWhen"), dict) else {}
            default_value = field.get("defaultValue")
            execute(
                connection,
                f"""
                insert into {rel_table('climaparc_form_template_fields')} (
                  template_id, field_id, section_id, label, field_type, is_required, layout,
                  unit_scope, data_field_id, show_when_field_id, show_when_value, default_value,
                  sort_order, updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(template_id, field_id) do update set
                  section_id = excluded.section_id,
                  label = excluded.label,
                  field_type = excluded.field_type,
                  is_required = excluded.is_required,
                  layout = excluded.layout,
                  unit_scope = excluded.unit_scope,
                  data_field_id = excluded.data_field_id,
                  show_when_field_id = excluded.show_when_field_id,
                  show_when_value = excluded.show_when_value,
                  default_value = excluded.default_value,
                  sort_order = excluded.sort_order,
                  updated_at = excluded.updated_at
                """,
                (
                    template_id,
                    field_id,
                    "" if field.get("type") == "section" else current_section_id,
                    field.get("label", ""),
                    field.get("type", "text"),
                    bool(field.get("required")),
                    field.get("layout", "full"),
                    field.get("unitScope", "all"),
                    field.get("dataFieldId", ""),
                    show_when.get("fieldId", ""),
                    show_when.get("value", ""),
                    json.dumps(default_value, ensure_ascii=False) if isinstance(default_value, (dict, list)) else scalar_db_value(default_value),
                    index,
                    now_value(),
                ),
            )
            for option_index, raw_option in enumerate(field.get("options", []) if isinstance(field.get("options"), list) else []):
                option = normalized_option(raw_option, option_index)
                if not option["label"]:
                    continue
                branch_rules = field.get("branchRules") if isinstance(field.get("branchRules"), dict) else {}
                branch_target = str(branch_rules.get(option["value"]) or "") if option["value"] in branch_rules else ""
                execute(
                    connection,
                    f"""
                    insert into {rel_table('climaparc_form_template_field_options')} (
                      template_id, field_id, option_id, label, value, go_to, is_default,
                      sort_order, updated_at
                    )
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    on conflict(template_id, field_id, option_id) do update set
                      label = excluded.label,
                      value = excluded.value,
                      go_to = excluded.go_to,
                      is_default = excluded.is_default,
                      sort_order = excluded.sort_order,
                      updated_at = excluded.updated_at
                    """,
                    (template_id, field_id, option["id"], option["label"], option["value"], option["goTo"] or branch_target, option["isDefault"], option_index, now_value()),
                )


def sync_role_permissions(connection, roles: list[Any]) -> None:
    for role in roles:
        if not isinstance(role, dict) or not role.get("id"):
            continue
        role_id = str(role["id"])
        execute(connection, f"delete from {rel_table('climaparc_role_permissions')} where role_id = ?", (role_id,))
        rights = role.get("rights", [])
        if not isinstance(rights, list):
            rights = []
        for permission in rights:
            if permission:
                execute(
                    connection,
                    f"""
                    insert into {rel_table('climaparc_role_permissions')} (
                      role_id, permission, enabled, updated_at
                    )
                    values (?, ?, ?, ?)
                    on conflict(role_id, permission) do update set
                      enabled = excluded.enabled,
                      updated_at = excluded.updated_at
                    """,
                    (role_id, str(permission), True, now_value()),
                )


def sync_intervention_children(connection, interventions: list[Any]) -> None:
    for intervention in interventions:
        if not isinstance(intervention, dict) or not intervention.get("id"):
            continue
        intervention_id = str(intervention["id"])
        execute(connection, f"delete from {rel_table('climaparc_intervention_responses')} where intervention_id = ?", (intervention_id,))
        execute(connection, f"delete from {rel_table('climaparc_intervention_response_values')} where intervention_id = ?", (intervention_id,))
        execute(connection, f"delete from {rel_table('climaparc_intervention_attachments')} where intervention_id = ?", (intervention_id,))
        execute(connection, f"delete from {rel_table('climaparc_recommendation_messages')} where intervention_id = ?", (intervention_id,))
        responses = intervention.get("formResponses") if isinstance(intervention.get("formResponses"), dict) else {}
        for field_key, raw_value in responses.items():
            field_key_text = str(field_key)
            values = response_values(raw_value)
            execute(
                connection,
                f"""
                insert into {rel_table('climaparc_intervention_responses')} (
                  intervention_id, field_key, field_label, response_text, updated_at
                )
                values (?, ?, ?, ?, ?)
                on conflict(intervention_id, field_key) do update set
                  field_label = excluded.field_label,
                  response_text = excluded.response_text,
                  updated_at = excluded.updated_at
                """,
                (intervention_id, field_key_text, field_key_text, ", ".join(values), now_value()),
            )
            for index, value in enumerate(values):
                execute(
                    connection,
                    f"""
                    insert into {rel_table('climaparc_intervention_response_values')} (
                      intervention_id, field_key, value_index, value_text, updated_at
                    )
                    values (?, ?, ?, ?, ?)
                    on conflict(intervention_id, field_key, value_index) do update set
                      value_text = excluded.value_text,
                      updated_at = excluded.updated_at
                    """,
                    (intervention_id, field_key_text, index, value, now_value()),
                )
        for file in intervention.get("attachments", []) if isinstance(intervention.get("attachments"), list) else []:
            if not isinstance(file, dict):
                continue
            file_id = str(file.get("id") or stable_child_id("file", intervention_id, file.get("name"), file.get("uploadedAt")))
            execute(
                connection,
                f"""
                insert into {rel_table('climaparc_intervention_attachments')} (
                  id, intervention_id, equipment_id, work_order_id, name, file_name,
                  file_type, file_size, storage_bucket, storage_path, uploaded_at, uploaded_by, updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(id) do update set
                  intervention_id = excluded.intervention_id,
                  equipment_id = excluded.equipment_id,
                  work_order_id = excluded.work_order_id,
                  name = excluded.name,
                  file_name = excluded.file_name,
                  file_type = excluded.file_type,
                  file_size = excluded.file_size,
                  storage_bucket = excluded.storage_bucket,
                  storage_path = excluded.storage_path,
                  uploaded_at = excluded.uploaded_at,
                  uploaded_by = excluded.uploaded_by,
                  updated_at = excluded.updated_at
                """,
                (
                    file_id,
                    intervention_id,
                    intervention.get("equipmentId", ""),
                    intervention.get("workOrderId", ""),
                    file.get("name", ""),
                    file.get("fileName", ""),
                    file.get("fileType", ""),
                    int_db_value(file.get("fileSize")),
                    file.get("storageBucket", ""),
                    file.get("storagePath", ""),
                    file.get("uploadedAt", ""),
                    file.get("uploadedBy", ""),
                    now_value(),
                ),
            )
        recommendation = intervention.get("recommendation") if isinstance(intervention.get("recommendation"), dict) else {}
        for index, message in enumerate(recommendation.get("messages", []) if isinstance(recommendation.get("messages"), list) else []):
            if not isinstance(message, dict) or not message.get("text"):
                continue
            message_id = str(message.get("id") or stable_child_id("msg", intervention_id, index, message.get("createdAt")))
            execute(
                connection,
                f"""
                insert into {rel_table('climaparc_recommendation_messages')} (
                  id, intervention_id, author_id, author_role, author_name, message_text,
                  created_at_text, updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(id) do update set
                  intervention_id = excluded.intervention_id,
                  author_id = excluded.author_id,
                  author_role = excluded.author_role,
                  author_name = excluded.author_name,
                  message_text = excluded.message_text,
                  created_at_text = excluded.created_at_text,
                  updated_at = excluded.updated_at
                """,
                (message_id, intervention_id, message.get("authorId", ""), message.get("authorRole", ""), message.get("authorName", ""), message.get("text", ""), message.get("createdAt", ""), now_value()),
            )


def sync_equipment_attachments(connection, equipment_items: list[Any]) -> None:
    for equipment in equipment_items:
        if not isinstance(equipment, dict) or not equipment.get("id"):
            continue
        equipment_id = str(equipment["id"])
        execute(connection, f"delete from {rel_table('climaparc_equipment_attachments')} where equipment_id = ?", (equipment_id,))
        for file in equipment.get("attachments", []) if isinstance(equipment.get("attachments"), list) else []:
            if not isinstance(file, dict):
                continue
            file_id = str(file.get("id") or stable_child_id("file", equipment_id, file.get("name"), file.get("uploadedAt")))
            execute(
                connection,
                f"""
                insert into {rel_table('climaparc_equipment_attachments')} (
                  id, equipment_id, source_intervention_id, source_work_order_id, name,
                  file_name, file_type, file_size, storage_bucket, storage_path, uploaded_at, uploaded_by, updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(id) do update set
                  equipment_id = excluded.equipment_id,
                  source_intervention_id = excluded.source_intervention_id,
                  source_work_order_id = excluded.source_work_order_id,
                  name = excluded.name,
                  file_name = excluded.file_name,
                  file_type = excluded.file_type,
                  file_size = excluded.file_size,
                  storage_bucket = excluded.storage_bucket,
                  storage_path = excluded.storage_path,
                  uploaded_at = excluded.uploaded_at,
                  uploaded_by = excluded.uploaded_by,
                  updated_at = excluded.updated_at
                """,
                (
                    file_id,
                    equipment_id,
                    file.get("sourceInterventionId", ""),
                    file.get("sourceWorkOrderId", ""),
                    file.get("name", ""),
                    file.get("fileName", ""),
                    file.get("fileType", ""),
                    int_db_value(file.get("fileSize")),
                    file.get("storageBucket", ""),
                    file.get("storagePath", ""),
                    file.get("uploadedAt", ""),
                    file.get("uploadedBy", ""),
                    now_value(),
                ),
            )


def sync_normalized_children(connection, state: dict, collection_key: str) -> None:
    items = state.get(collection_key)
    if not isinstance(items, list):
        return
    if collection_key == "buildings":
        sync_building_contacts(connection, items)
    elif collection_key == "workOrders":
        sync_work_order_technicians(connection, items)
    elif collection_key == "dataFields":
        sync_data_field_options(connection, items)
    elif collection_key == "formTemplates":
        sync_form_template_children(connection, items)
    elif collection_key == "roleDefinitions":
        sync_role_permissions(connection, items)
    elif collection_key == "interventions":
        sync_intervention_children(connection, items)
    elif collection_key == "equipment":
        sync_equipment_attachments(connection, items)


def sync_relational_tables(connection, state: dict, collection_keys: set[str] | None = None) -> None:
    keys = set(RELATIONAL_SYNC_SPECS.keys()) if collection_keys is None else collection_keys
    for collection_key in keys:
        sync_collection_table(connection, state, collection_key)
        sync_normalized_children(connection, state, collection_key)


def sync_relational_tables_safely(state: dict, collection_keys: set[str] | None = None) -> None:
    try:
        with connect() as connection:
            sync_relational_tables(connection, sanitize_state_for_storage(state), collection_keys)
    except Exception as error:
        print(f"Relational table sync skipped: {error}")
