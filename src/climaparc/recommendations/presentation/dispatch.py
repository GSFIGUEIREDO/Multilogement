from __future__ import annotations

from src.climaparc.recommendations.application.commands import ClientUpdateRecommendationCommand, InternalReviewRecommendationCommand, RouteRecommendationCommand
from src.climaparc.recommendations.application.use_cases.client_update_recommendation import ClientUpdateRecommendationUseCase
from src.climaparc.recommendations.application.use_cases.internal_review_recommendation import InternalReviewRecommendationUseCase
from src.climaparc.recommendations.application.use_cases.route_recommendation import RouteRecommendationUseCase


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


def route_recommendation_with_use_case(
    current_user: dict,
    intervention_id: str,
    mode: str,
    work_order_id: str,
    use_case: RouteRecommendationUseCase,
) -> dict:
    return use_case(RouteRecommendationCommand(current_user, intervention_id, mode, work_order_id))
