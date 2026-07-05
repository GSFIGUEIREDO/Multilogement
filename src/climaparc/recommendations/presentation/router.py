from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.recommendations.application.use_cases.client_update_recommendation import ClientUpdateRecommendationUseCase
from src.climaparc.recommendations.application.use_cases.internal_review_recommendation import InternalReviewRecommendationUseCase
from src.climaparc.recommendations.presentation.dependencies import (
    get_client_update_recommendation_use_case,
    get_internal_review_recommendation_use_case,
    get_session_repository,
)
from src.climaparc.recommendations.presentation.dispatch import (
    client_update_recommendation_with_use_case,
    internal_review_recommendation_with_use_case,
)
from src.climaparc.shared.domain.errors import ApplicationError


router = APIRouter()


class RecommendationRequest(BaseModel):
    interventionId: str = ""
    recommendation: dict | None = None


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/recommendation/client-response")
def client_update_recommendation(
    request: Request,
    payload: RecommendationRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    use_case: ClientUpdateRecommendationUseCase = Depends(get_client_update_recommendation_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return client_update_recommendation_with_use_case(
            current_user,
            payload.interventionId,
            payload.recommendation or {},
            use_case,
        )
    except ApplicationError as error:
        raise_http(error)


@router.post("/api/recommendation/review")
def internal_review_recommendation(
    request: Request,
    payload: RecommendationRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    use_case: InternalReviewRecommendationUseCase = Depends(get_internal_review_recommendation_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return internal_review_recommendation_with_use_case(
            current_user,
            payload.interventionId,
            payload.recommendation or {},
            use_case,
        )
    except ApplicationError as error:
        raise_http(error)
