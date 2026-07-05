from __future__ import annotations

from backend.database import connect, execute
from backend.repositories import PayloadTableRepository
from backend.repositories import StateRepository as LegacyStateRepository


class DatabaseReminderStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            return self.legacy_repository.get(connection, lock=lock)

    def save(self, state: dict) -> None:
        with connect() as connection:
            self.legacy_repository.save(connection, state)


class DatabaseReminderPayloadRepository:
    def __init__(self, legacy_repository: PayloadTableRepository | None = None):
        self.legacy_repository = legacy_repository or PayloadTableRepository(
            "climaparc_reminders",
            [
                ("equipment_id", "equipmentId"),
                ("title", "title"),
                ("status", "status"),
                ("frequency_value", lambda item: item.get("frequencyValue")),
                ("frequency_unit", "frequencyUnit"),
                ("start_date", "startDate"),
                ("next_due_date", "nextDueDate"),
                ("last_work_order_id", "lastWorkOrderId"),
            ],
        )

    def upsert(self, reminder: dict) -> None:
        with connect() as connection:
            self.legacy_repository.upsert(connection, reminder)

    def delete(self, reminder_id: str) -> None:
        with connect() as connection:
            execute(connection, "delete from climaparc_reminders where id = ?", (reminder_id,))
