from __future__ import annotations

from typing import Protocol


class InterventionStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...


class InterventionPayloadRepository(Protocol):
    def upsert(self, intervention: dict) -> None:
        ...


class InterventionLookupRepository(Protocol):
    def exists(self, intervention_id: str) -> bool:
        ...
