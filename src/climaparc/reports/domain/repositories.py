from __future__ import annotations

from typing import Protocol


class ReportsDataRepository(Protocol):
    def get_report_data(self) -> dict:
        ...
