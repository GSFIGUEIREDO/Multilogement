from __future__ import annotations

from datetime import date
from http import HTTPStatus
from typing import Any

from backend.database import row_get
from backend.security import has_client_right, requester_from_state
from src.climaparc.shared.domain.errors import ApplicationError


CLIENT_REPORT_TYPES = [
    ["parc_mensuel", "Rapport mensuel de parc HVAC"],
    ["maintenance_preventive", "Rapport de maintenance preventive"],
    ["appels_service", "Rapport des demandes clients"],
    ["hors_service", "Rapport des equipements hors service"],
    ["budget_annuel", "Rapport annuel pour budget"],
]

INTERNAL_REPORT_TYPES = [
    ["dashboard_operationnel", "Dashboard operationnel interne"],
    ["productivite_techniciens", "Productivite des techniciens"],
    ["retard_backlog", "Retard / backlog"],
    ["qualite_service", "Qualite de service"],
    ["planification_preventive", "Planification preventive"],
    ["inventaire_parc", "Inventaire / parc machines"],
    ["commercial_rentabilite", "Commercial / rentabilite future"],
]

TECHNICIAN_REPORT_TYPES = [
    ["tech_journalier", "Rapport journalier du technicien"],
    ["tech_checklist", "Rapport de checklist d'intervention"],
    ["tech_historique_machine", "Rapport d'historique machine"],
    ["tech_problemes_recurrents", "Rapport de problemes recurrents"],
    ["tech_fin_journee", "Rapport de fin de journee"],
]


def require_can_read_reports(state: dict, current_user_row: Any) -> None:
    user = requester_from_state(state, current_user_row)
    role = user.get("role")
    if role in {"administrateur", "equipe_interne", "technicien"}:
        return
    if role == "client" and has_client_right(user, "reports"):
        return
    raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)


def report_types_for_user(state: dict, current_user_row: Any) -> list[list[str]]:
    user = requester_from_state(state, current_user_row)
    role = user.get("role")
    if role == "client":
        return CLIENT_REPORT_TYPES
    if role == "technicien":
        return TECHNICIAN_REPORT_TYPES
    return INTERNAL_REPORT_TYPES


def build_report_context(state: dict, current_user_row: Any, filters: dict) -> dict:
    user = requester_from_state(state, current_user_row)
    normalized_filters = normalize_filters(state, user, filters)
    audience = audience_for_role(user.get("role"))
    types = report_types_for_user(state, current_user_row)
    selected_type = normalized_filters.get("reportType")
    if selected_type not in {item[0] for item in types}:
        normalized_filters["reportType"] = types[0][0] if types else ""

    buildings = filtered_buildings(state, user, normalized_filters)
    building_ids = {item.get("id") for item in buildings}
    apartments = [item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("buildingId") in building_ids]
    apartment_ids = {item.get("id") for item in apartments}
    equipment = [
        item
        for item in state.get("equipment", [])
        if isinstance(item, dict)
        and item.get("apartmentId") in apartment_ids
        and (normalized_filters["equipmentStatus"] == "all" or item.get("status") == normalized_filters["equipmentStatus"])
    ]
    equipment_ids = {item.get("id") for item in equipment}
    tickets = [
        item
        for item in state.get("tickets", [])
        if isinstance(item, dict)
        and (item.get("equipmentId") in equipment_ids or item.get("buildingId") in building_ids)
        and in_period(item.get("createdAt"), normalized_filters["startDate"], normalized_filters["endDate"])
    ]
    work_orders = [
        item
        for item in state.get("workOrders", [])
        if isinstance(item, dict)
        and (item.get("equipmentId") in equipment_ids or item.get("buildingId") in building_ids)
        and in_period(item.get("scheduledDate"), normalized_filters["startDate"], normalized_filters["endDate"])
    ]
    interventions = [
        item
        for item in state.get("interventions", [])
        if isinstance(item, dict)
        and item.get("equipmentId") in equipment_ids
        and in_period(item.get("date"), normalized_filters["startDate"], normalized_filters["endDate"])
        and (
            normalized_filters["activityStatus"] == "all"
            or (item.get("activityStatus") or item.get("status")) == normalized_filters["activityStatus"]
        )
    ]
    reminders = [item for item in state.get("reminders", []) if isinstance(item, dict) and item.get("equipmentId") in equipment_ids]
    context = {
        "buildings": buildings,
        "apartments": apartments,
        "equipment": equipment,
        "tickets": tickets,
        "workOrders": work_orders,
        "interventions": interventions,
        "reminders": reminders,
        "serviceTypes": state.get("serviceTypes", []),
        "interventionTypes": state.get("interventionTypes", []),
        "formTemplates": state.get("formTemplates", []),
        "dataFields": state.get("dataFields", []),
    }
    return {
        "audience": audience,
        "filters": normalized_filters,
        "reportTypes": types,
        "context": context,
        "metrics": metrics_for_context(context),
    }


def normalize_filters(state: dict, user: dict, filters: dict) -> dict:
    today_value = date.today().isoformat()
    month_start = today_value[:8] + "01"
    client_id = filters.get("clientId") or "all"
    if user.get("role") == "client":
        client_id = user.get("clientId") or ""
    return {
        "reportType": str(filters.get("reportType") or ""),
        "clientId": str(client_id),
        "startDate": valid_date(filters.get("startDate")) or month_start,
        "endDate": valid_date(filters.get("endDate")) or today_value,
        "equipmentStatus": str(filters.get("equipmentStatus") or "all"),
        "activityStatus": str(filters.get("activityStatus") or "all"),
    }


def filtered_buildings(state: dict, user: dict, filters: dict) -> list[dict]:
    buildings = [item for item in state.get("buildings", []) if isinstance(item, dict)]
    if user.get("role") == "client":
        return [item for item in buildings if item.get("clientId") == user.get("clientId")]
    client_id = filters.get("clientId")
    if client_id and client_id != "all":
        return [item for item in buildings if item.get("clientId") == client_id]
    return buildings


def metrics_for_context(context: dict) -> dict:
    equipment = context["equipment"]
    tickets = context["tickets"]
    work_orders = context["workOrders"]
    reminders = context["reminders"]
    return {
        "buildings": len(context["buildings"]),
        "apartments": len(context["apartments"]),
        "equipment": len(equipment),
        "activeEquipment": len([item for item in equipment if item.get("status") == "actif"]),
        "outOfServiceEquipment": len([item for item in equipment if item.get("status") == "hors_service"]),
        "tickets": len(tickets),
        "openTickets": len([item for item in tickets if item.get("status") != "ferme"]),
        "workOrders": len(work_orders),
        "openWorkOrders": len([item for item in work_orders if item.get("status") not in {"termine", "annule"}]),
        "reminders": len(reminders),
    }


def audience_for_role(role: str | None) -> str:
    if role == "client":
        return "client"
    if role == "technicien":
        return "technician"
    return "internal"


def valid_date(value: Any) -> str:
    text = str(value or "")
    if len(text) != 10:
        return ""
    try:
        date.fromisoformat(text)
    except ValueError:
        return ""
    return text


def in_period(value: Any, start_date: str, end_date: str) -> bool:
    text = valid_date(value)
    if not text:
        return True
    return start_date <= text <= end_date

