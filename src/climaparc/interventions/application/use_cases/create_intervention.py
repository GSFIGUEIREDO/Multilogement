from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.interventions.application.commands import CreateInterventionCommand
from src.climaparc.interventions.domain.policies import (
    clear_ui_state,
    find_intervention_index,
    normalize_intervention_payload,
    require_can_save_intervention,
)
from src.climaparc.interventions.domain.repositories import InterventionPayloadRepository, InterventionStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class CreateInterventionUseCase:
    def __init__(self, state_repository: InterventionStateRepository, payload_repository: InterventionPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: CreateInterventionCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        intervention = stamp_payload(normalize_intervention_payload(command.intervention))

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.")
        interventions = state.setdefault("interventions", [])
        if not isinstance(interventions, list):
            interventions = []
            state["interventions"] = interventions
        if find_intervention_index(interventions, intervention["id"]) >= 0:
            raise ApplicationError("Intervention existe deja.", HTTPStatus.CONFLICT)

        require_can_save_intervention(state, command.current_user, intervention)
        interventions.insert(0, intervention)
        clear_ui_state(state)
        self.payload_repository.upsert(intervention)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": intervention}
