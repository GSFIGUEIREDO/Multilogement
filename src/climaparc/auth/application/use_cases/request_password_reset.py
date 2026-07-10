from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from backend.repositories import stamp_payload
from src.climaparc.auth.application.commands import PasswordResetRequestCommand
from src.climaparc.auth.domain.email import EmailClient
from src.climaparc.auth.domain.repositories import (
    AuthUserRepository,
    PasswordResetRequestRepository,
    PasswordResetTokenRepository,
    StateRepository,
)


class RequestPasswordResetUseCase:
    def __init__(
        self,
        auth_user_repository: AuthUserRepository,
        password_reset_token_repository: PasswordResetTokenRepository,
        password_reset_request_repository: PasswordResetRequestRepository,
        state_repository: StateRepository,
        email_client: EmailClient,
        reset_ttl_seconds: int = 3600,
    ):
        self.auth_user_repository = auth_user_repository
        self.password_reset_token_repository = password_reset_token_repository
        self.password_reset_request_repository = password_reset_request_repository
        self.state_repository = state_repository
        self.email_client = email_client
        self.reset_ttl_seconds = reset_ttl_seconds

    def __call__(self, command: PasswordResetRequestCommand) -> dict:
        email = str(command.email or "").strip().lower()
        state = self.state_repository.get() or command.fallback_state or {}
        if not email:
            return {"ok": True, "emailSent": False, "mailConfigured": self.email_client.configured, "state": state}

        reset_record = {
            "id": f"reset-{secrets.token_hex(6)}",
            "email": email,
            "createdAt": datetime.now(timezone.utc).date().isoformat(),
            "status": "nouvelle",
            "emailSent": False,
        }
        user = self.auth_user_repository.get_by_email(email)
        email_sent = False
        if user:
            token = secrets.token_urlsafe(32)
            hashed = hashlib.sha256(token.encode("utf-8")).hexdigest()
            expires_at = (datetime.now(timezone.utc) + timedelta(seconds=self.reset_ttl_seconds)).isoformat()
            reset_url = f"{command.base_url}/?resetToken={token}"
            email_sent = self.email_client.send_password_reset(email, reset_url)
            self.password_reset_token_repository.save(reset_record["id"], user["id"], email, hashed, expires_at)
            reset_record.update({
                "userId": user["id"],
                "expiresAt": expires_at,
                "status": "email_envoye" if email_sent else "email_non_configure",
                "emailSent": email_sent,
            })
        self.password_reset_request_repository.upsert(stamp_payload(reset_record))
        return {"ok": True, "emailSent": email_sent, "mailConfigured": self.email_client.configured, "state": state}
