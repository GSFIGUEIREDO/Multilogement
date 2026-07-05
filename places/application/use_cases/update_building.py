from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.places.application.commands import UpdateBuildingCommand
from src.climaparc.places.domain.policies import (
    clear_ui_state,
    find_item_index,
    normalize_building_payload,
    require_can_save_place,
)
from src.climaparc.places.domain.repositories import PlacePayloadRepository, PlaceStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class UpdateBuildingUseCase:
    def __init__(self, state_repository: PlaceStateRepository, payload_repository: PlacePayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: UpdateBuildingCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        building = stamp_payload(normalize_building_payload(command.building))

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.")
        buildings = state.setdefault("buildings", [])
        if not isinstance(buildings, list):
            buildings = []
            state["buildings"] = buildings
        index = find_item_index(buildings, building["id"])
        if index < 0:
            raise ApplicationError("Lieu introuvable.", HTTPStatus.NOT_FOUND)

        require_can_save_place(state, command.current_user, "buildings", building)
        buildings[index] = building
        clear_ui_state(state)
        self.payload_repository.upsert_building(building)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": building}

