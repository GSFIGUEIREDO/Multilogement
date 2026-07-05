from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.tickets.application.use_cases.create_ticket import CreateTicketUseCase
from src.climaparc.tickets.application.use_cases.update_ticket import UpdateTicketUseCase
from src.climaparc.tickets.infrastructure.repositories import (
    DatabaseTicketLookupRepository,
    DatabaseTicketPayloadRepository,
    DatabaseTicketStateRepository,
)


def get_ticket_state_repository() -> DatabaseTicketStateRepository:
    return DatabaseTicketStateRepository()


def get_ticket_payload_repository() -> DatabaseTicketPayloadRepository:
    return DatabaseTicketPayloadRepository()


def get_ticket_lookup_repository() -> DatabaseTicketLookupRepository:
    return DatabaseTicketLookupRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_create_ticket_use_case() -> CreateTicketUseCase:
    return CreateTicketUseCase(get_ticket_state_repository(), get_ticket_payload_repository())


def get_update_ticket_use_case() -> UpdateTicketUseCase:
    return UpdateTicketUseCase(get_ticket_state_repository(), get_ticket_payload_repository())

