from __future__ import annotations

from http import HTTPStatus

from backend.security import filter_state_for_user
from src.climaparc.reports.application.commands import GetReportContextCommand
from src.climaparc.reports.domain.policies import build_report_context, require_can_read_reports
from src.climaparc.reports.domain.repositories import ReportsDataRepository
from src.climaparc.shared.domain.errors import ApplicationError


class GetReportContextUseCase:
    def __init__(self, data_repository: ReportsDataRepository):
        self.data_repository = data_repository

    def __call__(self, command: GetReportContextCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        state = self.data_repository.get_report_data()
        scoped_state = filter_state_for_user(state, command.current_user)
        require_can_read_reports(scoped_state, command.current_user)
        report_context = build_report_context(scoped_state, command.current_user, command.filters or {})
        return {"ok": True, **report_context}
