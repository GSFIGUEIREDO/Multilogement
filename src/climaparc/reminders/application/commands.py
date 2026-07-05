from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SaveReminderCommand:
    current_user: Any
    reminder: dict


@dataclass(frozen=True)
class SaveReminderBatchCommand:
    current_user: Any
    reminders: list[dict]


@dataclass(frozen=True)
class DeleteReminderCommand:
    current_user: Any
    reminder_id: str
