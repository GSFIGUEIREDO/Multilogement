from __future__ import annotations

from src.climaparc.documents.application.commands import DeleteFileCommand, GenerateFileUrlCommand, UploadFileCommand
from src.climaparc.documents.application.use_cases.delete_file import DeleteFileUseCase
from src.climaparc.documents.application.use_cases.generate_file_url import GenerateFileUrlUseCase
from src.climaparc.documents.application.use_cases.upload_file import UploadFileUseCase


def upload_file_with_use_case(
    current_user: dict,
    fields: dict[str, str],
    file_part: dict,
    upload_file_use_case: UploadFileUseCase,
) -> dict:
    return upload_file_use_case(UploadFileCommand(current_user, fields, file_part))


def generate_file_url_with_use_case(
    current_user: dict,
    file_id: str,
    generate_file_url_use_case: GenerateFileUrlUseCase,
) -> dict:
    return generate_file_url_use_case(GenerateFileUrlCommand(current_user, file_id))


def delete_file_with_use_case(
    current_user: dict,
    file_id: str,
    delete_file_use_case: DeleteFileUseCase,
) -> dict:
    return delete_file_use_case(DeleteFileCommand(current_user, file_id))
