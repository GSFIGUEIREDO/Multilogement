from __future__ import annotations

from backend.database import connect, execute, row_get
from backend.repositories import PayloadTableRepository, decode_payload
from backend.repositories import StateRepository as LegacyStateRepository
from backend.sync_services import rel_table


REMINDERS_TABLE = "climaparc_reminders"


def load_reminders(connection) -> list[dict]:
    rows = execute(connection, f"select payload from {rel_table(REMINDERS_TABLE)} order by updated_at desc").fetchall()
    return [payload for payload in (decode_payload(row_get(row, "payload")) for row in rows) if payload]


class DatabaseReminderStateRepository:
    def __init__(self, legacy_repository: LegacyStateRepository | None = None):
        self.legacy_repository = legacy_repository or LegacyStateRepository()

    def get(self, lock: bool = False) -> dict | None:
        with connect() as connection:
            state = self.legacy_repository.get(connection, lock=False) or {}
            state["reminders"] = load_reminders(connection)
            return state


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
            execute(connection, f"delete from {rel_table(REMINDERS_TABLE)} where id = ?", (reminder_id,))
