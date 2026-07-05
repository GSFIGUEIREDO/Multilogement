from __future__ import annotations

from typing import Protocol


class PlaceStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...

    def save(self, state: dict) -> None:
        ...


class PlacePayloadRepository(Protocol):
    def upsert_building(self, building: dict) -> None:
        ...

    def upsert_apartment(self, apartment: dict) -> None:
        ...


class PlaceLookupRepository(Protocol):
    def building_exists(self, building_id: str) -> bool:
        ...

    def apartment_exists(self, apartment_id: str) -> bool:
        ...

