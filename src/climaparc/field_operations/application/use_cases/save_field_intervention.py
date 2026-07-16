from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import AuthorizationError, filter_state_for_user, requester_from_state, require_can_save_collection
from src.climaparc.field_operations.application.commands import ExecuteReplacementCommand, SaveFieldInterventionCommand
from src.climaparc.field_operations.domain.policies import normalize_field_bundle
from src.climaparc.field_operations.domain.repositories import FieldOperationRepository
from src.climaparc.shared.domain.errors import ApplicationError


class SaveFieldInterventionUseCase:
    def __init__(self, repository: FieldOperationRepository, execute_replacement):
        self.repository = repository
        self.execute_replacement = execute_replacement

    def __call__(self, command: SaveFieldInterventionCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        state = self.repository.get_state()
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)

        apartment, equipment, intervention, work_order = normalize_field_bundle(
            state,
            command.apartment,
            command.equipment,
            command.intervention,
            command.work_order,
        )
        matching_targets = [
                item for item in state.get("workOrderTargets", [])
                if isinstance(item, dict)
                and item.get("workOrderId") == work_order.get("id")
                and (
                    item.get("id") == intervention.get("targetId")
                    or (item.get("apartmentId") == intervention.get("apartmentId") and (not item.get("equipmentId") or item.get("equipmentId") == equipment.get("id")))
                )
                and (not item.get("activityTypeId") or item.get("activityTypeId") == intervention.get("typeId"))
        ]
        if any(target.get("approvalStatus") in {"pending", "refused"} for target in matching_targets):
            raise ApplicationError("Cette activite est bloquee par la decision du client.", HTTPStatus.CONFLICT)
        try:
            if apartment:
                require_can_save_collection(state, command.current_user, "apartments", apartment)
            require_can_save_collection(state, command.current_user, "equipment", equipment)
            require_can_save_collection(state, command.current_user, "interventions", intervention)
            require_can_save_collection(state, command.current_user, "workOrders", work_order)
        except AuthorizationError as error:
            raise ApplicationError(str(error), HTTPStatus.FORBIDDEN) from None

        equipment, replacement = self.execute_replacement(
            ExecuteReplacementCommand(state, command.current_user, equipment, intervention, work_order, command.replacement)
        )
        if replacement:
            try:
                requester = requester_from_state(state, command.current_user)
                if requester.get("role") != "technicien":
                    require_can_save_collection(state, command.current_user, "equipment", replacement["newEquipment"])
            except AuthorizationError as error:
                raise ApplicationError(str(error), HTTPStatus.FORBIDDEN) from None
        equipment = stamp_payload(equipment)
        intervention = stamp_payload(intervention)
        work_order = stamp_payload(work_order)
        apartment = stamp_payload(apartment) if apartment else None
        if replacement:
            replacement["newEquipment"] = stamp_payload(replacement["newEquipment"])
            replacement["movement"] = stamp_payload(replacement["movement"])
            if replacement.get("newEquipmentMovement"):
                replacement["newEquipmentMovement"] = stamp_payload(replacement["newEquipmentMovement"])
            replacement["relation"] = stamp_payload(replacement["relation"])
        self.repository.save_bundle(apartment, equipment, intervention, work_order, replacement)
        fresh_state = self.repository.get_state() or state
        return {
            "ok": True,
            "state": filter_state_for_user(fresh_state, command.current_user),
            "apartment": apartment,
            "equipment": equipment,
            "intervention": intervention,
            "workOrder": work_order,
        }
