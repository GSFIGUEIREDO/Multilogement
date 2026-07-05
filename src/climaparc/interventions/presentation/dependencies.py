from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.interventions.application.use_cases.create_intervention import CreateInterventionUseCase
from src.climaparc.interventions.application.use_cases.update_intervention import UpdateInterventionUseCase
from src.climaparc.interventions.infrastructure.repositories import (
    DatabaseInterventionLookupRepository,
    DatabaseInterventionPayloadRepository,
    DatabaseInterventionStateRepository,
)
from src.climaparc.recommendations.presentation.dependencies import get_client_update_recommendation_use_case


def get_intervention_state_repository() -> DatabaseInterventionStateRepository:
    return DatabaseInterventionStateRepository()


def get_intervention_payload_repository() -> DatabaseInterventionPayloadRepository:
    return DatabaseInterventionPayloadRepository()


def get_intervention_lookup_repository() -> DatabaseInterventionLookupRepository:
    return DatabaseInterventionLookupRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_create_intervention_use_case() -> CreateInterventionUseCase:
    return CreateInterventionUseCase(get_intervention_state_repository(), get_intervention_payload_repository())


def get_update_intervention_use_case() -> UpdateInterventionUseCase:
    return UpdateInterventionUseCase(
        get_intervention_state_repository(),
        get_intervention_payload_repository(),
        get_client_update_recommendation_use_case(),
    )
