from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.users.application.use_cases.create_user import CreateUserUseCase
from src.climaparc.users.application.use_cases.delete_user import DeleteUserUseCase
from src.climaparc.users.application.use_cases.update_user import UpdateUserUseCase
from src.climaparc.users.infrastructure.repositories import (
    DatabaseUserAccountRepository,
    DatabaseUserLookupRepository,
    DatabaseUserStateRepository,
)


def get_user_state_repository() -> DatabaseUserStateRepository:
    return DatabaseUserStateRepository()


def get_user_account_repository() -> DatabaseUserAccountRepository:
    return DatabaseUserAccountRepository()


def get_user_lookup_repository() -> DatabaseUserLookupRepository:
    return DatabaseUserLookupRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_create_user_use_case() -> CreateUserUseCase:
    return CreateUserUseCase(get_user_state_repository(), get_user_account_repository())


def get_update_user_use_case() -> UpdateUserUseCase:
    return UpdateUserUseCase(get_user_state_repository(), get_user_account_repository())


def get_delete_user_use_case() -> DeleteUserUseCase:
    return DeleteUserUseCase(get_user_state_repository(), get_user_account_repository())
