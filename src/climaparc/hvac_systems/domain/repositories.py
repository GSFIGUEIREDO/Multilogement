from __future__ import annotations

from typing import Protocol


class HvacSystemRepository(Protocol):
    def get_state(self) -> dict | None:
        ...

    def upsert(self, system: dict) -> None:
        ...
