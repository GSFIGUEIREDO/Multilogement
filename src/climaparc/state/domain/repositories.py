from __future__ import annotations

from typing import Callable, Protocol


class StateCompatibilityRepository(Protocol):
    def update_with_lock(self, updater: Callable[[dict], tuple[dict, set[str] | None]]) -> tuple[dict, set[str] | None]:
        ...

    def sync_relational_tables_safely(self, state: dict, collection_keys: set[str] | None = None) -> None:
        ...
