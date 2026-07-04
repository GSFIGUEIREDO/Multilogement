from __future__ import annotations

from src.climaparc.auth.application.commands import CreateSessionCommand
from src.climaparc.auth.domain.repositories import SessionRepository


class CreateSessionUseCase:
    def __init__(self, session_repository: SessionRepository):
        self.session_repository = session_repository

    def __call__(self, command: CreateSessionCommand) -> str:
        return self.session_repository.create(command.user_id)
