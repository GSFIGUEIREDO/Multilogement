from __future__ import annotations

from typing import Protocol


class EmailClient(Protocol):
    @property
    def configured(self) -> bool:
        ...

    def send_password_reset(self, email: str, reset_url: str) -> bool:
        ...
