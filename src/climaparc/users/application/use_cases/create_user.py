from __future__ import annotations

from http import HTTPStatus

from backend.repositories import clean_public_user, stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.users.application.commands import CreateUserCommand
from src.climaparc.users.domain.policies import (
    ensure_unique_email,
    find_user_index,
    normalize_user_payload,
    prepare_user_for_requester,
    requester_from_state_or_session,
    require_user_manager,
)
from src.climaparc.users.domain.repositories import UserAccountRepository, UserStateRepository


class CreateUserUseCase:
    def __init__(self, state_repository: UserStateRepository, account_repository: UserAccountRepository):
        self.state_repository = state_repository
        self.account_repository = account_repository

    def __call__(self, command: CreateUserCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.")
        user = normalize_user_payload(command.user)
        if not str(user.get("password") or "").strip():
            raise ApplicationError("Mot de passe obligatoire.")

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.")
        users = state.setdefault("users", [])
        if not isinstance(users, list):
            users = []
            state["users"] = users

        requester = requester_from_state_or_session(users, command.current_user)
        require_user_manager(requester)
        user = prepare_user_for_requester(user, requester)
        if find_user_index(users, user["id"]) >= 0:
            raise ApplicationError("Utilisateur existe deja.", HTTPStatus.CONFLICT)
        ensure_unique_email(users, user)

        user = stamp_payload(user)
        self.account_repository.upsert(user)
        stored_user = clean_public_user(user)
        refreshed_state = self.state_repository.get() or state
        return {"ok": True, "state": filter_state_for_user(refreshed_state, command.current_user), "user": stored_user}
