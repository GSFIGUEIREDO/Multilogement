from __future__ import annotations

import copy
from http import HTTPStatus
from typing import Any

from .database import connect, row_get
from .repositories import AuthUserRepository, EquipmentRepository, PayloadTableRepository, StateRepository, clean_public_user, stamp_payload
from .security import AuthorizationError, filter_state_for_user, has_client_right, requester_from_state, require_can_save_collection


class ServiceError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status = status


class EquipmentService:
    def __init__(self, state_repository: StateRepository | None = None, equipment_repository: EquipmentRepository | None = None):
        self.state_repository = state_repository or StateRepository()
        self.equipment_repository = equipment_repository or EquipmentRepository()

    def save(self, current_user_row: Any, equipment_payload: dict | None = None) -> dict:
        if equipment_payload is None:
            equipment_payload = current_user_row
            current_user_row = None
        if not isinstance(equipment_payload, dict) or not equipment_payload.get("id"):
            raise ServiceError("Machine invalide.")

        equipment = stamp_payload(equipment_payload)
        with connect() as connection:
            state = self.state_repository.get(connection, lock=True)
            if not state:
                raise ServiceError("Etat introuvable.")
            if current_user_row:
                self._authorize(state, current_user_row, equipment)

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
    def _authorize(state: dict, current_user_row: Any, equipment: dict) -> None:
        try:
            require_can_save_collection(state, current_user_row, "equipment", equipment)
        except AuthorizationError as error:
            raise ServiceError(str(error), HTTPStatus.FORBIDDEN)

    @staticmethod
    def _clear_ui_state(state: dict) -> None:
        state["sessionUserId"] = None
        state["modal"] = None
        state["toast"] = ""


class CollectionItemService:
    collection_key = ""
    entity_label = "Element"
    table = ""
    column_map: list[tuple[str, str]] = []

    def __init__(self, state_repository: StateRepository | None = None, payload_repository: PayloadTableRepository | None = None):
        self.state_repository = state_repository or StateRepository()
        self.payload_repository = payload_repository or PayloadTableRepository(self.table, self.column_map)

    def save(self, current_user_row: Any, payload: dict | None = None) -> dict:
        if payload is None:
            payload = current_user_row
            current_user_row = None
        if not isinstance(payload, dict) or not payload.get("id"):
            raise ServiceError(f"{self.entity_label} invalide.")
        item = stamp_payload(payload)
        with connect() as connection:
            state = self.state_repository.get(connection, lock=True)
            if not state:
                raise ServiceError("Etat introuvable.")
            if current_user_row:
                self._authorize(state, current_user_row, item)
            collection = state.setdefault(self.collection_key, [])
            if not isinstance(collection, list):
                collection = []
                state[self.collection_key] = collection
            existing_index = next(
                (index for index, current in enumerate(collection) if isinstance(current, dict) and current.get("id") == item["id"]),
                -1,
            )
            if existing_index >= 0:
                collection[existing_index] = item
            else:
                collection.insert(0, item)
            self._clear_ui_state(state)
            self.payload_repository.upsert(connection, item)
            self.state_repository.save(connection, state)
        return {"ok": True, "state": state, "item": item}

    def _authorize(self, state: dict, current_user_row: Any, item: dict) -> None:
        try:
            require_can_save_collection(state, current_user_row, self.collection_key, item)
        except AuthorizationError as error:
            raise ServiceError(str(error), HTTPStatus.FORBIDDEN)

    @staticmethod
    def _clear_ui_state(state: dict) -> None:
        state["sessionUserId"] = None
        state["modal"] = None
        state["toast"] = ""


class BuildingService(CollectionItemService):
    collection_key = "buildings"
    entity_label = "Lieu"
    table = "climaparc_buildings"
    column_map = [
        ("client_id", "clientId"),
        ("name", "name"),
        ("address", "address"),
        ("onsite_contact_name", "onsiteContactName"),
        ("onsite_contact_email", "onsiteContactEmail"),
        ("billing_contact_name", "billingContactName"),
        ("billing_contact_email", "billingContactEmail"),
    ]


class ApartmentService(CollectionItemService):
    collection_key = "apartments"
    entity_label = "Appartement"
    table = "climaparc_apartments"
    column_map = [
        ("building_id", "buildingId"),
        ("number", "number"),
        ("occupant", "occupant"),
    ]


class TicketService(CollectionItemService):
    collection_key = "tickets"
    entity_label = "Demande client"
    table = "climaparc_tickets"
    column_map = [
        ("number", "number"),
        ("client_id", "clientId"),
        ("building_id", "buildingId"),
        ("apartment_id", "apartmentId"),
        ("equipment_id", "equipmentId"),
        ("title", "title"),
        ("priority", "priority"),
        ("status", "status"),
        ("service_type_id", "serviceTypeId"),
        ("created_at_text", "createdAt"),
        ("closed_at_text", "closedAt"),
    ]


class WorkOrderService(CollectionItemService):
    collection_key = "workOrders"
    entity_label = "Bon de travail"
    table = "climaparc_work_orders"
    column_map = [
        ("number", "number"),
        ("ticket_id", "ticketId"),
        ("building_id", "buildingId"),
        ("apartment_id", "apartmentId"),
        ("equipment_id", "equipmentId"),
        ("type_id", "typeId"),
        ("status", "status"),
        ("scheduled_date", "scheduledDate"),
        ("technician_id", "technicianId"),
    ]


class InterventionService(CollectionItemService):
    collection_key = "interventions"
    entity_label = "Intervention"
    table = "climaparc_interventions"
    column_map = [
        ("work_order_id", "workOrderId"),
        ("apartment_id", "apartmentId"),
        ("equipment_id", "equipmentId"),
        ("technician_id", "technicianId"),
        ("form_template_id", "formTemplateId"),
        ("status", "status"),
        ("activity_status", "activityStatus"),
        ("machine_status", "machineStatus"),
        ("date_text", "date"),
    ]

    def save(self, current_user_row: Any, payload: dict | None = None) -> dict:
        if payload is None:
            return super().save(current_user_row)
        if row_get(current_user_row, "role") != "client":
            return super().save(current_user_row, payload)
        if not isinstance(payload, dict) or not payload.get("id"):
            raise ServiceError("Intervention invalide.")

        with connect() as connection:
            state = self.state_repository.get(connection, lock=True)
            if not state:
                raise ServiceError("Etat introuvable.")

            requester = requester_from_state(state, current_user_row)
            if not has_client_right(requester, "recommendations"):
                raise ServiceError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

            visible = filter_state_for_user(state, current_user_row)
            if not any(item.get("id") == payload.get("id") for item in visible.get("interventions", []) if isinstance(item, dict)):
                raise ServiceError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

            collection = state.setdefault(self.collection_key, [])
            existing_index = next(
                (index for index, item in enumerate(collection) if isinstance(item, dict) and item.get("id") == payload.get("id")),
                -1,
            )
            if existing_index < 0:
                raise ServiceError("Intervention introuvable.", HTTPStatus.NOT_FOUND)

            existing = collection[existing_index]
            recommendation = existing.get("recommendation")
            incoming = payload.get("recommendation") if isinstance(payload.get("recommendation"), dict) else {}
            if not isinstance(recommendation, dict) or recommendation.get("status") != "envoyee":
                raise ServiceError("Cette recommandation ne peut pas etre modifiee.", HTTPStatus.FORBIDDEN)

            requested_status = incoming.get("status")
            allowed_statuses = {"information_demandee"}
            if has_client_right(requester, "approve_recommendations"):
                allowed_statuses.update({"approuvee", "refusee"})
            if requested_status not in allowed_statuses:
                raise ServiceError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

            safe_recommendation = copy.deepcopy(recommendation)
            safe_recommendation["status"] = requested_status
            safe_recommendation["decisionAt"] = incoming.get("decisionAt") or safe_recommendation.get("decisionAt") or ""
            safe_recommendation["decidedBy"] = requester.get("id") or ""
            if "clientComment" in incoming:
                safe_recommendation["clientComment"] = incoming.get("clientComment") or ""
            safe_recommendation["messages"] = self._merge_client_recommendation_messages(
                safe_recommendation.get("messages", []),
                incoming.get("messages", []),
            )

            item = stamp_payload(copy.deepcopy(existing))
            item["recommendation"] = safe_recommendation
            collection[existing_index] = item
            self._clear_ui_state(state)
            self.payload_repository.upsert(connection, item)
            self.state_repository.save(connection, state)

        return {"ok": True, "state": state, "item": item}

    @staticmethod
    def _merge_client_recommendation_messages(existing_messages: Any, incoming_messages: Any) -> list[dict]:
        messages = copy.deepcopy(existing_messages if isinstance(existing_messages, list) else [])
        known = {
            (str(message.get("authorRole")), str(message.get("text")))
            for message in messages
            if isinstance(message, dict)
        }
        for message in incoming_messages if isinstance(incoming_messages, list) else []:
            if not isinstance(message, dict) or message.get("authorRole") != "client":
                continue
            text = str(message.get("text") or "").strip()
            if not text or ("client", text) in known:
                continue
            safe_message = {
                "id": message.get("id") or "",
                "authorRole": "client",
                "authorName": message.get("authorName") or "Client",
                "text": text,
                "createdAt": message.get("createdAt") or "",
            }
            messages.append(safe_message)
            known.add(("client", text))
        return messages


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
                if not has_client_right(requester, "users"):
                    raise ServiceError("Droits insuffisants.", HTTPStatus.FORBIDDEN)
                user["role"] = "client"
                user["clientId"] = requester.get("clientId")
            elif requester_role not in {"administrateur", "equipe_interne"}:
                raise ServiceError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

            existing_index = next(
                (index for index, item in enumerate(users) if isinstance(item, dict) and item.get("id") == user["id"]),
                -1,
            )
            if existing_index < 0 and not str(user.get("password") or "").strip():
                raise ServiceError("Mot de passe obligatoire.")
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
            stored_user = clean_public_user(user)
            if existing_index >= 0:
                users[existing_index] = stored_user
            else:
                users.append(stored_user)

            self._clear_ui_state(state)
            self.state_repository.save(connection, state)

        return {"ok": True, "state": state, "user": stored_user}

    def delete(self, current_user_row: Any, user_id: str) -> dict:
        if not current_user_row:
            raise ServiceError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        if not user_id:
            raise ServiceError("Utilisateur invalide.")
        requester_id = row_get(current_user_row, "id")
        if user_id == requester_id:
            raise ServiceError("Vous ne pouvez pas supprimer votre propre compte.", HTTPStatus.BAD_REQUEST)

        with connect() as connection:
            state = self.state_repository.get(connection, lock=True)
            if not state:
                raise ServiceError("Etat introuvable.")

            users = state.setdefault("users", [])
            if not isinstance(users, list):
                raise ServiceError("Utilisateurs introuvables.")

            requester = self._requester_from_state_or_session(users, current_user_row)
            requester_role = requester.get("role")
            target = next((item for item in users if isinstance(item, dict) and item.get("id") == user_id), None)
            if not target:
                raise ServiceError("Utilisateur introuvable.", HTTPStatus.NOT_FOUND)

            if requester_role == "client":
                if not has_client_right(requester, "users"):
                    raise ServiceError("Droits insuffisants.", HTTPStatus.FORBIDDEN)
                if target.get("role") != "client" or target.get("clientId") != requester.get("clientId"):
                    raise ServiceError("Vous ne pouvez supprimer que les utilisateurs de votre client.", HTTPStatus.FORBIDDEN)
            elif requester_role not in {"administrateur", "equipe_interne"}:
                raise ServiceError("Droits insuffisants.", HTTPStatus.FORBIDDEN)

            state["users"] = [item for item in users if not (isinstance(item, dict) and item.get("id") == user_id)]
            self._clear_ui_state(state)
            self.auth_repository.delete(connection, user_id)
            self.state_repository.save(connection, state)

        return {"ok": True, "state": state, "deletedUserId": user_id}

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
