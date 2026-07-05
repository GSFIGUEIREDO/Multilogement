from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.places.application.use_cases.create_apartment import CreateApartmentUseCase
from src.climaparc.places.application.use_cases.create_building import CreateBuildingUseCase
from src.climaparc.places.application.use_cases.update_apartment import UpdateApartmentUseCase
from src.climaparc.places.application.use_cases.update_building import UpdateBuildingUseCase
from src.climaparc.places.infrastructure.repositories import (
    DatabasePlaceLookupRepository,
    DatabasePlacePayloadRepository,
    DatabasePlaceStateRepository,
)


def get_place_state_repository() -> DatabasePlaceStateRepository:
    return DatabasePlaceStateRepository()


def get_place_payload_repository() -> DatabasePlacePayloadRepository:
    return DatabasePlacePayloadRepository()


def get_place_lookup_repository() -> DatabasePlaceLookupRepository:
    return DatabasePlaceLookupRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_create_building_use_case() -> CreateBuildingUseCase:
    return CreateBuildingUseCase(get_place_state_repository(), get_place_payload_repository())


def get_update_building_use_case() -> UpdateBuildingUseCase:
    return UpdateBuildingUseCase(get_place_state_repository(), get_place_payload_repository())


def get_create_apartment_use_case() -> CreateApartmentUseCase:
    return CreateApartmentUseCase(get_place_state_repository(), get_place_payload_repository())


def get_update_apartment_use_case() -> UpdateApartmentUseCase:
    return UpdateApartmentUseCase(get_place_state_repository(), get_place_payload_repository())

