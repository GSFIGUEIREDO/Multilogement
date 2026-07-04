from __future__ import annotations

from http import HTTPStatus

from backend.security import filter_state_for_user, public_user_from_row
from src.climaparc.auth.application.commands import LoginUserCommand
from src.climaparc.auth.domain.repositories import AuthUserRepository, PasswordHasher, SessionRepository, StateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class LoginUserUseCase:
    def __init__(
        self,
        auth_user_repository: AuthUserRepository,
        session_repository: SessionRepository,
        state_repository: StateRepository,
        password_hasher: PasswordHasher,
    ):
        self.auth_user_repository = auth_user_repository
        self.session_repository = session_repository
        self.state_repository = state_repository
        self.password_hasher = password_hasher

    def __call__(self, command: LoginUserCommand) -> dict:
        email = str(command.email or "").strip().lower()
        user = self.auth_user_repository.get_by_email(email)
        if not user or not self.password_hasher.verify(command.password, user["password_hash"], user["salt"]):
            raise ApplicationError("Courriel ou mot de passe invalide.", HTTPStatus.UNAUTHORIZED)
        state = self.state_repository.get() or command.fallback_state or {}
        token = self.session_repository.create(user["id"])
        return {
            "token": token,
            "user": public_user_from_row(user),
            "state": filter_state_for_user(state, user),
        }
