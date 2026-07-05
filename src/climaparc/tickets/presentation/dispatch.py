from __future__ import annotations

from src.climaparc.tickets.application.commands import CreateTicketCommand, UpdateTicketCommand
from src.climaparc.tickets.application.use_cases.create_ticket import CreateTicketUseCase
from src.climaparc.tickets.application.use_cases.update_ticket import UpdateTicketUseCase
from src.climaparc.tickets.infrastructure.repositories import DatabaseTicketLookupRepository


def save_ticket_with_use_cases(
    current_user: dict,
    ticket_payload: dict | None,
    lookup_repository: DatabaseTicketLookupRepository,
    create_ticket_use_case: CreateTicketUseCase,
    update_ticket_use_case: UpdateTicketUseCase,
) -> dict:
    ticket = ticket_payload or {}
    ticket_id = str(ticket.get("id") or "") if isinstance(ticket, dict) else ""
    if ticket_id and lookup_repository.exists(ticket_id):
        return update_ticket_use_case(UpdateTicketCommand(current_user, ticket))
    return create_ticket_use_case(CreateTicketCommand(current_user, ticket))

