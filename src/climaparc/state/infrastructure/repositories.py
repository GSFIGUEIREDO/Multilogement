from __future__ import annotations

from typing import Callable

from backend.bootstrap import sync_users
from backend.database import connect
from backend.repositories import StateRepository
from backend.sync_services import sync_relational_tables_safely


class DatabaseStateCompatibilityRepository:
    def __init__(self, state_repository: StateRepository | None = None):
        self.state_repository = state_repository or StateRepository()

    def update_with_lock(self, updater: Callable[[dict], tuple[dict, set[str] | None]]) -> tuple[dict, set[str] | None]:
        with connect() as connection:
            current_state = self.state_repository.get(connection, lock=True) or {}
            merged_state, sync_keys = updater(current_state)
            self.state_repository.save(connection, merged_state)
            sync_users(connection, merged_state)
            return merged_state, sync_keys

    def sync_relational_tables_safely(self, state: dict, collection_keys: set[str] | None = None) -> None:
        sync_relational_tables_safely(state, collection_keys)
