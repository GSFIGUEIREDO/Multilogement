from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CreateTicketCommand:
    current_user: Any
    ticket: dict


@dataclass(frozen=True)
class UpdateTicketCommand:
    current_user: Any
    ticket: dict

