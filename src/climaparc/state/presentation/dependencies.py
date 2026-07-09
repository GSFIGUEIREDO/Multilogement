from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.state.application.use_cases.save_state import SaveStateUseCase
from src.climaparc.state.infrastructure.repositories import DatabaseStateCompatibilityRepository


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_state_compatibility_repository() -> DatabaseStateCompatibilityRepository:
    return DatabaseStateCompatibilityRepository()


def get_save_state_use_case() -> SaveStateUseCase:
    return SaveStateUseCase(get_state_compatibility_repository())

