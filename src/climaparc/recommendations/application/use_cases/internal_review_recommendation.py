from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.recommendations.application.commands import InternalReviewRecommendationCommand
from src.climaparc.recommendations.domain.policies import (
    apply_internal_recommendation_review,
    clear_ui_state,
    find_intervention_index,
    normalize_intervention_id,
    normalize_recommendation_payload,
)
from src.climaparc.recommendations.domain.repositories import RecommendationPayloadRepository, RecommendationStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class InternalReviewRecommendationUseCase:
    def __init__(self, state_repository: RecommendationStateRepository, payload_repository: RecommendationPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: InternalReviewRecommendationCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        intervention_id = normalize_intervention_id(command.intervention_id)
        recommendation = normalize_recommendation_payload(command.recommendation)

        state = self.state_repository.get(lock=False)
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        intervention = stamp_payload(apply_internal_recommendation_review(state, command.current_user, intervention_id, recommendation))
        interventions = state.setdefault("interventions", [])
        index = find_intervention_index(interventions, intervention_id)
        interventions[index] = intervention
        updated_targets = []
        recommendation = intervention.get("recommendation", {})
        requires_approval = recommendation.get("requiresClientApproval") is not False
        for target in state.get("workOrderTargets", []):
            if target.get("sourceRecommendationId") != intervention_id:
                continue
            updated = dict(target)
            updated["approvalStatus"] = "not_required" if not requires_approval else "approved" if recommendation.get("status") == "approuvee" else "refused" if recommendation.get("status") == "refusee" else "pending"
            if recommendation.get("status") == "refusee":
                updated["status"] = "annule"
            updated_targets.append(stamp_payload(updated))
        clear_ui_state(state)
        self.payload_repository.upsert_intervention_with_targets(intervention, updated_targets)
        state = self.state_repository.get(lock=False) or state
        clear_ui_state(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": intervention}
