from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.recommendations.application.use_cases.client_update_recommendation import ClientUpdateRecommendationUseCase
from src.climaparc.recommendations.application.use_cases.internal_review_recommendation import InternalReviewRecommendationUseCase
from src.climaparc.recommendations.application.use_cases.route_recommendation import RouteRecommendationUseCase
from src.climaparc.recommendations.infrastructure.repositories import (
    DatabaseRecommendationPayloadRepository,
    DatabaseRecommendationStateRepository,
    DatabaseRecommendationWorkflowRepository,
)


def get_recommendation_state_repository() -> DatabaseRecommendationStateRepository:
    return DatabaseRecommendationStateRepository()


def get_recommendation_payload_repository() -> DatabaseRecommendationPayloadRepository:
    return DatabaseRecommendationPayloadRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_client_update_recommendation_use_case() -> ClientUpdateRecommendationUseCase:
    return ClientUpdateRecommendationUseCase(
        get_recommendation_state_repository(),
        get_recommendation_payload_repository(),
    )


def get_internal_review_recommendation_use_case() -> InternalReviewRecommendationUseCase:
    return InternalReviewRecommendationUseCase(get_recommendation_state_repository(), get_recommendation_payload_repository())


def get_route_recommendation_use_case() -> RouteRecommendationUseCase:
    return RouteRecommendationUseCase(DatabaseRecommendationWorkflowRepository())
