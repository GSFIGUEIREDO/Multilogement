from __future__ import annotations

from http import HTTPStatus
from typing import Any

from backend.auth_services import SessionService
from backend.file_storage import FileStorageError
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


def _current_user(handler: Any):
    user = SessionService().read(handler.headers.get("Cookie"))
    if not user:
        handler.json_response({"error": "Session expiree."}, HTTPStatus.UNAUTHORIZED)
        return None
    return user
