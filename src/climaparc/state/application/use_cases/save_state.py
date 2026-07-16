from __future__ import annotations

from http import HTTPStatus

from backend.database import row_get
from backend.security import filter_state_for_user, sanitize_state_for_storage
from backend.state_compatibility import (
    apply_state_changes,
    changed_collection_keys,
    conflicting_state_change,
    duplicate_user_email,
    merge_shared_state,
    stamp_changed_items,
)
from src.climaparc.shared.domain.errors import ApplicationError
from src.climaparc.state.application.commands import SaveStateCommand
from src.climaparc.state.domain.repositories import StateCompatibilityRepository


class SaveStateUseCase:
    def __init__(self, repository: StateCompatibilityRepository):
        self.repository = repository

    def __call__(self, command: SaveStateCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        if row_get(command.current_user, "role") not in {"administrateur", "equipe_interne"}:
            raise ApplicationError("Droits insuffisants pour la sauvegarde globale.", HTTPStatus.FORBIDDEN)
        if not isinstance(command.state, dict) and not isinstance(command.changes, dict):
            raise ApplicationError("Invalid state", HTTPStatus.BAD_REQUEST)

        changes = command.changes if isinstance(command.changes, dict) else None
        merged_state, sync_keys = self.repository.update_with_lock(lambda current_state: self._merge_state(current_state, command.state, changes))

        return {"ok": True, "state": filter_state_for_user(merged_state, command.current_user)}

    @staticmethod
    def _merge_state(current_state: dict, incoming_state: dict | None, changes: dict | None) -> tuple[dict, set[str] | None]:
        if changes:
            conflict = conflicting_state_change(current_state, changes)
            if conflict:
                raise ApplicationError(
                    "Ces donnees ont ete modifiees par une autre personne. Rechargez la page avant de continuer.",
                    HTTPStatus.CONFLICT,
                )
            merged_state = apply_state_changes(current_state, changes)
            sync_keys = changed_collection_keys(changes)
        else:
            clean_incoming_state = dict(incoming_state or {})
            clean_incoming_state["sessionUserId"] = None
            clean_incoming_state["modal"] = None
            clean_incoming_state["toast"] = ""
            merged_state = merge_shared_state(current_state, clean_incoming_state)
            sync_keys = None

        merged_state["sessionUserId"] = None
        merged_state["modal"] = None
        merged_state["toast"] = ""
        stamp_changed_items(merged_state, changes)
        merged_state = sanitize_state_for_storage(merged_state)

        duplicate_email = duplicate_user_email(merged_state)
        if duplicate_email:
            raise ApplicationError(f"Un utilisateur existe deja avec le courriel {duplicate_email}.", HTTPStatus.CONFLICT)
        return merged_state, sync_keys
