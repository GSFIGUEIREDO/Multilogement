from __future__ import annotations

from typing import Protocol


class SettingsConflictError(Exception):
    pass


class SettingsStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...


class SettingsPayloadRepository(Protocol):
    def upsert(self, collection_key: str, item: dict, expected_server_updated_at: str = "") -> None:
        ...

    def delete(self, collection_key: str, item_id: str) -> None:
        ...
