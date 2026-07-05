from __future__ import annotations

from http import HTTPStatus

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.tickets.application.commands import UpdateTicketCommand
from src.climaparc.tickets.domain.policies import clear_ui_state, find_ticket_index, normalize_ticket_payload, require_can_save_ticket
from src.climaparc.tickets.domain.repositories import TicketPayloadRepository, TicketStateRepository


class UpdateTicketUseCase:
    def __init__(self, state_repository: TicketStateRepository, payload_repository: TicketPayloadRepository):
        self.state_repository = state_repository
        self.payload_repository = payload_repository

    def __call__(self, command: UpdateTicketCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        ticket = stamp_payload(normalize_ticket_payload(command.ticket))

        state = self.state_repository.get(lock=True)
        if not state:
            raise ApplicationError("Etat introuvable.")
        tickets = state.setdefault("tickets", [])
        if not isinstance(tickets, list):
            tickets = []
            state["tickets"] = tickets
        index = find_ticket_index(tickets, ticket["id"])
        if index < 0:
            raise ApplicationError("Demande client introuvable.", HTTPStatus.NOT_FOUND)

        require_can_save_ticket(state, command.current_user, ticket)
        tickets[index] = ticket
        clear_ui_state(state)
        self.payload_repository.upsert(ticket)
        self.state_repository.save(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user), "item": ticket}

