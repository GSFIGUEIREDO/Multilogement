from __future__ import annotations

from backend.database import connect
from backend.repositories import PayloadTableRepository
from backend.repositories import StateRepository as LegacyStateRepository


class DatabasePlaceStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            return self.legacy_repository.get(connection, lock=lock)

    def save(self, state: dict) -> None:
        with connect() as connection:
            self.legacy_repository.save(connection, state)


class DatabasePlacePayloadRepository:
    def __init__(
        self,
        building_repository: PayloadTableRepository | None = None,
        apartment_repository: PayloadTableRepository | None = None,
    ):
        self.building_repository = building_repository or PayloadTableRepository(
            "climaparc_buildings",
            [
                ("client_id", "clientId"),
                ("name", "name"),
                ("address", "address"),
                ("onsite_contact_name", "onsiteContactName"),
                ("onsite_contact_email", "onsiteContactEmail"),
                ("billing_contact_name", "billingContactName"),
                ("billing_contact_email", "billingContactEmail"),
            ],
        )
        self.apartment_repository = apartment_repository or PayloadTableRepository(
            "climaparc_apartments",
            [
                ("building_id", "buildingId"),
                ("number", "number"),
                ("occupant", "occupant"),
            ],
        )

    def upsert_building(self, building: dict) -> None:
        with connect() as connection:
            self.building_repository.upsert(connection, building)

    def upsert_apartment(self, apartment: dict) -> None:
        with connect() as connection:
            self.apartment_repository.upsert(connection, apartment)


class DatabasePlaceLookupRepository:
    def __init__(self, state_repository: DatabasePlaceStateRepository | None = None):
        self.state_repository = state_repository or DatabasePlaceStateRepository()

    def building_exists(self, building_id: str) -> bool:
        state = self.state_repository.get(lock=False) or {}
        return any(item.get("id") == building_id for item in state.get("buildings", []) if isinstance(item, dict))

    def apartment_exists(self, apartment_id: str) -> bool:
        state = self.state_repository.get(lock=False) or {}
        return any(item.get("id") == apartment_id for item in state.get("apartments", []) if isinstance(item, dict))

