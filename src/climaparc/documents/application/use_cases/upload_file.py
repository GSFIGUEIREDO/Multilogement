from __future__ import annotations

from http import HTTPStatus

from backend.file_storage import STORAGE_BUCKET, FileStorageError, storage_path_for
from backend.security import filter_state_for_user
from src.climaparc.documents.application.commands import UploadFileCommand
from src.climaparc.documents.domain.policies import (
    build_document_metadata,
    clear_ui_state,
    convert_file_error,
    upsert_client_document,
    validate_upload_file,
)
from src.climaparc.documents.domain.repositories import (
    DocumentPayloadRepository,
    DocumentStateRepository,
    DocumentStorageGateway,
)
from src.climaparc.shared.domain.errors import ApplicationError


class UploadFileUseCase:
    def __init__(
        self,
        state_repository: DocumentStateRepository,
        payload_repository: DocumentPayloadRepository,
        storage_gateway: DocumentStorageGateway,
    ):
        self.state_repository = state_repository
        self.payload_repository = payload_repository
        self.storage_gateway = storage_gateway

    def __call__(self, command: UploadFileCommand) -> dict:
        if not command.current_user:
            raise ApplicationError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        filename, content, content_type, _ = validate_upload_file(command.fields, command.file_part)

        state = self.state_repository.get(lock=False)
        if not state:
            raise ApplicationError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        metadata = build_document_metadata(
            state,
            command.current_user,
            command.fields,
            filename,
            content_type,
            len(content),
        )
        path = storage_path_for(metadata, filename)
        try:
            self.storage_gateway.upload(STORAGE_BUCKET, path, content, content_type)
        except FileStorageError as error:
            raise convert_file_error(error)
        metadata["storageBucket"] = STORAGE_BUCKET
        metadata["storagePath"] = path

        if metadata.get("kind") == "clientDocument":
            upsert_client_document(state, metadata)
            clear_ui_state(state)
            self.payload_repository.upsert_client_document(metadata)
            state = self.state_repository.get(lock=False) or state
            clear_ui_state(state)
        elif metadata.get("kind") == "equipmentAttachment":
            equipment = next(
                (
                    item for item in state.get("equipment", [])
                    if isinstance(item, dict) and item.get("id") == metadata.get("equipmentId")
                ),
                None,
            )
            if not equipment:
                raise ApplicationError("Equipement introuvable.", HTTPStatus.NOT_FOUND)
            attachments = equipment.setdefault("attachments", [])
            if not isinstance(attachments, list):
                attachments = []
                equipment["attachments"] = attachments
            file_index = next(
                (index for index, item in enumerate(attachments) if isinstance(item, dict) and item.get("id") == metadata["id"]),
                -1,
            )
            if file_index >= 0:
                attachments[file_index] = {**attachments[file_index], **metadata}
            else:
                attachments.append(metadata)
            self.payload_repository.upsert_equipment(equipment)
            state = self.state_repository.get(lock=False) or state
            clear_ui_state(state)

        return {"ok": True, "file": metadata, "state": filter_state_for_user(state, command.current_user)}
