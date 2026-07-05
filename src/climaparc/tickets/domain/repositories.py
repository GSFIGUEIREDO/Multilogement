from __future__ import annotations

from typing import Protocol


class TicketStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...

    def save(self, state: dict) -> None:
        ...


class TicketPayloadRepository(Protocol):
    def upsert(self, ticket: dict) -> None:
        ...


class TicketLookupRepository(Protocol):
    def exists(self, ticket_id: str) -> bool:
        ...

