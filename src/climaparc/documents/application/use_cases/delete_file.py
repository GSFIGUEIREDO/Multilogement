from __future__ import annotations

from http import HTTPStatus

from backend.file_storage import STORAGE_BUCKET, FileStorageError, find_file_record
from backend.security import filter_state_for_user
from src.climaparc.documents.application.commands import DeleteFileCommand
from src.climaparc.documents.domain.policies import (
    authorize_delete,
    clear_ui_state,
    convert_file_error,
    normalize_file_id,
    remove_file_from_state,
)
from src.climaparc.documents.domain.repositories import (
    DocumentPayloadRepository,
    DocumentStateRepository,
    DocumentStorageGateway,
)
from src.climaparc.shared.domain.errors import ApplicationError


class DeleteFileUseCase:
    def __init__(
        self,
        state_repository: DocumentStateRepository,
        payload_repository: DocumentPayloadRepository,
        storage_gateway: DocumentStorageGateway,
    ):
        self.state_repository = state_repository
        self.payload_repository = payload_repository
        self.storage_gateway = storage_gateway

    def __call__(self, command: DeleteFileCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        file_id = normalize_file_id(command.file_id)
        state = self.state_repository.get(lock=False)
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        kind, file = find_file_record(state, file_id)
        if not file:
            raise ApplicationError("Fichier introuvable.", HTTPStatus.NOT_FOUND)
        authorize_delete(state, command.current_user, kind or "", file)

        bucket = file.get("storageBucket") or STORAGE_BUCKET
        path = file.get("storagePath")
        if path:
            try:
                self.storage_gateway.delete(bucket, path)
            except FileStorageError as error:
                raise convert_file_error(error)
        affected = remove_file_from_state(state, file_id)
        clear_ui_state(state)
        self.payload_repository.delete_file(file_id)
        for item_kind, item in affected:
            if item_kind == "equipment":
                self.payload_repository.upsert_equipment(item)
            elif item_kind == "intervention":
                self.payload_repository.upsert_intervention(item)
        state = self.state_repository.get(lock=False) or state
        clear_ui_state(state)
        return {"ok": True, "state": filter_state_for_user(state, command.current_user)}
