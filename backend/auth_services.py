from __future__ import annotations

from http import HTTPStatus
from http.cookies import SimpleCookie

from src.climaparc.auth.application.commands import (
    ConfirmPasswordResetCommand,
    CreateSessionCommand,
    LoginUserCommand,
    LogoutSessionCommand,
    PasswordResetRequestCommand,
    ReadSessionCommand,
    SignupClientCommand,
)
from src.climaparc.auth.presentation.dependencies import (
    get_confirm_password_reset_use_case,
    get_create_session_use_case,
    get_login_user_use_case,
    get_logout_session_use_case,
    get_read_session_use_case,
    get_request_password_reset_use_case,
    get_signup_client_use_case,
)
from src.climaparc.shared.domain.errors import ApplicationError


SESSION_COOKIE = "climaparc_session"


class AuthServiceError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status = status


class SessionService:
    def create(self, user_id: str) -> str:
        return _translate_auth_error(lambda: get_create_session_use_case()(CreateSessionCommand(user_id)))

    def read(self, cookie_header: str | None):
        result = get_read_session_use_case()(ReadSessionCommand(_session_token_from_cookie(cookie_header)))
        if not result.get("authenticated"):
            return None
        user = result.get("user")
        if isinstance(user, dict) and "client_id" not in user and "clientId" in user:
            return {**user, "client_id": user.get("clientId")}
        return user

    def logout(self, cookie_header: str | None) -> None:
        get_logout_session_use_case()(LogoutSessionCommand(_session_token_from_cookie(cookie_header)))


class AuthService:
    def login(self, email: str, password: str, fallback_state: dict | None = None) -> dict:
        return _translate_auth_error(lambda: get_login_user_use_case()(LoginUserCommand(email, password, fallback_state)))

    def signup(self, payload: dict, fallback_state: dict | None = None) -> dict:
        return _translate_auth_error(
            lambda: get_signup_client_use_case()(
                SignupClientCommand(
                    email=str(payload.get("email", "")),
                    password=str(payload.get("password", "")),
                    confirm_password=str(payload.get("confirmPassword", "")),
                    company_name=str(payload.get("companyName", "")),
                    name=str(payload.get("name", "")),
                    phone=str(payload.get("phone", "")),
                    fallback_state=fallback_state,
                )
            )
        )


class PasswordResetService:
    def request_reset(self, email: str, base_url: str, fallback_state: dict | None = None) -> dict:
        return get_request_password_reset_use_case()(PasswordResetRequestCommand(email, base_url, fallback_state))

    def confirm_reset(self, token: str, password: str, confirm_password: str, fallback_state: dict | None = None) -> dict:
        return _translate_auth_error(
            lambda: get_confirm_password_reset_use_case()(
                ConfirmPasswordResetCommand(token, password, confirm_password, fallback_state)
            )
        )


def _session_token_from_cookie(cookie_header: str | None) -> str | None:
    if not cookie_header:
        return None
    cookie = SimpleCookie()
    cookie.load(cookie_header)
    token = cookie.get(SESSION_COOKIE)
    return token.value if token else None


def _translate_auth_error(callback):
    try:
        return callback()
    except ApplicationError as error:
        raise AuthServiceError(error.message, error.status) from error
