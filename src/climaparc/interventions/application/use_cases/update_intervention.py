from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.interventions.application.commands import UpdateInterventionCommand
from src.climaparc.interventions.domain.policies import (
    clear_ui_state,
    client_recommendation_update,
    find_intervention_index,
    is_client,
    normalize_intervention_payload,
    require_can_save_intervention,
)
from src.climaparc.interventions.domain.repositories import InterventionPayloadRepository, InterventionStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class UpdateInterventionUseCase:
    def __init__(self, state_repository: InterventionStateRepository, payload_repository: InterventionPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: UpdateInterventionCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        incoming = normalize_intervention_payload(command.intervention)

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.")
        interventions = state.setdefault("interventions", [])
        if not isinstance(interventions, list):
            interventions = []
            state["interventions"] = interventions
        index = find_intervention_index(interventions, incoming["id"])
        if index < 0:
            raise ApplicationError("Intervention introuvable.", HTTPStatus.NOT_FOUND)

        if is_client(command.current_user):
            intervention = stamp_payload(client_recommendation_update(state, command.current_user, incoming))
        else:
            intervention = stamp_payload(incoming)
            require_can_save_intervention(state, command.current_user, intervention)

        interventions[index] = intervention
        clear_ui_state(state)
        self.payload_repository.upsert(intervention)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": intervention}
