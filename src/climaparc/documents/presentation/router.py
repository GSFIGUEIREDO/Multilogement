from __future__ import annotations

from email.parser import BytesParser
from email.policy import default as email_policy
from http import HTTPStatus
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE
from src.climaparc.documents.application.use_cases.delete_file import DeleteFileUseCase
from src.climaparc.documents.application.use_cases.generate_file_url import GenerateFileUrlUseCase
from src.climaparc.documents.application.use_cases.upload_file import UploadFileUseCase
from src.climaparc.documents.presentation.dependencies import (
    get_delete_file_use_case,
    get_generate_file_url_use_case,
    get_session_repository,
    get_upload_file_use_case,
)
from src.climaparc.documents.presentation.dispatch import (
    delete_file_with_use_case,
    generate_file_url_with_use_case,
    upload_file_with_use_case,
)
from src.climaparc.shared.domain.errors import ApplicationError


router = APIRouter()


class FileIdRequest(BaseModel):
    fileId: str = ""


def raise_http(error: ApplicationError) -> None:
    raise HTTPException(status_code=int(error.status), detail=error.message)


def current_user_from_request(request: Request, session_repository: DatabaseSessionRepository) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return session_repository.get_user_by_token(token or "") if token else None


async def parse_multipart_request(request: Request) -> tuple[dict[str, str], dict[str, dict[str, Any]]]:
    content_type = request.headers.get("Content-Type", "")
    if "multipart/form-data" not in content_type:
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Requete multipart invalide.")
    body = await request.body()
    raw = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
    message = BytesParser(policy=email_policy).parsebytes(raw)
    fields: dict[str, str] = {}
    files: dict[str, dict[str, Any]] = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue
        filename = part.get_filename()
        content = part.get_payload(decode=True) or b""
        if filename:
            files[name] = {"filename": filename, "contentType": part.get_content_type(), "content": content}
        else:
            fields[name] = content.decode(part.get_content_charset() or "utf-8", "ignore")
    return fields, files


@router.post("/api/file-upload")
async def upload_file(
    request: Request,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    upload_file_use_case: UploadFileUseCase = Depends(get_upload_file_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    fields, files = await parse_multipart_request(request)
    file_part = files.get("file")
    if not file_part:
        raise HTTPException(status_code=400, detail="Fichier manquant.")
    try:
        return upload_file_with_use_case(current_user, fields, file_part, upload_file_use_case)
    except ApplicationError as error:
        raise_http(error)


@router.post("/api/file-url")
def generate_file_url(
    request: Request,
    payload: FileIdRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    generate_file_url_use_case: GenerateFileUrlUseCase = Depends(get_generate_file_url_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return generate_file_url_with_use_case(current_user, payload.fileId, generate_file_url_use_case)
    except ApplicationError as error:
        raise_http(error)


@router.post("/api/file-delete")
def delete_file(
    request: Request,
    payload: FileIdRequest,
    session_repository: DatabaseSessionRepository = Depends(get_session_repository),
    delete_file_use_case: DeleteFileUseCase = Depends(get_delete_file_use_case),
):
    current_user = current_user_from_request(request, session_repository)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    try:
        return delete_file_with_use_case(current_user, payload.fileId, delete_file_use_case)
    except ApplicationError as error:
        raise_http(error)
