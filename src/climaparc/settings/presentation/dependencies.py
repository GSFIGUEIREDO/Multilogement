from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.settings.application.use_cases.delete_setting_item import DeleteSettingItemUseCase
from src.climaparc.settings.application.use_cases.save_setting_item import SaveSettingItemUseCase
from src.climaparc.settings.infrastructure.repositories import DatabaseSettingsPayloadRepository, DatabaseSettingsStateRepository


def get_settings_state_repository() -> DatabaseSettingsStateRepository:
    return DatabaseSettingsStateRepository()


def get_settings_payload_repository() -> DatabaseSettingsPayloadRepository:
    return DatabaseSettingsPayloadRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_save_setting_item_use_case() -> SaveSettingItemUseCase:
    return SaveSettingItemUseCase(get_settings_state_repository(), get_settings_payload_repository())


def get_delete_setting_item_use_case() -> DeleteSettingItemUseCase:
    return DeleteSettingItemUseCase(get_settings_state_repository(), get_settings_payload_repository())

