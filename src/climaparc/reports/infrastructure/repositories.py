from __future__ import annotations

from typing import Any

from backend.database import USE_POSTGRES, connect, execute, row_get


REPORT_COLLECTION_TABLES = {
    "users": "climaparc_user_profiles",
    "clients": "climaparc_clients",
    "buildings": "climaparc_buildings",
    "apartments": "climaparc_apartments",
    "equipment": "climaparc_equipment",
    "tickets": "climaparc_tickets",
    "workOrders": "climaparc_work_orders",
    "interventions": "climaparc_interventions",
    "reminders": "climaparc_reminders",
    "serviceTypes": "climaparc_service_types",
    "interventionTypes": "climaparc_intervention_types",
    "formTemplates": "climaparc_form_templates",
    "dataFields": "climaparc_data_fields",
}


def relation_table(name: str) -> str:
    return f"public.{name}" if USE_POSTGRES else name


def decode_payload(value: Any) -> dict | None:
    if isinstance(value, str):
        import json

        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return None
    return dict(value) if isinstance(value, dict) else None


class DatabaseReportsDataRepository:
    def get_report_data(self) -> dict:
        state = {
            "sessionUserId": None,
            "modal": None,
            "toast": "",
        }
        with connect() as connection:
            for collection_key, table in REPORT_COLLECTION_TABLES.items():
                rows = execute(connection, f"select payload from {relation_table(table)} order by updated_at desc").fetchall()
                state[collection_key] = [
                    payload
                    for payload in (decode_payload(row_get(row, "payload")) for row in rows)
                    if payload
                ]
        return state
