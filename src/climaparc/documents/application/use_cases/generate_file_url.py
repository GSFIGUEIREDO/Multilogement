from __future__ import annotations

from http import HTTPStatus

from backend.file_storage import SIGNED_URL_SECONDS, STORAGE_BUCKET, FileStorageError
from src.climaparc.documents.application.commands import GenerateFileUrlCommand
from src.climaparc.documents.domain.policies import convert_file_error, find_visible_file, normalize_file_id
from src.climaparc.documents.domain.repositories import DocumentStateRepository, DocumentStorageGateway
from src.climaparc.shared.domain.errors import ApplicationError


class GenerateFileUrlUseCase:
    def __init__(self, state_repository: DocumentStateRepository, storage_gateway: DocumentStorageGateway):
        self.state_repository = state_repository
        self.storage_gateway = storage_gateway

    def __call__(self, command: GenerateFileUrlCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        file_id = normalize_file_id(command.file_id)
        state = self.state_repository.get(lock=False)
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        visible_file = find_visible_file(state, command.current_user, file_id)
        bucket = visible_file.get("storageBucket") or STORAGE_BUCKET
        path = visible_file.get("storagePath")
        if not path:
            raise ApplicationError("Ce fichier doit etre migre vers le stockage avant consultation.", HTTPStatus.GONE)
        try:
            url = self.storage_gateway.signed_url(bucket, path, SIGNED_URL_SECONDS)
        except FileStorageError as error:
            raise convert_file_error(error)
        return {"ok": True, "url": url, "file": visible_file}
