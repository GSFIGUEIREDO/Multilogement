from __future__ import annotations

from http import HTTPStatus
from typing import Any

from .database import connect, row_get
from .repositories import AuthUserRepository, EquipmentRepository, StateRepository, clean_public_user, stamp_payload


class ServiceError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status = status


class EquipmentService:
    def __init__(self, state_repository: StateRepository | None = None, equipment_repository: EquipmentRepository | None = None):
        self.state_repository = state_repository or StateRepository()
        self.equipment_repository = equipment_repository or EquipmentRepository()

    def save(self, equipment_payload: dict) -> dict:
        if not isinstance(equipment_payload, dict) or not equipment_payload.get("id"):
            raise ServiceError("Machine invalide.")

        equipment = stamp_payload(equipment_payload)
        with connect() as connection:
            state = self.state_repository.get(connection, lock=True)
            if not state:
                raise ServiceError("Etat introuvable.")

            items = state.setdefault("equipment", [])
            if not isinstance(items, list):
                items = []
                state["equipment"] = items

            existing_index = next(
                (index for index, item in enumerate(items) if isinstance(item, dict) and item.get("id") == equipment["id"]),
                -1,
            )
            if existing_index >= 0:
                existing = items[existing_index]
                if isinstance(existing, dict) and existing.get("attachments") and not equipment.get("attachments"):
                    equipment["attachments"] = existing.get("attachments")
                items[existing_index] = equipment
            else:
                items.insert(0, equipment)

            self._clear_ui_state(state)
            self.equipment_repository.upsert(connection, equipment)
            self.state_repository.save(connection, state)

        return {"ok": True, "state": state, "equipment": equipment}

    @staticmethod
    def _clear_ui_state(state: dict) -> None:
        state["sessionUserId"] = None
        state["modal"] = None
        state["toast"] = ""


class UserService:
    def __init__(self, state_repository: StateRepository | None = None, auth_repository: AuthUserRepository | None = None):
        self.state_repository = state_repository or StateRepository()
        self.auth_repository = auth_repository or AuthUserRepository()

    def save(self, current_user_row: Any, user_payload: dict) -> dict:
        if not current_user_row:
            raise ServiceError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        if not isinstance(user_payload, dict) or not user_payload.get("id"):
            raise ServiceError("Utilisateur invalide.")

        user = stamp_payload(user_payload)
        user["email"] = str(user.get("email", "")).strip().lower()
        if not user["email"] or not user.get("name") or not user.get("role"):
            raise ServiceError("Nom, courriel et role sont obligatoires.")
        if not str(user.get("password") or "").strip():
            raise ServiceError("Mot de passe obligatoire.")

        with connect() as connection:
            state = self.state_repository.get(connection, lock=True)
            if not state:
                raise ServiceError("Etat introuvable.")

            users = state.setdefault("users", [])
            if not isinstance(users, list):
                users = []
                state["users"] = users

            requester = self._requester_from_state_or_session(users, current_user_row)
            requester_role = requester.get("role")
            if requester_role == "client":
                user["role"] = "client"
                user["clientId"] = requester.get("clientId")
            elif requester_role not in {"administrateur", "equipe_interne"}:
                raise ServiceError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

            existing_index = next(
                (index for index, item in enumerate(users) if isinstance(item, dict) and item.get("id") == user["id"]),
                -1,
            )
            if requester_role == "client" and existing_index >= 0:
                existing_user = users[existing_index]
                if existing_user.get("clientId") != requester.get("clientId"):
                    raise ServiceError("Vous ne pouvez modifier que les utilisateurs de votre client.", HTTPStatus.FORBIDDEN)

            duplicate_email = next(
                (
                    item for item in users
                    if isinstance(item, dict)
                    and str(item.get("email", "")).strip().lower() == user["email"]
                    and item.get("id") != user["id"]
                ),
                None,
            )
            if duplicate_email:
                raise ServiceError(f"Un utilisateur existe deja avec le courriel {user['email']}.", HTTPStatus.CONFLICT)

            self.auth_repository.upsert(connection, user)
            if existing_index >= 0:
                users[existing_index] = user
            else:
                users.append(user)

            self._clear_ui_state(state)
            self.state_repository.save(connection, state)

        return {"ok": True, "state": state, "user": clean_public_user(user)}

    @staticmethod
    def _requester_from_state_or_session(users: list, current_user_row: Any) -> dict:
        requester_id = row_get(current_user_row, "id")
        requester = next((item for item in users if isinstance(item, dict) and item.get("id") == requester_id), None)
        if requester:
            return requester
        return {
            "id": requester_id,
            "role": row_get(current_user_row, "role"),
            "clientId": row_get(current_user_row, "client_id"),
        }

    @staticmethod
    def _clear_ui_state(state: dict) -> None:
        state["sessionUserId"] = None
        state["modal"] = None
        state["toast"] = ""
