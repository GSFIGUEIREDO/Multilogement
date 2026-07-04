from __future__ import annotations

import secrets
from http import HTTPStatus

from backend.security import filter_state_for_user, public_user
from src.climaparc.auth.application.commands import SignupClientCommand
from src.climaparc.auth.domain.repositories import AuthUserRepository, SessionRepository, StateRepository
from src.climaparc.shared.domain.errors import ApplicationError


class SignupClientUseCase:
    def __init__(
        self,
        auth_user_repository: AuthUserRepository,
        session_repository: SessionRepository,
        state_repository: StateRepository,
    ):
        self.auth_user_repository = auth_user_repository
        self.session_repository = session_repository
        self.state_repository = state_repository

    def __call__(self, command: SignupClientCommand) -> dict:
        email = str(command.email or "").strip().lower()
        password = str(command.password or "")
        company_name = str(command.company_name or "").strip()
        name = str(command.name or "").strip()
        if not email or not password or not company_name or not name:
            raise ApplicationError("Tous les champs obligatoires doivent etre remplis.")
        if password != str(command.confirm_password or ""):
            raise ApplicationError("Les mots de passe ne correspondent pas.")
        if len(password) < 8:
            raise ApplicationError("Le mot de passe doit contenir au moins 8 caracteres.")
        if self.auth_user_repository.get_by_email(email):
            raise ApplicationError("Un compte existe deja avec ce courriel.", HTTPStatus.CONFLICT)

        state = self.state_repository.get(lock=True) or command.fallback_state or {}
        client = {
            "id": f"client-{secrets.token_hex(6)}",
            "name": company_name,
            "contact": name,
            "email": email,
            "phone": str(command.phone or "").strip(),
        }
        user = {
            "id": f"u-{secrets.token_hex(6)}",
            "name": name,
            "email": email,
            "password": password,
            "role": "client",
            "clientId": client["id"],
        }
        state.setdefault("clients", []).append(client)
        state.setdefault("users", []).append(public_user(user))
        self.auth_user_repository.upsert(user)
        self.state_repository.save(state)
        token = self.session_repository.create(user["id"])
        user_public = public_user(user)
        return {
            "token": token,
            "client": client,
            "user": user_public,
            "state": filter_state_for_user(state, user_public),
        }
