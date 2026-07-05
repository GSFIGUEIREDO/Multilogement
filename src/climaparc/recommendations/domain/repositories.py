from __future__ import annotations

from typing import Protocol


class RecommendationStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...

    def save(self, state: dict) -> None:
        ...


class RecommendationPayloadRepository(Protocol):
    def upsert_intervention(self, intervention: dict) -> None:
        ...
