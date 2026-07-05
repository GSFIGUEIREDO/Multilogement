from __future__ import annotations

from src.climaparc.reports.application.commands import GetReportContextCommand
from src.climaparc.reports.application.use_cases.get_report_context import GetReportContextUseCase


def get_report_context_with_use_case(current_user: dict, filters: dict | None, use_case: GetReportContextUseCase) -> dict:
    return use_case(GetReportContextCommand(current_user, filters or {}))

