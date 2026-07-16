from __future__ import annotations

from backend.database import connect
from backend.repositories import PayloadTableRepository, StateRepository


class DatabaseHvacSystemRepository:
    def __init__(self):
        self.state_repository = StateRepository()
        self.payload_repository = PayloadTableRepository("climaparc_hvac_systems", [("client_id", "clientId"), ("building_id", "buildingId"), ("apartment_id", "apartmentId"), ("system_type_id", "systemTypeId"), ("topology", "topology"), ("brand", "brand"), ("name", "name"), ("sort_order", "sortOrder"), ("active", lambda item: item.get("active") is not False)])

    def get_state(self) -> dict | None:
        with connect() as connection:
            return self.state_repository.get(connection, lock=False)

    def upsert(self, system: dict) -> None:
        with connect() as connection:
            self.payload_repository.upsert(connection, system)
