from __future__ import annotations

from backend.security import filter_state_for_user, public_user_from_row
from src.climaparc.auth.application.commands import ReadSessionCommand
from src.climaparc.auth.domain.repositories import SessionRepository, StateRepository


class ReadSessionUseCase:
    def __init__(self, session_repository: SessionRepository, state_repository: StateRepository):
        self.session_repository = session_repository
        self.state_repository = state_repository

    def __call__(self, command: ReadSessionCommand) -> dict:
        if not command.session_token:
            return {"authenticated": False}
        user = self.session_repository.get_user_by_token(command.session_token)
        if not user:
            return {"authenticated": False}
        state = self.state_repository.get() or {}
        return {
            "authenticated": True,
            "user": public_user_from_row(user),
            "state": filter_state_for_user(state, user),
        }
