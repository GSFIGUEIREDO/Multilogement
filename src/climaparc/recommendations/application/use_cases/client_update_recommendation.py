from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.recommendations.application.commands import ClientUpdateRecommendationCommand
from src.climaparc.recommendations.domain.policies import (
    apply_client_recommendation_update,
    clear_ui_state,
    find_intervention_index,
    normalize_intervention_id,
    normalize_recommendation_payload,
)
from src.climaparc.recommendations.domain.repositories import RecommendationPayloadRepository, RecommendationStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class ClientUpdateRecommendationUseCase:
    def __init__(self, state_repository: RecommendationStateRepository, payload_repository: RecommendationPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: ClientUpdateRecommendationCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        intervention_id = normalize_intervention_id(command.intervention_id)
        recommendation = normalize_recommendation_payload(command.recommendation)

        state = self.state_repository.get(lock=False)
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        intervention = stamp_payload(apply_client_recommendation_update(state, command.current_user, intervention_id, recommendation))
        interventions = state.setdefault("interventions", [])
        index = find_intervention_index(interventions, intervention_id)
        interventions[index] = intervention
        clear_ui_state(state)
        self.payload_repository.upsert_intervention(intervention)
        state = self.state_repository.get(lock=False) or state
        clear_ui_state(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": intervention}
