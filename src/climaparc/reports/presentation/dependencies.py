from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.reports.application.use_cases.get_report_context import GetReportContextUseCase
from src.climaparc.reports.infrastructure.repositories import DatabaseReportsDataRepository


def get_reports_data_repository() -> DatabaseReportsDataRepository:
    return DatabaseReportsDataRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_report_context_use_case() -> GetReportContextUseCase:
    return GetReportContextUseCase(get_reports_data_repository())
