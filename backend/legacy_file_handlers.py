from __future__ import annotations

import mimetypes
from http import HTTPStatus
from typing import Any
from urllib.parse import parse_qs

from backend.auth_services import SessionService
from backend.file_storage import FileStorageError, local_file_path
from backend.security import filter_state_for_user
from src.climaparc.documents.presentation.dependencies import (
    get_delete_file_use_case,
    get_generate_file_url_use_case,
    get_upload_file_use_case,
)
from src.climaparc.documents.presentation.dispatch import (
    delete_file_with_use_case,
    generate_file_url_with_use_case,
    upload_file_with_use_case,
)
from src.climaparc.shared.domain.errors import ApplicationError


def handle_file_upload(handler: Any) -> None:
    user = _current_user(handler)
    if not user:
        return
    try:
        fields, files = handler.read_multipart()
        file_part = files.get("file")
        if not file_part:
            raise FileStorageError("Fichier manquant.")
        result = upload_file_with_use_case(user, fields, file_part, get_upload_file_use_case())
        handler.json_response(result)
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except FileStorageError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"File upload failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de l'envoi du fichier."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_file_url(handler: Any) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        handler.json_response(
            generate_file_url_with_use_case(user, str(payload.get("fileId") or ""), get_generate_file_url_use_case())
        )
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)


def handle_file_delete(handler: Any) -> None:
    user = _current_user(handler)
    if not user:
        return
    payload = handler.read_json()
    try:
        handler.json_response(delete_file_with_use_case(user, str(payload.get("fileId") or ""), get_delete_file_use_case()))
    except ApplicationError as error:
        handler.json_response({"error": error.message}, error.status)
    except Exception as error:
        print(f"File delete failed: {error}")
        handler.json_response({"error": "Erreur serveur lors de la suppression du fichier."}, HTTPStatus.INTERNAL_SERVER_ERROR)


def handle_local_file(handler: Any, parsed: Any, *, db: Any, get_state: Any) -> None:
    user = _current_user(handler)
    if not user:
        return
    query = parse_qs(parsed.query)
    bucket = query.get("bucket", [""])[0]
    path = query.get("path", [""])[0]
    if not bucket or not path:
        handler.json_response({"error": "Fichier introuvable."}, HTTPStatus.BAD_REQUEST)
        return

    with db() as connection:
        state = get_state(connection)
    visible = filter_state_for_user(state, user)
    if path not in _allowed_storage_paths(visible, bucket):
        handler.json_response({"error": "Fichier non autorise."}, HTTPStatus.FORBIDDEN)
        return

    try:
        target = local_file_path(bucket, path)
    except FileStorageError as error:
        handler.json_response({"error": error.message}, error.status)
        return
    if not target.exists() or not target.is_file():
        handler.json_response({"error": "Fichier introuvable."}, HTTPStatus.NOT_FOUND)
        return

    body = target.read_bytes()
    content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _current_user(handler: Any):
    user = SessionService().read(handler.headers.get("Cookie"))
    if not user:
        handler.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
        return None
    return user


def _allowed_storage_paths(visible_state: dict, bucket: str) -> set[str]:
    allowed_paths: set[str] = set()
    for doc in visible_state.get("clientDocuments", []) if isinstance(visible_state.get("clientDocuments"), list) else []:
        if isinstance(doc, dict) and doc.get("storageBucket") == bucket and doc.get("storagePath"):
            allowed_paths.add(doc.get("storagePath"))
    for equipment in visible_state.get("equipment", []) if isinstance(visible_state.get("equipment"), list) else []:
        for file in equipment.get("attachments", []) if isinstance(equipment, dict) and isinstance(equipment.get("attachments"), list) else []:
            if isinstance(file, dict) and file.get("storageBucket") == bucket and file.get("storagePath"):
                allowed_paths.add(file.get("storagePath"))
    for intervention in visible_state.get("interventions", []) if isinstance(visible_state.get("interventions"), list) else []:
        for file in intervention.get("attachments", []) if isinstance(intervention, dict) and isinstance(intervention.get("attachments"), list) else []:
            if isinstance(file, dict) and file.get("storageBucket") == bucket and file.get("storagePath"):
                allowed_paths.add(file.get("storagePath"))
    return allowed_paths
