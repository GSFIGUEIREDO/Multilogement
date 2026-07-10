from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from http import HTTPStatus

from src.climaparc.auth.application.commands import ConfirmPasswordResetCommand
from src.climaparc.auth.domain.repositories import (
    AuthUserRepository,
    PasswordResetRequestRepository,
    PasswordResetTokenRepository,
    StateRepository,
)
from src.climaparc.shared.domain.errors import ApplicationError


class ConfirmPasswordResetUseCase:
    def __init__(
        self,
        auth_user_repository: AuthUserRepository,
        password_reset_token_repository: PasswordResetTokenRepository,
        password_reset_request_repository: PasswordResetRequestRepository,
        state_repository: StateRepository,
    ):
        self.auth_user_repository = auth_user_repository
        self.password_reset_token_repository = password_reset_token_repository
        self.password_reset_request_repository = password_reset_request_repository
        self.state_repository = state_repository

    def __call__(self, command: ConfirmPasswordResetCommand) -> dict:
        token = str(command.token or "").strip()
        if not token:
            raise ApplicationError("Lien de reinitialisation invalide.")
        if command.password != command.confirm_password:
            raise ApplicationError("Les mots de passe ne correspondent pas.")
        if len(str(command.password or "")) < 8:
            raise ApplicationError("Le mot de passe doit contenir au moins 8 caracteres.")

        hashed = hashlib.sha256(token.encode("utf-8")).hexdigest()
        reset_token = self.password_reset_token_repository.get_by_hash(hashed)
        if not reset_token or reset_token.get("status") != "active" or self._expired(reset_token.get("expires_at_text")):
            if reset_token:
                self.password_reset_token_repository.mark(hashed, "expire")
            raise ApplicationError("Lien expire ou invalide.", HTTPStatus.BAD_REQUEST)

        state = self.state_repository.get() or command.fallback_state or {}
        user = self.auth_user_repository.get_by_id(reset_token["user_id"])
        if not user:
            raise ApplicationError("Compte introuvable.", HTTPStatus.NOT_FOUND)
        self.auth_user_repository.upsert({
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "clientId": user.get("client_id"),
            "password": command.password,
        })
        used_at = datetime.now(timezone.utc).isoformat()
        self.password_reset_token_repository.mark(hashed, "utilise")
        self.password_reset_request_repository.mark(reset_token.get("reset_id", ""), "utilise", used_at)
        return {"ok": True, "state": state}

    @staticmethod
    def _expired(value: str | None) -> bool:
        if not value:
            return True
        try:
            return datetime.fromisoformat(value) < datetime.now(timezone.utc)
        except ValueError:
            return True
