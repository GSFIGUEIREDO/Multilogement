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
