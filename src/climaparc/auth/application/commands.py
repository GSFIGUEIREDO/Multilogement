from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CreateSessionCommand:
    user_id: str


@dataclass(frozen=True)
class ReadSessionCommand:
    session_token: str | None


@dataclass(frozen=True)
class LogoutSessionCommand:
    session_token: str | None


@dataclass(frozen=True)
class LoginUserCommand:
    email: str
    password: str
    fallback_state: dict | None = None


@dataclass(frozen=True)
class SignupClientCommand:
    email: str
    password: str
    confirm_password: str
    company_name: str
    name: str
    phone: str = ""
    fallback_state: dict | None = None


@dataclass(frozen=True)
class PasswordResetRequestCommand:
    email: str
    base_url: str
    fallback_state: dict | None = None


@dataclass(frozen=True)
class ConfirmPasswordResetCommand:
    token: str
    password: str
    confirm_password: str
    fallback_state: dict | None = None
