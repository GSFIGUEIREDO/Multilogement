from __future__ import annotations

from typing import Protocol


class ReminderStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...


class ReminderPayloadRepository(Protocol):
    def upsert(self, reminder: dict) -> None:
        ...

    def delete(self, reminder_id: str) -> None:
        ...
