from __future__ import annotations

import os

from src.climaparc.auth.application.use_cases.confirm_password_reset import ConfirmPasswordResetUseCase
from src.climaparc.auth.application.use_cases.create_session import CreateSessionUseCase
from src.climaparc.auth.application.use_cases.login_user import LoginUserUseCase
from src.climaparc.auth.application.use_cases.logout_session import LogoutSessionUseCase
from src.climaparc.auth.application.use_cases.read_session import ReadSessionUseCase
from src.climaparc.auth.application.use_cases.request_password_reset import RequestPasswordResetUseCase
from src.climaparc.auth.application.use_cases.signup_client import SignupClientUseCase
from src.climaparc.auth.infrastructure.email_client import SmtpEmailClient
from src.climaparc.auth.infrastructure.repositories import (
    DatabaseAuthUserRepository,
    DatabasePasswordResetTokenRepository,
    DatabaseSessionRepository,
    DatabaseStateRepository,
    Pbkdf2PasswordHasher,
)


def get_state_repository() -> DatabaseStateRepository:
    return DatabaseStateRepository()


def get_auth_user_repository() -> DatabaseAuthUserRepository:
    return DatabaseAuthUserRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_password_reset_token_repository() -> DatabasePasswordResetTokenRepository:
    return DatabasePasswordResetTokenRepository()


def get_password_hasher() -> Pbkdf2PasswordHasher:
    return Pbkdf2PasswordHasher()


def get_email_client() -> SmtpEmailClient:
    user = os.environ.get("SMTP_USER", "")
    return SmtpEmailClient(
        host=os.environ.get("SMTP_HOST", ""),
        port=int(os.environ.get("SMTP_PORT", "587")),
        user=user,
        password=os.environ.get("SMTP_PASSWORD", ""),
        sender=os.environ.get("SMTP_FROM", user or "no-reply@climaparc.ca"),
    )


def get_create_session_use_case() -> CreateSessionUseCase:
    return CreateSessionUseCase(get_session_repository())


def get_read_session_use_case() -> ReadSessionUseCase:
    return ReadSessionUseCase(get_session_repository(), get_state_repository())


def get_logout_session_use_case() -> LogoutSessionUseCase:
    return LogoutSessionUseCase(get_session_repository())


def get_login_user_use_case() -> LoginUserUseCase:
    return LoginUserUseCase(
        get_auth_user_repository(),
        get_session_repository(),
        get_state_repository(),
        get_password_hasher(),
    )


def get_signup_client_use_case() -> SignupClientUseCase:
    return SignupClientUseCase(
        get_auth_user_repository(),
        get_session_repository(),
        get_state_repository(),
    )


def get_request_password_reset_use_case() -> RequestPasswordResetUseCase:
    return RequestPasswordResetUseCase(
        get_auth_user_repository(),
        get_password_reset_token_repository(),
        get_state_repository(),
        get_email_client(),
        int(os.environ.get("CLIMAPARC_PASSWORD_RESET_TTL", "3600")),
    )


def get_confirm_password_reset_use_case() -> ConfirmPasswordResetUseCase:
    return ConfirmPasswordResetUseCase(
        get_auth_user_repository(),
        get_password_reset_token_repository(),
        get_state_repository(),
    )
