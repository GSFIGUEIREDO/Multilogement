from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.places.application.commands import CreateBuildingCommand
from src.climaparc.places.domain.policies import (
    clear_ui_state,
    find_item_index,
    normalize_building_payload,
    require_can_save_place,
)
from src.climaparc.places.domain.repositories import PlacePayloadRepository, PlaceStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class CreateBuildingUseCase:
    def __init__(self, state_repository: PlaceStateRepository, payload_repository: PlacePayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: CreateBuildingCommand) -> dict:
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
        if find_item_index(buildings, building["id"]) >= 0:
            raise ApplicationError("Lieu existe deja.", HTTPStatus.CONFLICT)

        require_can_save_place(state, command.current_user, "buildings", building)
        buildings.insert(0, building)
        clear_ui_state(state)
        self.payload_repository.upsert_building(building)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": building}

