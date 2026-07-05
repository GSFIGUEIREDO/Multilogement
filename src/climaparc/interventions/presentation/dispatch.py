from __future__ import annotations

from src.climaparc.interventions.application.commands import CreateInterventionCommand, UpdateInterventionCommand
from src.climaparc.interventions.application.use_cases.create_intervention import CreateInterventionUseCase
from src.climaparc.interventions.application.use_cases.update_intervention import UpdateInterventionUseCase
from src.climaparc.interventions.infrastructure.repositories import DatabaseInterventionLookupRepository


def save_intervention_with_use_cases(
    current_user: dict,
    intervention_payload: dict | None,
    lookup_repository: DatabaseInterventionLookupRepository,
    create_intervention_use_case: CreateInterventionUseCase,
    update_intervention_use_case: UpdateInterventionUseCase,
) -> dict:
    intervention = intervention_payload or {}
    intervention_id = str(intervention.get("id") or "") if isinstance(intervention, dict) else ""
    if intervention_id and lookup_repository.exists(intervention_id):
        return update_intervention_use_case(UpdateInterventionCommand(current_user, intervention))
    return create_intervention_use_case(CreateInterventionCommand(current_user, intervention))
