from __future__ import annotations

from http import HTTPStatus
from typing import Any

from backend.database import row_get, server_timestamp
from backend.file_storage import (
    ATTACHMENT_MAX_BYTES,
    DOCUMENT_MAX_BYTES,
    STORAGE_BUCKET,
    FileStorageError,
    find_file_record,
    guessed_mime,
    public_file_metadata,
    safe_filename,
    storage_path_for,
    utc_today,
    validate_file,
)
from backend.security import (
    AuthorizationError,
    filter_state_for_user,
    requester_from_state,
    require_can_save_collection,
    technician_scopes,
)
from src.climaparc.shared.domain.errors import ApplicationError


def convert_file_error(error: FileStorageError) -> ApplicationError:
    return ApplicationError(error.message, error.status)


def normalize_file_id(file_id: str) -> str:
    value = str(file_id or "").strip()
    if not value:
        raise ApplicationError("Fichier introuvable.", HTTPStatus.BAD_REQUEST)
    return value


def build_document_metadata(
    state: dict,
    current_user_row: Any,
    fields: dict[str, str],
    filename: str,
    content_type: str,
    size: int,
) -> dict:
    kind = fields.get("kind") or "clientDocument"
    metadata = {
        "id": fields.get("id") or "",
        "kind": kind,
        "name": fields.get("name") or filename,
        "type": fields.get("type") or ("Document" if kind == "clientDocument" else "Piece jointe"),
        "notes": fields.get("notes") or "",
        "fileName": filename,
        "fileType": content_type,
        "fileSize": size,
        "clientId": fields.get("clientId") or "",
        "buildingId": fields.get("buildingId") or "",
        "apartmentId": fields.get("apartmentId") or "",
        "equipmentId": fields.get("equipmentId") or "",
        "visibleToClient": str(fields.get("visibleToClient", "true")).lower() not in {"false", "0", "no"},
        "uploadedAt": fields.get("uploadedAt") or utc_today(),
        "uploadedBy": row_get(current_user_row, "id"),
        "workOrderId": fields.get("workOrderId") or "",
        "interventionId": fields.get("interventionId") or "",
        "sourceApartmentId": fields.get("sourceApartmentId") or fields.get("apartmentId") or "",
        "sourceBuildingId": fields.get("sourceBuildingId") or fields.get("buildingId") or "",
    }
    if not metadata["id"]:
        raise ApplicationError("Identifiant du fichier manquant.")
    hydrate_scope_from_equipment(state, metadata)
    authorize_upload(state, current_user_row, metadata)
    return public_file_metadata(metadata)


def hydrate_scope_from_equipment(state: dict, metadata: dict) -> None:
    equipment = next(
        (item for item in state.get("equipment", []) if isinstance(item, dict) and item.get("id") == metadata.get("equipmentId")),
        None,
    )
    if equipment:
        metadata["apartmentId"] = metadata.get("apartmentId") or equipment.get("apartmentId", "")
        metadata["sourceApartmentId"] = metadata.get("sourceApartmentId") or equipment.get("apartmentId", "")
    apartment = next(
        (item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id") == metadata.get("apartmentId")),
        None,
    )
    if apartment:
        metadata["buildingId"] = metadata.get("buildingId") or apartment.get("buildingId", "")
        metadata["sourceBuildingId"] = metadata.get("sourceBuildingId") or apartment.get("buildingId", "")
    building = next(
        (item for item in state.get("buildings", []) if isinstance(item, dict) and item.get("id") == metadata.get("buildingId")),
        None,
    )
    if building:
        metadata["clientId"] = metadata.get("clientId") or building.get("clientId", "")


def authorize_upload(state: dict, current_user_row: Any, metadata: dict) -> None:
    requester = requester_from_state(state, current_user_row)
    role = requester.get("role")
    kind = metadata.get("kind")
    if kind == "equipmentAttachment" and not any(
        isinstance(item, dict) and item.get("id") == metadata.get("equipmentId")
        for item in state.get("equipment", [])
    ):
        raise ApplicationError("Equipement introuvable.", HTTPStatus.NOT_FOUND)
    if role in {"administrateur", "equipe_interne"}:
        return
    if kind == "clientDocument":
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)
    if kind == "equipmentAttachment":
        if role == "technicien":
            _, _, _, equipment_ids = technician_scopes(state, requester)
            if metadata.get("equipmentId") in equipment_ids:
                return
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)
    try:
        require_can_save_collection(
            state,
            current_user_row,
            "interventions",
            {
                "id": metadata.get("interventionId") or "new",
                "workOrderId": metadata.get("workOrderId"),
                "equipmentId": metadata.get("equipmentId"),
            },
        )
    except AuthorizationError as error:
        raise ApplicationError(str(error), HTTPStatus.FORBIDDEN)


def authorize_delete(state: dict, current_user_row: Any, kind: str, file: dict) -> None:
    requester = requester_from_state(state, current_user_row)
    if requester.get("role") in {"administrateur", "equipe_interne"}:
        return
    if kind == "clientDocument":
        raise ApplicationError("Droits insuffisants.", HTTPStatus.FORBIDDEN)
    try:
        require_can_save_collection(
            state,
            current_user_row,
            "interventions",
            {
                "id": file.get("interventionId") or "existing",
                "workOrderId": file.get("workOrderId"),
                "equipmentId": file.get("equipmentId"),
            },
        )
    except AuthorizationError as error:
        raise ApplicationError(str(error), HTTPStatus.FORBIDDEN)


def validate_upload_file(fields: dict[str, str], file_part: dict[str, Any]) -> tuple[str, bytes, str, int]:
    filename = safe_filename(file_part.get("filename") or fields.get("fileName") or "fichier")
    content = file_part.get("content") or b""
    content_type = guessed_mime(filename, file_part.get("contentType") or fields.get("fileType") or "")
    kind = fields.get("kind") or "clientDocument"
    max_bytes = DOCUMENT_MAX_BYTES if kind == "clientDocument" else ATTACHMENT_MAX_BYTES
    try:
        validate_file(filename, content_type, content, max_bytes)
    except FileStorageError as error:
        raise convert_file_error(error)
    return filename, content, content_type, max_bytes


def upsert_client_document(state: dict, metadata: dict) -> None:
    docs = state.setdefault("clientDocuments", [])
    if not isinstance(docs, list):
        docs = []
        state["clientDocuments"] = docs
    index = next((idx for idx, item in enumerate(docs) if isinstance(item, dict) and item.get("id") == metadata["id"]), -1)
    stamped = {**metadata, "dataUrl": None, "serverUpdatedAt": server_timestamp()}
    if index >= 0:
        docs[index] = {**docs[index], **stamped}
    else:
        docs.insert(0, stamped)


def remove_file_from_state(state: dict, file_id: str) -> list[tuple[str, dict]]:
    affected: list[tuple[str, dict]] = []
    state["clientDocuments"] = [
        item for item in state.get("clientDocuments", [])
        if not (isinstance(item, dict) and item.get("id") == file_id)
    ]
    for equipment in state.get("equipment", []) if isinstance(state.get("equipment"), list) else []:
        if isinstance(equipment, dict) and isinstance(equipment.get("attachments"), list):
            original_count = len(equipment["attachments"])
            equipment["attachments"] = [
                item for item in equipment["attachments"]
                if not (isinstance(item, dict) and item.get("id") == file_id)
            ]
            if len(equipment["attachments"]) != original_count:
                affected.append(("equipment", equipment))
    for intervention in state.get("interventions", []) if isinstance(state.get("interventions"), list) else []:
        if isinstance(intervention, dict) and isinstance(intervention.get("attachments"), list):
            original_count = len(intervention["attachments"])
            intervention["attachments"] = [
                item for item in intervention["attachments"]
                if not (isinstance(item, dict) and item.get("id") == file_id)
            ]
            if len(intervention["attachments"]) != original_count:
                affected.append(("intervention", intervention))
    return affected


def find_visible_file(state: dict, current_user_row: Any, file_id: str) -> dict:
    visible_state = filter_state_for_user(state, current_user_row)
    _, visible_file = find_file_record(visible_state, file_id)
    if not visible_file:
        raise ApplicationError("Fichier introuvable ou non autorise.", HTTPStatus.FORBIDDEN)
    return visible_file


def clear_ui_state(state: dict) -> None:
    state["sessionUserId"] = None
    state["modal"] = None
    state["toast"] = ""
