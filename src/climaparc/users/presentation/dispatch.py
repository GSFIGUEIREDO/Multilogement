from __future__ import annotations

from src.climaparc.users.application.commands import CreateUserCommand, UpdateUserCommand
from src.climaparc.users.application.use_cases.create_user import CreateUserUseCase
from src.climaparc.users.application.use_cases.update_user import UpdateUserUseCase
from src.climaparc.users.infrastructure.repositories import DatabaseUserLookupRepository


def save_user_with_use_cases(
    current_user: dict,
    user_payload: dict | None,
    lookup_repository: DatabaseUserLookupRepository,
    create_user_use_case: CreateUserUseCase,
    update_user_use_case: UpdateUserUseCase,
) -> dict:
    user = user_payload or {}
    user_id = str(user.get("id") or "") if isinstance(user, dict) else ""
    if user_id and lookup_repository.exists_in_state(user_id):
        return update_user_use_case(UpdateUserCommand(current_user, user))
    return create_user_use_case(CreateUserCommand(current_user, user))

