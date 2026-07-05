from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.places.application.use_cases.create_apartment import CreateApartmentUseCase
from src.climaparc.places.application.use_cases.create_building import CreateBuildingUseCase
from src.climaparc.places.application.use_cases.update_apartment import UpdateApartmentUseCase
from src.climaparc.places.application.use_cases.update_building import UpdateBuildingUseCase
from src.climaparc.places.infrastructure.repositories import DatabasePlaceLookupRepository
from src.climaparc.places.presentation.dependencies import (
    get_create_apartment_use_case,
    get_create_building_use_case,
    get_place_lookup_repository,
    get_session_repository,
    get_update_apartment_use_case,
    get_update_building_use_case,
)
from src.climaparc.places.presentation.dispatch import save_apartment_with_use_cases, save_building_with_use_cases
from src.climaparc.shared.domain.errors import ApplicationError


router = APIRouter()


class SaveBuildingRequest(BaseModel):
    building: dict | None = None


class SaveApartmentRequest(BaseModel):
    apartment: dict | None = None


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


@router.post("/api/building")
def save_building(
    request: Request,
    payload: SaveBuildingRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    lookup_repository: DatabasePlaceLookupRepository = Depends(get_place_lookup_repository),
    create_building_use_case: CreateBuildingUseCase = Depends(get_create_building_use_case),
    update_building_use_case: UpdateBuildingUseCase = Depends(get_update_building_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return save_building_with_use_cases(
            current_user,
            payload.building,
            lookup_repository,
            create_building_use_case,
            update_building_use_case,
        )
    except ApplicationError as error:
        raise_http(error)


@router.post("/api/apartment")
def save_apartment(
    request: Request,
    payload: SaveApartmentRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    lookup_repository: DatabasePlaceLookupRepository = Depends(get_place_lookup_repository),
    create_apartment_use_case: CreateApartmentUseCase = Depends(get_create_apartment_use_case),
    update_apartment_use_case: UpdateApartmentUseCase = Depends(get_update_apartment_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return save_apartment_with_use_cases(
            current_user,
            payload.apartment,
            lookup_repository,
            create_apartment_use_case,
            update_apartment_use_case,
        )
    except ApplicationError as error:
        raise_http(error)

