from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.places.application.commands import UpdateApartmentCommand
from src.climaparc.places.domain.policies import (
    clear_ui_state,
    ensure_building_exists,
    find_item_index,
    normalize_apartment_payload,
    require_can_save_place,
)
from src.climaparc.places.domain.repositories import PlacePayloadRepository, PlaceStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class UpdateApartmentUseCase:
    def __init__(self, state_repository: PlaceStateRepository, payload_repository: PlacePayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: UpdateApartmentCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        apartment = stamp_payload(normalize_apartment_payload(command.apartment))

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.")
        ensure_building_exists(state, apartment["buildingId"])
        apartments = state.setdefault("apartments", [])
        if not isinstance(apartments, list):
            apartments = []
            state["apartments"] = apartments
        index = find_item_index(apartments, apartment["id"])
        if index < 0:
            raise ApplicationError("Appartement introuvable.", HTTPStatus.NOT_FOUND)

        require_can_save_place(state, command.current_user, "apartments", apartment)
        apartments[index] = apartment
        clear_ui_state(state)
        self.payload_repository.upsert_apartment(apartment)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": apartment}

