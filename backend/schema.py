from __future__ import annotations

import json
from typing import Any

from .database import USE_POSTGRES, connect, execute, json_db_value, now_value, row_get
from .security import sanitize_state_for_storage


def rel_table(name: str) -> str:
    return f"public.{name}" if USE_POSTGRES else name


def column_exists(connection, table: str, column: str) -> bool:
    if USE_POSTGRES:
        row = execute(
            connection,
            """
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = ?
              and column_name = ?
            limit 1
            """,
            (table, column),
        ).fetchone()
        return bool(row)
    rows = connection.execute(f"pragma table_info({table})").fetchall()
    return any(row_get(row, "name") == column for row in rows)


def ensure_table_columns(connection, table: str, columns: list[tuple[str, str]]) -> None:
    for column, column_type in columns:
        if not column_exists(connection, table, column):
            execute(connection, f"alter table {rel_table(table)} add column {column} {column_type}")


def sql_type(kind: str) -> str:
    if kind == "payload":
        return "jsonb not null default '{}'::jsonb" if USE_POSTGRES else "text not null default '{}'"
    if kind == "payload_nullable":
        return "jsonb" if USE_POSTGRES else "text"
    if kind == "updated":
        return "timestamptz not null default now()" if USE_POSTGRES else "integer not null default 0"
    if kind == "updated_nullable":
        return "timestamptz" if USE_POSTGRES else "integer"
    if kind == "bool":
        return "boolean" if USE_POSTGRES else "integer"
    return kind


def create_table(connection, table: str, columns: list[str]) -> None:
    connection.execute(f"create table if not exists {rel_table(table)} ({', '.join(columns)})")


def create_payload_table(connection, table: str, columns: list[tuple[str, str]]) -> None:
    create_table(
        connection,
        table,
        [
            "id text primary key",
            *[f"{name} {sql_type(kind)}" for name, kind in columns],
            f"payload {sql_type('payload')}",
            f"updated_at {sql_type('updated')}",
        ],
    )
    ensure_table_columns(
        connection,
        table,
        [*[(name, sql_type(kind)) for name, kind in columns], ("payload", sql_type("payload_nullable")), ("updated_at", sql_type("updated_nullable"))],
    )


PAYLOAD_TABLES: dict[str, list[tuple[str, str]]] = {
    "climaparc_user_profiles": [
        ("name", "text"),
        ("email", "text"),
        ("role", "text"),
        ("client_id", "text"),
        ("client_access_level", "text"),
    ],
    "climaparc_clients": [("name", "text"), ("contact", "text"), ("email", "text"), ("phone", "text")],
    "climaparc_buildings": [
        ("client_id", "text"),
        ("name", "text"),
        ("address", "text"),
        ("onsite_contact_name", "text"),
        ("onsite_contact_email", "text"),
        ("billing_contact_name", "text"),
        ("billing_contact_email", "text"),
    ],
    "climaparc_apartments": [("building_id", "text"), ("number", "text"), ("occupant", "text")],
    "climaparc_equipment": [
        ("apartment_id", "text"),
        ("client_id", "text"),
        ("equipment_type", "text"),
        ("brand", "text"),
        ("model", "text"),
        ("serial", "text"),
        ("location", "text"),
        ("unit_kind", "text"),
        ("status", "text"),
        ("install_date", "text"),
        ("last_service", "text"),
        ("next_service", "text"),
        ("manufacture_age_info", "text"),
        ("manufacture_year", "integer"),
        ("estimated_age_years", "integer"),
        ("condition_status", "text"),
        ("lifecycle_status", "text"),
        ("storage_location_id", "text"),
        ("home_building_id", "text"),
        ("system_id", "text"),
        ("disposed_at_text", "text"),
    ],
    "climaparc_tickets": [
        ("number", "text"),
        ("client_id", "text"),
        ("building_id", "text"),
        ("apartment_id", "text"),
        ("equipment_id", "text"),
        ("title", "text"),
        ("priority", "text"),
        ("status", "text"),
        ("service_type_id", "text"),
        ("created_at_text", "text"),
        ("closed_at_text", "text"),
    ],
    "climaparc_work_orders": [
        ("number", "text"),
        ("ticket_id", "text"),
        ("building_id", "text"),
        ("apartment_id", "text"),
        ("equipment_id", "text"),
        ("type_id", "text"),
        ("default_activity_type_id", "text"),
        ("object_text", "text"),
        ("status", "text"),
        ("scheduled_date", "text"),
        ("technician_id", "text"),
    ],
    "climaparc_interventions": [
        ("work_order_id", "text"),
        ("apartment_id", "text"),
        ("equipment_id", "text"),
        ("technician_id", "text"),
        ("form_template_id", "text"),
        ("type_id", "text"),
        ("target_id", "text"),
        ("status", "text"),
        ("activity_status", "text"),
        ("machine_status", "text"),
        ("date_text", "text"),
    ],
    "climaparc_reminders": [
        ("equipment_id", "text"),
        ("title", "text"),
        ("status", "text"),
        ("frequency_value", "integer"),
        ("frequency_unit", "text"),
        ("start_date", "text"),
        ("next_due_date", "text"),
        ("last_work_order_id", "text"),
    ],
    "climaparc_client_documents": [
        ("client_id", "text"),
        ("building_id", "text"),
        ("apartment_id", "text"),
        ("equipment_id", "text"),
        ("name", "text"),
        ("document_type", "text"),
        ("file_name", "text"),
        ("file_type", "text"),
        ("file_size", "integer"),
        ("storage_bucket", "text"),
        ("storage_path", "text"),
        ("uploaded_at", "text"),
        ("visible_to_client", "bool"),
    ],
    "climaparc_service_types": [("name", "text"), ("default_priority", "text"), ("linked_intervention_type_id", "text")],
    "climaparc_intervention_types": [("name", "text"), ("default_form_template_id", "text"), ("behavior", "text")],
    "climaparc_form_templates": [("name", "text")],
    "climaparc_role_definitions": [("name", "text")],
    "climaparc_data_fields": [("name", "text"), ("field_group", "text"), ("field_type", "text")],
    "climaparc_password_reset_requests": [
        ("email", "text"),
        ("user_id", "text"),
        ("status", "text"),
        ("created_at_text", "text"),
        ("expires_at_text", "text"),
    ],
    "climaparc_storage_locations": [
        ("client_id", "text"),
        ("building_id", "text"),
        ("scope_type", "text"),
        ("name", "text"),
        ("address", "text"),
        ("active", "bool"),
    ],
    "climaparc_equipment_movements": [
        ("equipment_id", "text"),
        ("movement_type", "text"),
        ("from_apartment_id", "text"),
        ("to_apartment_id", "text"),
        ("from_storage_location_id", "text"),
        ("to_storage_location_id", "text"),
        ("work_order_id", "text"),
        ("intervention_id", "text"),
        ("performed_by", "text"),
        ("performed_at_text", "text"),
        ("from_home_building_id", "text"),
        ("to_home_building_id", "text"),
        ("from_system_id", "text"),
        ("to_system_id", "text"),
    ],
    "climaparc_equipment_replacements": [
        ("old_equipment_id", "text"),
        ("new_equipment_id", "text"),
        ("work_order_id", "text"),
        ("intervention_id", "text"),
        ("completed_at_text", "text"),
    ],
    "climaparc_hvac_systems": [
        ("client_id", "text"),
        ("building_id", "text"),
        ("apartment_id", "text"),
        ("system_type_id", "text"),
        ("topology", "text"),
        ("brand", "text"),
        ("name", "text"),
        ("sort_order", "integer"),
        ("active", "bool"),
    ],
    "climaparc_hvac_system_types": [
        ("name", "text"),
        ("topology", "text"),
        ("sort_order", "integer"),
        ("active", "bool"),
    ],
    "climaparc_work_order_targets": [
        ("work_order_id", "text"),
        ("building_id", "text"),
        ("apartment_id", "text"),
        ("equipment_id", "text"),
        ("activity_type_id", "text"),
        ("status", "text"),
        ("approval_status", "text"),
        ("source_recommendation_id", "text"),
        ("completed_at_text", "text"),
    ],
    "climaparc_work_order_completion_audits": [
        ("work_order_id", "text"),
        ("apartment_id", "text"),
        ("action", "text"),
        ("reason", "text"),
        ("performed_by", "text"),
        ("performed_at_text", "text"),
    ],
}


CHILD_TABLES: dict[str, list[str]] = {
    "climaparc_building_contacts": [
        "building_id text not null",
        "contact_role text not null",
        "name text",
        "phone text",
        "phone_poste text",
        "email text",
        f"updated_at {sql_type('updated')}",
        "primary key (building_id, contact_role)",
    ],
    "climaparc_work_order_technicians": [
        "work_order_id text not null",
        "user_id text not null",
        f"is_primary {sql_type('bool')}",
        f"updated_at {sql_type('updated')}",
        "primary key (work_order_id, user_id)",
    ],
    "climaparc_data_field_options": [
        "data_field_id text not null",
        "option_id text not null",
        "label text not null default ''",
        "value text not null default ''",
        "sort_order integer not null default 0",
        f"active {sql_type('bool')}",
        "behavior text",
        "color text",
        f"updated_at {sql_type('updated')}",
        "primary key (data_field_id, option_id)",
    ],
    "climaparc_form_template_fields": [
        "template_id text not null",
        "field_id text not null",
        "section_id text",
        "label text not null default ''",
        "field_type text not null default 'text'",
        f"is_required {sql_type('bool')}",
        "layout text",
        "unit_scope text",
        "unit_scopes text",
        "system_type_ids text",
        "data_field_id text",
        "show_when_field_id text",
        "show_when_value text",
        "default_value text",
        "sort_order integer not null default 0",
        f"updated_at {sql_type('updated')}",
        "primary key (template_id, field_id)",
    ],
    "climaparc_form_template_field_options": [
        "template_id text not null",
        "field_id text not null",
        "option_id text not null",
        "label text not null default ''",
        "value text not null default ''",
        "go_to text",
        f"is_default {sql_type('bool')}",
        "sort_order integer not null default 0",
        f"updated_at {sql_type('updated')}",
        "primary key (template_id, field_id, option_id)",
    ],
    "climaparc_role_permissions": [
        "role_id text not null",
        "permission text not null",
        f"enabled {sql_type('bool')}",
        f"updated_at {sql_type('updated')}",
        "primary key (role_id, permission)",
    ],
    "climaparc_intervention_responses": [
        "intervention_id text not null",
        "field_key text not null",
        "field_label text",
        "response_text text",
        f"updated_at {sql_type('updated')}",
        "primary key (intervention_id, field_key)",
    ],
    "climaparc_intervention_response_values": [
        "intervention_id text not null",
        "field_key text not null",
        "value_index integer not null",
        "value_text text",
        f"updated_at {sql_type('updated')}",
        "primary key (intervention_id, field_key, value_index)",
    ],
    "climaparc_equipment_attachments": [
        "id text primary key",
        "equipment_id text not null",
        "source_intervention_id text",
        "source_work_order_id text",
        "name text",
        "file_name text",
        "file_type text",
        "file_size integer",
        "storage_bucket text",
        "storage_path text",
        "uploaded_at text",
        "uploaded_by text",
        f"updated_at {sql_type('updated')}",
    ],
    "climaparc_intervention_attachments": [
        "id text primary key",
        "intervention_id text not null",
        "equipment_id text",
        "work_order_id text",
        "name text",
        "file_name text",
        "file_type text",
        "file_size integer",
        "storage_bucket text",
        "storage_path text",
        "uploaded_at text",
        "uploaded_by text",
        f"updated_at {sql_type('updated')}",
    ],
    "climaparc_recommendation_messages": [
        "id text primary key",
        "intervention_id text not null",
        "author_id text",
        "author_role text",
        "author_name text",
        "message_text text",
        "created_at_text text",
        f"updated_at {sql_type('updated')}",
    ],
}


CHILD_TABLE_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "climaparc_data_field_options": [("behavior", "text"), ("color", "text"), ("updated_at", sql_type("updated_nullable"))],
    "climaparc_equipment_attachments": [("storage_bucket", "text"), ("storage_path", "text"), ("updated_at", sql_type("updated_nullable"))],
    "climaparc_intervention_attachments": [("storage_bucket", "text"), ("storage_path", "text"), ("updated_at", sql_type("updated_nullable"))],
    "climaparc_form_template_fields": [("unit_scopes", "text"), ("system_type_ids", "text")],
}


INDEXES = [
    ("climaparc_user_profiles_client_id_idx", "climaparc_user_profiles", "client_id"),
    ("climaparc_user_profiles_email_idx", "climaparc_user_profiles", "email"),
    ("climaparc_buildings_client_id_idx", "climaparc_buildings", "client_id"),
    ("climaparc_apartments_building_id_idx", "climaparc_apartments", "building_id"),
    ("climaparc_equipment_apartment_id_idx", "climaparc_equipment", "apartment_id"),
    ("climaparc_equipment_status_idx", "climaparc_equipment", "status"),
    ("climaparc_equipment_serial_idx", "climaparc_equipment", "serial"),
    ("climaparc_equipment_home_building_idx", "climaparc_equipment", "home_building_id"),
    ("climaparc_equipment_system_idx", "climaparc_equipment", "system_id"),
    ("climaparc_tickets_number_idx", "climaparc_tickets", "number"),
    ("climaparc_tickets_client_id_idx", "climaparc_tickets", "client_id"),
    ("climaparc_tickets_building_id_idx", "climaparc_tickets", "building_id"),
    ("climaparc_tickets_equipment_id_idx", "climaparc_tickets", "equipment_id"),
    ("climaparc_tickets_status_idx", "climaparc_tickets", "status"),
    ("climaparc_work_orders_number_idx", "climaparc_work_orders", "number"),
    ("climaparc_work_orders_ticket_id_idx", "climaparc_work_orders", "ticket_id"),
    ("climaparc_work_orders_building_id_idx", "climaparc_work_orders", "building_id"),
    ("climaparc_work_orders_equipment_id_idx", "climaparc_work_orders", "equipment_id"),
    ("climaparc_work_orders_status_idx", "climaparc_work_orders", "status"),
    ("climaparc_work_orders_scheduled_date_idx", "climaparc_work_orders", "scheduled_date"),
    ("climaparc_interventions_work_order_id_idx", "climaparc_interventions", "work_order_id"),
    ("climaparc_interventions_equipment_id_idx", "climaparc_interventions", "equipment_id"),
    ("climaparc_reminders_equipment_id_idx", "climaparc_reminders", "equipment_id"),
    ("climaparc_reminders_status_idx", "climaparc_reminders", "status"),
    ("climaparc_reminders_next_due_date_idx", "climaparc_reminders", "next_due_date"),
    ("climaparc_client_documents_client_id_idx", "climaparc_client_documents", "client_id"),
    ("climaparc_client_documents_building_id_idx", "climaparc_client_documents", "building_id"),
    ("climaparc_client_documents_equipment_id_idx", "climaparc_client_documents", "equipment_id"),
    ("climaparc_building_contacts_role_idx", "climaparc_building_contacts", "contact_role"),
    ("climaparc_work_order_technicians_user_id_idx", "climaparc_work_order_technicians", "user_id"),
    ("climaparc_data_field_options_label_idx", "climaparc_data_field_options", "label"),
    ("climaparc_form_template_fields_template_id_idx", "climaparc_form_template_fields", "template_id"),
    ("climaparc_form_template_field_options_field_id_idx", "climaparc_form_template_field_options", "field_id"),
    ("climaparc_role_permissions_permission_idx", "climaparc_role_permissions", "permission"),
    ("climaparc_intervention_responses_field_key_idx", "climaparc_intervention_responses", "field_key"),
    ("climaparc_equipment_attachments_equipment_id_idx", "climaparc_equipment_attachments", "equipment_id"),
    ("climaparc_intervention_attachments_intervention_id_idx", "climaparc_intervention_attachments", "intervention_id"),
    ("climaparc_recommendation_messages_intervention_id_idx", "climaparc_recommendation_messages", "intervention_id"),
    ("climaparc_storage_locations_client_id_idx", "climaparc_storage_locations", "client_id"),
    ("climaparc_storage_locations_building_id_idx", "climaparc_storage_locations", "building_id"),
    ("climaparc_equipment_movements_equipment_id_idx", "climaparc_equipment_movements", "equipment_id"),
    ("climaparc_equipment_movements_work_order_id_idx", "climaparc_equipment_movements", "work_order_id"),
    ("climaparc_equipment_replacements_old_equipment_id_idx", "climaparc_equipment_replacements", "old_equipment_id"),
    ("climaparc_equipment_replacements_new_equipment_id_idx", "climaparc_equipment_replacements", "new_equipment_id"),
    ("climaparc_hvac_systems_apartment_id_idx", "climaparc_hvac_systems", "apartment_id"),
    ("climaparc_hvac_systems_system_type_id_idx", "climaparc_hvac_systems", "system_type_id"),
    ("climaparc_hvac_system_types_topology_idx", "climaparc_hvac_system_types", "topology"),
    ("climaparc_work_order_targets_order_id_idx", "climaparc_work_order_targets", "work_order_id"),
    ("climaparc_work_order_targets_apartment_id_idx", "climaparc_work_order_targets", "apartment_id"),
    ("climaparc_work_order_completion_audits_order_id_idx", "climaparc_work_order_completion_audits", "work_order_id"),
]


def init_relational_tables(connection) -> None:
    for table, columns in PAYLOAD_TABLES.items():
        create_payload_table(connection, table, columns)
    for table, columns in CHILD_TABLES.items():
        create_table(connection, table, columns)
    for table, columns in CHILD_TABLE_COLUMNS.items():
        ensure_table_columns(connection, table, columns)
    for index_name, table, columns in INDEXES:
        connection.execute(f"create index if not exists {index_name} on {rel_table(table)}({columns})")


def ensure_operational_defaults(connection) -> None:
    replacement_template = {
        "id": "form_remplacement_unite",
        "name": "Remplacement d'une unite",
        "activityFields": {},
        "fields": [
            {"id": "ancienne_unite_confirmee", "label": "Unite a remplacer confirmee", "type": "checkbox", "required": True, "layout": "full"},
            {"id": "essai_fonctionnement", "label": "Essai de fonctionnement", "type": "single", "required": True, "options": ["Conforme", "A surveiller", "Non conforme"], "layout": "half"},
            {"id": "observations_installation", "label": "Observations d'installation", "type": "long", "required": False, "layout": "full"},
        ],
    }
    replacement_type = {
        "id": "remplacement_unite",
        "name": "Remplacement d'une unite",
        "defaultDuration": 120,
        "defaultFormTemplateId": replacement_template["id"],
        "behavior": "replacement",
        "checklist": ["Confirmer l'ancienne unite", "Installer la nouvelle unite", "Effectuer l'essai de fonctionnement", "Confirmer la destination de l'ancienne unite"],
    }
    defaults = (
        ("climaparc_form_templates", replacement_template, [("name", replacement_template["name"])]),
        ("climaparc_intervention_types", replacement_type, [("name", replacement_type["name"]), ("default_form_template_id", replacement_type["defaultFormTemplateId"]), ("behavior", replacement_type["behavior"])]),
    )
    for table, payload, column_values in defaults:
        existing = execute(connection, f"select id from {rel_table(table)} where id = ?", (payload["id"],)).fetchone()
        if existing:
            continue
        columns = ["id", *[name for name, _ in column_values], "payload", "updated_at"]
        values = [payload["id"], *[value for _, value in column_values], json_db_value(payload), now_value()]
        execute(
            connection,
            f"insert into {rel_table(table)} ({', '.join(columns)}) values ({', '.join('?' for _ in columns)})",
            tuple(values),
        )


def migrate_legacy_user_profiles(connection) -> None:
    """Seed public user profiles once, without replacing the legacy state document."""
    profile_count = execute(connection, f"select count(*) as count from {rel_table('climaparc_user_profiles')}").fetchone()
    if profile_count and int(row_get(profile_count, "count") or 0) > 0:
        return

    state_row = execute(connection, "select state_json from climaparc_state where id = 1").fetchone()
    if not state_row:
        return
    raw_state = row_get(state_row, "state_json")
    try:
        state = json.loads(raw_state) if isinstance(raw_state, str) else raw_state
    except json.JSONDecodeError:
        return
    if not isinstance(state, dict) or not isinstance(state.get("users"), list):
        return

    # Imported lazily to keep schema initialization independent from runtime modules.
    from .sync_services import sync_collection_table

    sync_collection_table(connection, sanitize_state_for_storage(state), "users")


def migrate_operational_records(connection) -> None:
    from .operational_migrations import migrate_operational_state
    from .repositories import StateRepository
    from .sync_services import sync_collection_table, sync_normalized_children

    repository = StateRepository()
    state = repository.get(connection, lock=False)
    if not state:
        return
    changed = migrate_operational_state(state)
    if not changed:
        return
    for collection_key in changed:
        sync_collection_table(connection, state, collection_key)
        sync_normalized_children(connection, state, collection_key)


def init_db() -> None:
    with connect() as connection:
        if USE_POSTGRES:
            connection.execute(
                """
                create table if not exists public.climaparc_state (
                  id integer primary key check (id = 1),
                  state_json jsonb not null,
                  updated_at timestamptz not null default now()
                )
                """
            )
            connection.execute(
                """
                create table if not exists public.climaparc_users (
                  id text primary key,
                  email text unique not null,
                  name text not null,
                  role text not null,
                  client_id text,
                  password_hash text not null,
                  salt text not null,
                  updated_at timestamptz not null default now()
                )
                """
            )
            connection.execute(
                """
                create table if not exists public.climaparc_sessions (
                  token text primary key,
                  user_id text not null references public.climaparc_users(id) on delete cascade,
                  expires_at timestamptz not null
                )
                """
            )
            connection.execute(
                """
                create table if not exists public.climaparc_password_reset_tokens (
                  token_hash text primary key,
                  reset_id text not null,
                  user_id text not null references public.climaparc_users(id) on delete cascade,
                  email text not null,
                  status text not null,
                  expires_at_text text not null,
                  updated_at timestamptz not null default now()
                )
                """
            )
            connection.execute("create index if not exists climaparc_sessions_user_id_idx on public.climaparc_sessions(user_id)")
            connection.execute("create index if not exists climaparc_sessions_expires_at_idx on public.climaparc_sessions(expires_at)")
            connection.execute("create index if not exists climaparc_password_reset_tokens_user_id_idx on public.climaparc_password_reset_tokens(user_id)")
            init_relational_tables(connection)
            ensure_operational_defaults(connection)
            migrate_legacy_user_profiles(connection)
            migrate_operational_records(connection)
            return

        connection.executescript(
            """
            create table if not exists climaparc_state (
              id integer primary key check (id = 1),
              state_json text not null,
              updated_at integer not null
            );

            create table if not exists climaparc_users (
              id text primary key,
              email text unique not null,
              name text not null,
              role text not null,
              client_id text,
              password_hash text not null,
              salt text not null,
              updated_at integer not null
            );

            create table if not exists climaparc_sessions (
              token text primary key,
              user_id text not null references climaparc_users(id) on delete cascade,
              expires_at integer not null
            );

            create table if not exists climaparc_password_reset_tokens (
              token_hash text primary key,
              reset_id text not null,
              user_id text not null references climaparc_users(id) on delete cascade,
              email text not null,
              status text not null,
              expires_at_text text not null,
              updated_at integer not null
            );

            create index if not exists climaparc_password_reset_tokens_user_id_idx
              on climaparc_password_reset_tokens(user_id);
            """
        )
        init_relational_tables(connection)
        ensure_operational_defaults(connection)
        migrate_legacy_user_profiles(connection)
        migrate_operational_records(connection)
