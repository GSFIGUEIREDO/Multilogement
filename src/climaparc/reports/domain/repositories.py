from __future__ import annotations

from typing import Protocol


class ReportsStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...

