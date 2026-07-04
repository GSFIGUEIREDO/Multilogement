from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.climaparc.auth.application.commands import (
    ConfirmPasswordResetCommand,
    LoginUserCommand,
    LogoutSessionCommand,
    PasswordResetRequestCommand,
    ReadSessionCommand,
    SignupClientCommand,
)
from src.climaparc.auth.application.use_cases.confirm_password_reset import ConfirmPasswordResetUseCase
from src.climaparc.auth.application.use_cases.login_user import LoginUserUseCase
from src.climaparc.auth.application.use_cases.logout_session import LogoutSessionUseCase
from src.climaparc.auth.application.use_cases.read_session import ReadSessionUseCase
from src.climaparc.auth.application.use_cases.request_password_reset import RequestPasswordResetUseCase
from src.climaparc.auth.application.use_cases.signup_client import SignupClientUseCase
from src.climaparc.auth.presentation.dependencies import (
    get_confirm_password_reset_use_case,
    get_login_user_use_case,
    get_logout_session_use_case,
    get_read_session_use_case,
    get_request_password_reset_use_case,
    get_signup_client_use_case,
)
from src.climaparc.shared.domain.errors import ApplicationError


SESSION_COOKIE = "climaparc_session"
router = APIRouter()


class LoginRequest(BaseModel):
    email: str = ""
    password: str = ""
    seed: dict | None = None


class SignupRequest(BaseModel):
    email: str = ""
    password: str = ""
    confirmPassword: str = ""
    companyName: str = ""
    name: str = ""
    phone: str = ""
    seed: dict | None = None


class PasswordResetRequest(BaseModel):
    email: str = ""
    seed: dict | None = None


class PasswordResetConfirmRequest(BaseModel):
    token: str = ""
    password: str = ""
    confirmPassword: str = ""
    seed: dict | None = None


def session_token(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE)


def public_base_url(request: Request) -> str:
    configured = os.environ.get("APP_BASE_URL", "").rstrip("/")
    if configured:
        return configured
    forwarded_proto = request.headers.get("X-Forwarded-Proto")
    scheme = forwarded_proto or request.url.scheme
    return f"{scheme}://{request.headers.get('host', request.url.netloc)}".rstrip("/")


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


@router.get("/api/session")
def read_session(
    request: Request,
    use_case: ReadSessionUseCase = Depends(get_read_session_use_case),
):
    result = use_case(ReadSessionCommand(session_token(request)))
    if not result.get("authenticated"):
        return JSONResponse({"authenticated": False}, status_code=401)
    return result


@router.post("/api/login")
def login(
    payload: LoginRequest,
    response: Response,
    use_case: LoginUserUseCase = Depends(get_login_user_use_case),
):
    try:
        result = use_case(LoginUserCommand(payload.email, payload.password, payload.seed))
    except ApplicationError as error:
        raise_http(error)
    response.set_cookie(SESSION_COOKIE, result["token"], httponly=True, path="/", samesite="lax")
    return {"user": result["user"], "state": result["state"]}


@router.post("/api/signup")
def signup(
    payload: SignupRequest,
    response: Response,
    use_case: SignupClientUseCase = Depends(get_signup_client_use_case),
):
    try:
        result = use_case(
            SignupClientCommand(
                email=payload.email,
                password=payload.password,
                confirm_password=payload.confirmPassword,
                company_name=payload.companyName,
                name=payload.name,
                phone=payload.phone,
                fallback_state=payload.seed,
            )
        )
    except ApplicationError as error:
        raise_http(error)
    response.set_cookie(SESSION_COOKIE, result["token"], httponly=True, path="/", samesite="lax")
    return {"user": result["user"], "state": result["state"]}


@router.post("/api/logout")
def logout(
    request: Request,
    response: Response,
    use_case: LogoutSessionUseCase = Depends(get_logout_session_use_case),
):
    result = use_case(LogoutSessionCommand(session_token(request)))
    response.delete_cookie(SESSION_COOKIE, path="/")
    return result


@router.post("/api/password-reset-request")
def request_password_reset(
    request: Request,
    payload: PasswordResetRequest,
    use_case: RequestPasswordResetUseCase = Depends(get_request_password_reset_use_case),
):
    result = use_case(PasswordResetRequestCommand(payload.email, public_base_url(request), payload.seed))
    return {"ok": True, "emailSent": result["emailSent"], "mailConfigured": result["mailConfigured"]}


@router.post("/api/password-reset-confirm")
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    use_case: ConfirmPasswordResetUseCase = Depends(get_confirm_password_reset_use_case),
):
    try:
        use_case(
            ConfirmPasswordResetCommand(
                token=payload.token,
                password=payload.password,
                confirm_password=payload.confirmPassword,
                fallback_state=payload.seed,
            )
        )
    except ApplicationError as error:
        raise_http(error)
    return {"ok": True}
