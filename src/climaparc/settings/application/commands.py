from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SaveSettingItemCommand:
    current_user: Any
    collection_key: str
    item: dict


@dataclass(frozen=True)
class DeleteSettingItemCommand:
    current_user: Any
    collection_key: str
    item_id: str

