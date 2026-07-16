from __future__ import annotations

from typing import Protocol


class WorkOrderStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...


class WorkOrderPayloadRepository(Protocol):
    def upsert(self, work_order: dict) -> None:
        ...


class WorkOrderLookupRepository(Protocol):
    def exists(self, work_order_id: str) -> bool:
        ...


class WorkOrderOperationRepository(Protocol):
    def get_state(self) -> dict | None:
        ...

    def save_completion(self, work_order: dict, targets: list[dict], audit: dict) -> None:
        ...
