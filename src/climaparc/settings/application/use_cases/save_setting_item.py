from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.settings.application.commands import SaveSettingItemCommand
from src.climaparc.settings.domain.policies import (
    clear_ui_state,
    find_item_index,
    normalize_setting_item,
    require_can_manage_settings,
)
from src.climaparc.settings.domain.repositories import SettingsPayloadRepository, SettingsStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class SaveSettingItemUseCase:
    def __init__(self, state_repository: SettingsStateRepository, payload_repository: SettingsPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: SaveSettingItemCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        require_can_manage_settings(command.current_user)
        item = stamp_payload(normalize_setting_item(command.collection_key, command.item))

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        collection = state.setdefault(command.collection_key, [])
        if not isinstance(collection, list):
            collection = []
            state[command.collection_key] = collection
        index = find_item_index(collection, item["id"])
        if index >= 0:
            collection[index] = item
        else:
            collection.append(item)

        clear_ui_state(state)
        self.payload_repository.upsert(command.collection_key, item)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": item}

