from __future__ import annotations

from http import HTTPStatus
from typing import Any, Callable

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


class ServiceError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status = status


class _UseCaseCompatibilityService:
    entity_key = "item"

    def _save(self, callback: Callable[[], dict]) -> dict:
        try:
            return self._with_legacy_item(callback())
        except ApplicationError as error:
            raise ServiceError(error.message, error.status) from error
        except ValueError as error:
            raise ServiceError(str(error), HTTPStatus.CONFLICT) from error

    def _with_legacy_item(self, result: dict) -> dict:
        if self.entity_key != "item" and "item" not in result and self.entity_key in result:
            result["item"] = result[self.entity_key]
        return result


class EquipmentService(_UseCaseCompatibilityService):
    entity_key = "equipment"

    def save(self, current_user_row: Any, equipment_payload: dict | None = None) -> dict:
        current_user, payload = _resolve_legacy_save_args(current_user_row, equipment_payload)
        return self._save(
            lambda: save_equipment_with_use_cases(
                current_user,
                payload,
                get_equipment_lookup_repository(),
                get_create_equipment_use_case(),
                get_update_equipment_use_case(),
            )
        )


class BuildingService(_UseCaseCompatibilityService):
    def save(self, current_user_row: Any, payload: dict | None = None) -> dict:
        current_user, building = _resolve_legacy_save_args(current_user_row, payload)
        return self._save(
            lambda: save_building_with_use_cases(
                current_user,
                building,
                get_place_lookup_repository(),
                get_create_building_use_case(),
                get_update_building_use_case(),
            )
        )


class ApartmentService(_UseCaseCompatibilityService):
    def save(self, current_user_row: Any, payload: dict | None = None) -> dict:
        current_user, apartment = _resolve_legacy_save_args(current_user_row, payload)
        return self._save(
            lambda: save_apartment_with_use_cases(
                current_user,
                apartment,
                get_place_lookup_repository(),
                get_create_apartment_use_case(),
                get_update_apartment_use_case(),
            )
        )


class TicketService(_UseCaseCompatibilityService):
    def save(self, current_user_row: Any, payload: dict | None = None) -> dict:
        current_user, ticket = _resolve_legacy_save_args(current_user_row, payload)
        return self._save(
            lambda: save_ticket_with_use_cases(
                current_user,
                ticket,
                get_ticket_lookup_repository(),
                get_create_ticket_use_case(),
                get_update_ticket_use_case(),
            )
        )


class WorkOrderService(_UseCaseCompatibilityService):
    def save(self, current_user_row: Any, payload: dict | None = None) -> dict:
        current_user, work_order = _resolve_legacy_save_args(current_user_row, payload)
        return self._save(
            lambda: save_work_order_with_use_cases(
                current_user,
                work_order,
                get_work_order_lookup_repository(),
                get_create_work_order_use_case(),
                get_update_work_order_use_case(),
            )
        )


class InterventionService(_UseCaseCompatibilityService):
    def save(self, current_user_row: Any, payload: dict | None = None) -> dict:
        current_user, intervention = _resolve_legacy_save_args(current_user_row, payload)
        return self._save(
            lambda: save_intervention_with_use_cases(
                current_user,
                intervention,
                get_intervention_lookup_repository(),
                get_create_intervention_use_case(),
                get_update_intervention_use_case(),
            )
        )


class UserService(_UseCaseCompatibilityService):
    entity_key = "user"

    def save(self, current_user_row: Any, user_payload: dict) -> dict:
        return self._save(
            lambda: save_user_with_use_cases(
                current_user_row,
                user_payload,
                get_user_lookup_repository(),
                get_create_user_use_case(),
                get_update_user_use_case(),
            )
        )

    def delete(self, current_user_row: Any, user_id: str) -> dict:
        return self._save(lambda: get_delete_user_use_case()(DeleteUserCommand(current_user_row, user_id)))


def _resolve_legacy_save_args(current_user_row: Any, payload: dict | None) -> tuple[Any, dict | None]:
    if payload is None:
        return None, current_user_row
    return current_user_row, payload
