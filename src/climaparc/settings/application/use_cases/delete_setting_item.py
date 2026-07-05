from __future__ import annotations

from http import HTTPStatus

from backend.security import filter_state_for_user
from src.climaparc.settings.application.commands import DeleteSettingItemCommand
from src.climaparc.settings.domain.policies import (
    clear_ui_state,
    find_item_index,
    require_can_manage_settings,
    require_supported_collection,
)
from src.climaparc.settings.domain.repositories import SettingsPayloadRepository, SettingsStateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class DeleteSettingItemUseCase:
    def __init__(self, state_repository: SettingsStateRepository, payload_repository: SettingsPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: DeleteSettingItemCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        require_can_manage_settings(command.current_user)
        require_supported_collection(command.collection_key)
        item_id = str(command.item_id or "").strip()
        if not item_id:
            raise ApplicationError("Element de parametres invalide.")

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        collection = state.setdefault(command.collection_key, [])
        if not isinstance(collection, list):
            raise ApplicationError("Collection de parametres introuvable.", HTTPStatus.NOT_FOUND)
        index = find_item_index(collection, item_id)
        if index < 0:
            raise ApplicationError("Element de parametres introuvable.", HTTPStatus.NOT_FOUND)

        collection.pop(index)
        clear_ui_state(state)
        self.payload_repository.delete(command.collection_key, item_id)
        self.state_repository.save(state)
        return {
            "ok": True,
            "state": filter_state_for_user(state, command.current_user),
            "deletedItemId": item_id,
            "collectionKey": command.collection_key,
        }

