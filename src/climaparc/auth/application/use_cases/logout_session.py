from __future__ import annotations

from src.climaparc.auth.application.commands import LogoutSessionCommand
from src.climaparc.auth.domain.repositories import SessionRepository


class LogoutSessionUseCase:
    def __init__(self, session_repository: SessionRepository):
        self.session_repository = session_repository

    def __call__(self, command: LogoutSessionCommand) -> dict:
        if command.session_token:
            self.session_repository.delete(command.session_token)
        return {"ok": True}
