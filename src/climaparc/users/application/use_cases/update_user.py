from __future__ import annotations

from http import HTTPStatus

from backend.repositories import clean_public_user, stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.users.application.commands import UpdateUserCommand
from src.climaparc.users.domain.policies import (
    clear_ui_state,
    ensure_client_can_update_target,
    ensure_unique_email,
    find_user_index,
    normalize_user_payload,
    prepare_user_for_requester,
    requester_from_state_or_session,
    require_user_manager,
)
from src.climaparc.users.domain.repositories import AuthUserRepository, UserStateRepository


class UpdateUserUseCase:
    def __init__(self, state_repository: UserStateRepository, auth_repository: AuthUserRepository):
        self.state_repository = state_repository
        self.auth_repository = auth_repository

    def __call__(self, command: UpdateUserCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        user = normalize_user_payload(command.user)

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.")
        users = state.setdefault("users", [])
        if not isinstance(users, list):
            users = []
            state["users"] = users

        requester = requester_from_state_or_session(users, command.current_user)
        require_user_manager(requester)
        existing_index = find_user_index(users, user["id"])
        if existing_index < 0:
            raise ApplicationError("Utilisateur introuvable.", HTTPStatus.NOT_FOUND)

        ensure_client_can_update_target(requester, users[existing_index])
        user = prepare_user_for_requester(user, requester)
        ensure_unique_email(users, user)

        user = stamp_payload(user)
        self.auth_repository.upsert(user)
        stored_user = clean_public_user(user)
        users[existing_index] = stored_user
        clear_ui_state(state)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "user": stored_user}

