from __future__ import annotations

from typing import Protocol


class RecommendationStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...


class RecommendationPayloadRepository(Protocol):
    def upsert_intervention(self, intervention: dict) -> None:
        ...

    def upsert_intervention_with_targets(self, intervention: dict, targets: list[dict]) -> None:
        ...


class RecommendationWorkflowRepository(Protocol):
    def get_state(self) -> dict | None:
        ...

    def upsert_intervention(self, intervention: dict) -> None:
        ...

    def save_approval_with_work_order(self, intervention: dict, work_order: dict) -> None:
        ...

    def save_route(self, intervention: dict, work_order: dict, target: dict) -> None:
        ...
