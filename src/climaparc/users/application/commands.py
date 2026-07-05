from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CreateUserCommand:
    current_user: Any
    user: dict


@dataclass(frozen=True)
class UpdateUserCommand:
    current_user: Any
    user: dict


@dataclass(frozen=True)
class DeleteUserCommand:
    current_user: Any
    user_id: str

