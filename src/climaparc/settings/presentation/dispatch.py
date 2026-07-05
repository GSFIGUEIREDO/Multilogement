from __future__ import annotations

from src.climaparc.settings.application.commands import DeleteSettingItemCommand, SaveSettingItemCommand
from src.climaparc.settings.application.use_cases.delete_setting_item import DeleteSettingItemUseCase
from src.climaparc.settings.application.use_cases.save_setting_item import SaveSettingItemUseCase


def save_setting_item_with_use_case(current_user: dict, collection_key: str, item: dict | None, use_case: SaveSettingItemUseCase) -> dict:
    return use_case(SaveSettingItemCommand(current_user, collection_key, item or {}))


def delete_setting_item_with_use_case(current_user: dict, collection_key: str, item_id: str, use_case: DeleteSettingItemUseCase) -> dict:
    return use_case(DeleteSettingItemCommand(current_user, collection_key, item_id))

