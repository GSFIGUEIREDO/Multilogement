from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.hvac_systems.application.use_cases.create_hvac_system import CreateHvacSystemUseCase
from src.climaparc.hvac_systems.infrastructure.repositories import DatabaseHvacSystemRepository


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_create_hvac_system_use_case() -> CreateHvacSystemUseCase:
    return CreateHvacSystemUseCase(DatabaseHvacSystemRepository())
