from __future__ import annotations

from http import HTTPStatus

from backend.database import row_get
from backend.security import filter_state_for_user
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.users.application.commands import DeleteUserCommand
from src.climaparc.users.domain.policies import (
    clear_ui_state,
    ensure_client_can_delete_target,
    requester_from_state_or_session,
    require_user_manager,
)
from src.climaparc.users.domain.repositories import AuthUserRepository, UserStateRepository


class DeleteUserUseCase:
    def __init__(self, state_repository: UserStateRepository, auth_repository: AuthUserRepository):
        self.state_repository = state_repository
        self.auth_repository = auth_repository

    def __call__(self, command: DeleteUserCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        user_id = str(command.user_id or "")
        if not user_id:
            raise ApplicationError("Utilisateur invalide.")
        if user_id == row_get(command.current_user, "id"):
            raise ApplicationError("Vous ne pouvez pas supprimer votre propre compte.")

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.")
        users = state.setdefault("users", [])
        if not isinstance(users, list):
            raise ApplicationError("Utilisateurs introuvables.")

        requester = requester_from_state_or_session(users, command.current_user)
        require_user_manager(requester)
        target = next((item for item in users if isinstance(item, dict) and item.get("id") == user_id), None)
        if not target:
            raise ApplicationError("Utilisateur introuvable.", HTTPStatus.NOT_FOUND)
        ensure_client_can_delete_target(requester, target)

        state["users"] = [item for item in users if not (isinstance(item, dict) and item.get("id") == user_id)]
        clear_ui_state(state)
        self.auth_repository.delete(user_id)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "deletedUserId": user_id}

