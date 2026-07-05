from __future__ import annotations

from src.climaparc.places.application.commands import (
    CreateApartmentCommand,
    CreateBuildingCommand,
    UpdateApartmentCommand,
    UpdateBuildingCommand,
)
from src.climaparc.places.application.use_cases.create_apartment import CreateApartmentUseCase
from src.climaparc.places.application.use_cases.create_building import CreateBuildingUseCase
from src.climaparc.places.application.use_cases.update_apartment import UpdateApartmentUseCase
from src.climaparc.places.application.use_cases.update_building import UpdateBuildingUseCase
from src.climaparc.places.infrastructure.repositories import DatabasePlaceLookupRepository


def save_building_with_use_cases(
    current_user: dict,
    building_payload: dict | None,
    lookup_repository: DatabasePlaceLookupRepository,
    create_building_use_case: CreateBuildingUseCase,
    update_building_use_case: UpdateBuildingUseCase,
) -> dict:
    building = building_payload or {}
    building_id = str(building.get("id") or "") if isinstance(building, dict) else ""
    if building_id and lookup_repository.building_exists(building_id):
        return update_building_use_case(UpdateBuildingCommand(current_user, building))
    return create_building_use_case(CreateBuildingCommand(current_user, building))


def save_apartment_with_use_cases(
    current_user: dict,
    apartment_payload: dict | None,
    lookup_repository: DatabasePlaceLookupRepository,
    create_apartment_use_case: CreateApartmentUseCase,
    update_apartment_use_case: UpdateApartmentUseCase,
) -> dict:
    apartment = apartment_payload or {}
    apartment_id = str(apartment.get("id") or "") if isinstance(apartment, dict) else ""
    if apartment_id and lookup_repository.apartment_exists(apartment_id):
        return update_apartment_use_case(UpdateApartmentCommand(current_user, apartment))
    return create_apartment_use_case(CreateApartmentCommand(current_user, apartment))

