from __future__ import annotations

from src.climaparc.recommendations.application.commands import ClientUpdateRecommendationCommand, InternalReviewRecommendationCommand
from src.climaparc.recommendations.application.use_cases.client_update_recommendation import ClientUpdateRecommendationUseCase
from src.climaparc.recommendations.application.use_cases.internal_review_recommendation import InternalReviewRecommendationUseCase


def client_update_recommendation_with_use_case(
    current_user: dict,
    intervention_id: str,
    recommendation: dict,
    use_case: ClientUpdateRecommendationUseCase,
) -> dict:
    return use_case(ClientUpdateRecommendationCommand(current_user, intervention_id, recommendation))


def internal_review_recommendation_with_use_case(
    current_user: dict,
    intervention_id: str,
    recommendation: dict,
    use_case: InternalReviewRecommendationUseCase,
) -> dict:
    return use_case(InternalReviewRecommendationCommand(current_user, intervention_id, recommendation))
