from __future__ import annotations

from backend.database import connect
from backend.repositories import PayloadTableRepository
from backend.repositories import StateRepository as LegacyStateRepository


class DatabaseTicketStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            return self.legacy_repository.get(connection, lock=lock)

    def save(self, state: dict) -> None:
        with connect() as connection:
            self.legacy_repository.save(connection, state)


class DatabaseTicketPayloadRepository:
    def __init__(self, legacy_repository: PayloadTableRepository | None = None):
        self.legacy_repository = legacy_repository or PayloadTableRepository(
            "climaparc_tickets",
            [
                ("number", "number"),
                ("client_id", "clientId"),
                ("building_id", "buildingId"),
                ("apartment_id", "apartmentId"),
                ("equipment_id", "equipmentId"),
                ("title", "title"),
                ("priority", "priority"),
                ("status", "status"),
                ("service_type_id", "serviceTypeId"),
                ("created_at_text", "createdAt"),
                ("closed_at_text", "closedAt"),
            ],
        )

    def upsert(self, ticket: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, ticket)


class DatabaseTicketLookupRepository:
    def __init__(self, state_repository: DatabaseTicketStateRepository | None = None):
        self.state_repository = state_repository or DatabaseTicketStateRepository()

    def exists(self, ticket_id: str) -> bool:
        state = self.state_repository.get(lock=False) or {}
        return any(item.get("id") == ticket_id for item in state.get("tickets", []) if isinstance(item, dict))

