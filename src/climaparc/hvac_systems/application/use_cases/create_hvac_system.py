from __future__ import annotations

from backend.repositories import stamp_payload
from backend.security import filter_state_for_user
from src.climaparc.hvac_systems.application.commands import CreateHvacSystemCommand
from src.climaparc.hvac_systems.domain.policies import normalize_hvac_system, require_can_manage_hvac_system
from src.climaparc.hvac_systems.domain.repositories import HvacSystemRepository
from src.climaparc.shared.domain.errors import ApplicationError


class CreateHvacSystemUseCase:
    def __init__(self, repository: HvacSystemRepository):
        self.repository = repository

    def __call__(self, command: CreateHvacSystemCommand) -> dict:
        state = self.repository.get_state() or {}
        system = normalize_hvac_system(state, command.system)
        if any(item.get("id") == system["id"] for item in state.get("hvacSystems", []) if isinstance(item, dict)):
            raise ApplicationError("Systeme HVAC existe deja.", 409)
        require_can_manage_hvac_system(state, command.current_user, system, command.work_order_id)
        system = stamp_payload(system)
        self.repository.upsert(system)
        fresh = self.repository.get_state() or state
        return {"ok": True, "state": filter_state_for_user(fresh, command.current_user), "system": system}
