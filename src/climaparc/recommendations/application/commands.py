from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ClientUpdateRecommendationCommand:
    current_user: Any
    intervention_id: str
    recommendation: dict


@dataclass(frozen=True)
class InternalReviewRecommendationCommand:
    current_user: Any
    intervention_id: str
    recommendation: dict
