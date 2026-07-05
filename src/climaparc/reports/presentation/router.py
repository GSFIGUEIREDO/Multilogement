from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.reports.application.use_cases.get_report_context import GetReportContextUseCase
from src.climaparc.reports.presentation.dependencies import get_report_context_use_case, get_session_repository
from src.climaparc.reports.presentation.dispatch import get_report_context_with_use_case
from src.climaparc.shared.domain.errors import ApplicationError


router = APIRouter()


class ReportContextRequest(BaseModel):
    filters: dict = {}


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/report-context")
def report_context(
    request: Request,
    payload: ReportContextRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    use_case: GetReportContextUseCase = Depends(get_report_context_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return get_report_context_with_use_case(current_user, payload.filters, use_case)
    except ApplicationError as error:
        raise_http(error)

