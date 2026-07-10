from __future__ import annotations

from http import HTTPStatus
from typing import Any

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.interventions.application.commands import UpdateInterventionCommand
from src.climaparc.interventions.domain.policies import (
    clear_ui_state,
    find_intervention_index,
    is_client,
    normalize_intervention_payload,
    require_can_save_intervention,
)
from src.climaparc.interventions.domain.repositories import InterventionPayloadRepository, InterventionStateRepository
from src.climaparc.recommendations.application.commands import ClientUpdateRecommendationCommand
from src.climaparc.shared.domain.errors import ApplicationError


class UpdateInterventionUseCase:
    def __init__(
        self,
        state_repository: InterventionStateRepository,
        payload_repository: InterventionPayloadRepository,
        client_recommendation_use_case: Any | None = None,
    ):
        self.state_repository = state_repository
        self.payload_repository = payload_repository
        self.client_recommendation_use_case = client_recommendation_use_case

    def __call__(self, command: UpdateInterventionCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        incoming = normalize_intervention_payload(command.intervention)

        if is_client(command.current_user):
            if not self.client_recommendation_use_case:
                raise ApplicationError("Service recommandation indisponible.")
            return self.client_recommendation_use_case(
                ClientUpdateRecommendationCommand(
                    command.current_user,
                    incoming["id"],
                    incoming.get("recommendation") if isinstance(incoming.get("recommendation"), dict) else {},
                )
            )

        state = self.state_repository.get(lock=False)
        if not state:
            raise ApplicationError("Etat introuvable.")
        interventions = state.setdefault("interventions", [])
        if not isinstance(interventions, list):
            interventions = []
            state["interventions"] = interventions
        index = find_intervention_index(interventions, incoming["id"])
        if index < 0:
            raise ApplicationError("Intervention introuvable.", HTTPStatus.NOT_FOUND)

        intervention = stamp_payload(incoming)
        require_can_save_intervention(state, command.current_user, intervention)

        interventions[index] = intervention
        clear_ui_state(state)
        self.payload_repository.upsert(intervention)
        state = self.state_repository.get(lock=False) or state
        clear_ui_state(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": intervention}
