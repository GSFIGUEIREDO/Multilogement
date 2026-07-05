from __future__ import annotations

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.documents.application.use_cases.delete_file import DeleteFileUseCase
from src.climaparc.documents.application.use_cases.generate_file_url import GenerateFileUrlUseCase
from src.climaparc.documents.application.use_cases.upload_file import UploadFileUseCase
from src.climaparc.documents.infrastructure.repositories import (
    DatabaseDocumentPayloadRepository,
    DatabaseDocumentStateRepository,
    get_storage_gateway,
)


def get_document_state_repository() -> DatabaseDocumentStateRepository:
    return DatabaseDocumentStateRepository()


def get_document_payload_repository() -> DatabaseDocumentPayloadRepository:
    return DatabaseDocumentPayloadRepository()


def get_session_repository() -> DatabaseSessionRepository:
    return DatabaseSessionRepository()


def get_upload_file_use_case() -> UploadFileUseCase:
    return UploadFileUseCase(get_document_state_repository(), get_document_payload_repository(), get_storage_gateway())


def get_generate_file_url_use_case() -> GenerateFileUrlUseCase:
    return GenerateFileUrlUseCase(get_document_state_repository(), get_storage_gateway())


def get_delete_file_use_case() -> DeleteFileUseCase:
    return DeleteFileUseCase(get_document_state_repository(), get_document_payload_repository(), get_storage_gateway())
