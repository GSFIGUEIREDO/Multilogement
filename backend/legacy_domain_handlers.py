from __future__ import annotations

from http import HTTPStatus
from typing import Any, Callable

from backend.auth_services import SessionService
from backend.security import filter_state_for_user
from src.climaparc.equipment.presentation.dependencies import (
    get_create_equipment_use_case,
    get_equipment_lookup_repository,
    get_update_equipment_use_case,
)
from src.climaparc.equipment.presentation.dispatch import save_equipment_with_use_cases
from src.climaparc.interventions.presentation.dependencies import (
    get_create_intervention_use_case,
    get_intervention_lookup_repository,
    get_update_intervention_use_case,
)
from src.climaparc.interventions.presentation.dispatch import save_intervention_with_use_cases
from src.climaparc.places.presentation.dependencies import (
    get_create_apartment_use_case,
    get_create_building_use_case,
    get_place_lookup_repository,
    get_update_apartment_use_case,
    get_update_building_use_case,
)
from src.climaparc.places.presentation.dispatch import save_apartment_with_use_cases, save_building_with_use_cases
from src.climaparc.reminders.presentation.dependencies import (
    get_delete_reminder_use_case,
    get_save_reminder_batch_use_case,
    get_save_reminder_use_case,
)
from src.climaparc.reminders.presentation.dispatch import (
    delete_reminder_with_use_case,
    save_reminder_batch_with_use_case,
    save_reminder_with_use_case,
)
from src.climaparc.reports.presentation.dependencies import get_report_context_use_case
from src.climaparc.reports.presentation.dispatch import get_report_context_with_use_case
from src.climaparc.settings.presentation.dependencies import (
    get_delete_setting_item_use_case,
    get_save_setting_item_use_case,
)
from src.climaparc.settings.presentation.dispatch import (
    delete_setting_item_with_use_case,
    save_setting_item_with_use_case,
)
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.tickets.presentation.dependencies import (
    get_create_ticket_use_case,
    get_ticket_lookup_repository,
    get_update_ticket_use_case,
)
from src.climaparc.tickets.presentation.dispatch import save_ticket_with_use_cases
from src.climaparc.users.application.commands import DeleteUserCommand
from src.climaparc.users.presentation.dependencies import (
    get_create_user_use_case,
    get_delete_user_use_case,
    get_update_user_use_case,
    get_user_lookup_repository,
)
from src.climaparc.users.presentation.dispatch import save_user_with_use_cases
from src.climaparc.work_orders.presentation.dependencies import (
    get_create_work_order_use_case,
    get_update_work_order_use_case,
    get_work_order_lookup_repository,
)
from src.climaparc.work_orders.presentation.dispatch import save_work_order_with_use_cases


def handle_save_equipment(handler: Any, *, sync_relational_tables_safely: Callable) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        result = save_equipment_with_use_cases(
            user,
            payload.get("equipment"),
            get_equipment_lookup_repository(),
            get_create_equipment_use_case(),
            get_update_equipment_use_case(),
        )
        _sync_and_filter(result, user, sync_relational_tables_safely, {"equipment"})
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"Equipment save failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la sauvegarde machine."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_save_user(handler: Any) -> None:
    current_user = _current_user(handler)
    if not current_user:
        return
    payload = handler.read_json()
    try:
        result = save_user_with_use_cases(
            current_user,
            payload.get("user"),
            get_user_lookup_repository(),
            get_create_user_use_case(),
            get_update_user_use_case(),
        )
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except ValueError as error:
        handler.json_response({"error": str(error)}, HTTPStatus.CONFLICT)
    except Exception as error:
        print(f"User save failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la sauvegarde utilisateur."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_delete_user(handler: Any) -> None:
    current_user = _current_user(handler)
    if not current_user:
        return
    payload = handler.read_json()
    try:
        result = get_delete_user_use_case()(DeleteUserCommand(current_user, str(payload.get("userId") or "")))
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"User delete failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la suppression utilisateur."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_save_building(handler: Any, *, sync_relational_tables_safely: Callable) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        result = save_building_with_use_cases(
            user,
            payload.get("building"),
            get_place_lookup_repository(),
            get_create_building_use_case(),
            get_update_building_use_case(),
        )
        _sync_and_filter(result, user, sync_relational_tables_safely, {"buildings"})
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"building save failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la sauvegarde building."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_save_apartment(handler: Any, *, sync_relational_tables_safely: Callable) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        result = save_apartment_with_use_cases(
            user,
            payload.get("apartment"),
            get_place_lookup_repository(),
            get_create_apartment_use_case(),
            get_update_apartment_use_case(),
        )
        _sync_and_filter(result, user, sync_relational_tables_safely, {"apartments"})
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"apartment save failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la sauvegarde apartment."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_save_ticket(handler: Any, *, sync_relational_tables_safely: Callable) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        result = save_ticket_with_use_cases(
            user,
            payload.get("ticket"),
            get_ticket_lookup_repository(),
            get_create_ticket_use_case(),
            get_update_ticket_use_case(),
        )
        _sync_and_filter(result, user, sync_relational_tables_safely, {"tickets"})
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"ticket save failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la sauvegarde ticket."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_save_work_order(handler: Any, *, sync_relational_tables_safely: Callable) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        result = save_work_order_with_use_cases(
            user,
            payload.get("workOrder"),
            get_work_order_lookup_repository(),
            get_create_work_order_use_case(),
            get_update_work_order_use_case(),
        )
        _sync_and_filter(result, user, sync_relational_tables_safely, {"workOrders"})
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"workOrder save failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la sauvegarde workOrder."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_save_intervention(handler: Any, *, sync_relational_tables_safely: Callable) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        result = save_intervention_with_use_cases(
            user,
            payload.get("intervention"),
            get_intervention_lookup_repository(),
            get_create_intervention_use_case(),
            get_update_intervention_use_case(),
        )
        _sync_and_filter(result, user, sync_relational_tables_safely, {"interventions"})
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"intervention save failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la sauvegarde intervention."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_save_reminder(handler: Any, *, sync_relational_tables_safely: Callable) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        if isinstance(payload.get("reminders"), list):
            result = save_reminder_batch_with_use_case(user, payload.get("reminders"), get_save_reminder_batch_use_case())
        else:
            result = save_reminder_with_use_case(user, payload.get("reminder"), get_save_reminder_use_case())
        _sync_and_filter(result, user, sync_relational_tables_safely, {"reminders"})
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"reminder save failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la sauvegarde rappel."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_delete_reminder(handler: Any) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        result = delete_reminder_with_use_case(user, str(payload.get("reminderId") or ""), get_delete_reminder_use_case())
        result["state"] = filter_state_for_user(result.get("state", {}), user)
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"reminder delete failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la suppression rappel."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_report_context(handler: Any) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        result = get_report_context_with_use_case(user, payload.get("filters"), get_report_context_use_case())
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"report context failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la preparation du rapport."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_save_setting_item(handler: Any, *, sync_relational_tables_safely: Callable) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        collection_key = str(payload.get("collectionKey") or "")
        result = save_setting_item_with_use_case(
            user,
            collection_key,
            payload.get("item"),
            get_save_setting_item_use_case(),
        )
        _sync_and_filter(result, user, sync_relational_tables_safely, {collection_key})
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"setting save failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la sauvegarde des parametres."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_delete_setting_item(handler: Any, *, sync_relational_tables_safely: Callable) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        collection_key = str(payload.get("collectionKey") or "")
        result = delete_setting_item_with_use_case(
            user,
            collection_key,
            str(payload.get("itemId") or ""),
            get_delete_setting_item_use_case(),
        )
        _sync_and_filter(result, user, sync_relational_tables_safely, {collection_key})
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"setting delete failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la suppression des parametres."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def _current_user(handler: Any):
    user = SessionService().read(handler.headers.get("Cookie"))
    if not user:
        handler.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
        return None
    return user


def _sync_and_filter(result: dict, user: Any, sync_relational_tables_safely: Callable, keys: set[str]) -> None:
    sync_relational_tables_safely(result.get("state", {}), keys)
    result["state"] = filter_state_for_user(result.get("state", {}), user)
