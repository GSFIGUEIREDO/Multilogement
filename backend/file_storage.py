from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from .database import connect, row_get, server_timestamp
from .repositories import PayloadTableRepository, StateRepository
from .security import (
    AuthorizationError,
    filter_state_for_user,
    has_client_right,
    requester_from_state,
    require_can_save_collection,
    sanitize_state_for_response,
)


STORAGE_BUCKET = os.environ.get("CLIMAPARC_STORAGE_BUCKET", "climaparc-documents")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
LOCAL_UPLOAD_ROOT = Path(os.environ.get("CLIMAPARC_LOCAL_UPLOAD_ROOT", "local_uploads")).resolve()
DOCUMENT_MAX_BYTES = 10 * 1024 * 1024
ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024
SIGNED_URL_SECONDS = int(os.environ.get("CLIMAPARC_FILE_URL_TTL", "900"))

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
}

ALLOWED_MIME_PREFIXES = ("image/",)
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


class FileStorageError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status = status


def production_mode() -> bool:
    return bool(os.environ.get("RENDER") or os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DATABASE_URL"))


def storage_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def safe_filename(filename: str) -> str:
    name = Path(filename or "fichier").name
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")
    return name or "fichier"


def guessed_mime(filename: str, explicit_type: str = "") -> str:
    return explicit_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"


def validate_file(filename: str, content_type: str, content: bytes, max_bytes: int) -> None:
    if not content:
        raise FileStorageError("Fichier vide.")
    if len(content) > max_bytes:
        raise FileStorageError(f"Fichier trop volumineux. Limite: {max_bytes // (1024 * 1024)} MB.")
    extension = Path(filename or "").suffix.lower()
    mime = guessed_mime(filename, content_type)
    if extension not in ALLOWED_EXTENSIONS and not mime.startswith(ALLOWED_MIME_PREFIXES) and mime not in ALLOWED_MIME_TYPES:
        raise FileStorageError("Type de fichier non autorise.")


def storage_path_for(metadata: dict, filename: str) -> str:
    client_id = safe_filename(str(metadata.get("clientId") or "client"))
    scope = safe_filename(str(metadata.get("kind") or "document"))
    file_id = safe_filename(str(metadata["id"]))
    return f"{client_id}/{scope}/{utc_today()}/{file_id}-{safe_filename(filename)}"


def supabase_request(method: str, path: str, body: bytes | None = None, headers: dict[str, str] | None = None) -> dict:
    if not storage_configured():
        raise FileStorageError("Supabase Storage n'est pas configure.", HTTPStatus.SERVICE_UNAVAILABLE)
    url = f"{SUPABASE_URL}/storage/v1{path}"
    request = Request(url, data=body, method=method)
    request.add_header("Authorization", f"Bearer {SUPABASE_SERVICE_ROLE_KEY}")
    request.add_header("apikey", SUPABASE_SERVICE_ROLE_KEY)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urlopen(request, timeout=30) as response:
            payload = response.read()
    except HTTPError as error:
        details = error.read().decode("utf-8", "ignore")
        raise FileStorageError(f"Erreur Supabase Storage: {details or error.reason}", HTTPStatus.BAD_GATEWAY)
    except URLError as error:
        raise FileStorageError(f"Supabase Storage inaccessible: {error.reason}", HTTPStatus.BAD_GATEWAY)
    if not payload:
        return {}
    try:
        return json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


class StorageBackend:
    def ensure_bucket(self) -> None:
        raise NotImplementedError

    def upload(self, bucket: str, path: str, content: bytes, content_type: str) -> None:
        raise NotImplementedError

    def signed_url(self, bucket: str, path: str, expires_in: int = SIGNED_URL_SECONDS) -> str:
        raise NotImplementedError

    def delete(self, bucket: str, path: str) -> None:
        raise NotImplementedError


class SupabaseStorageBackend(StorageBackend):
    def ensure_bucket(self) -> None:
        try:
            supabase_request("POST", "/bucket", json.dumps({"id": STORAGE_BUCKET, "name": STORAGE_BUCKET, "public": False}).encode("utf-8"), {"Content-Type": "application/json"})
        except FileStorageError as error:
            if "already" not in error.message.lower() and "duplicate" not in error.message.lower() and "exists" not in error.message.lower():
                raise

    def upload(self, bucket: str, path: str, content: bytes, content_type: str) -> None:
        self.ensure_bucket()
        object_path = quote(f"/object/{bucket}/{path}", safe="/")
        supabase_request(
            "POST",
            object_path,
            content,
            {"Content-Type": content_type or "application/octet-stream", "x-upsert": "false"},
        )

    def signed_url(self, bucket: str, path: str, expires_in: int = SIGNED_URL_SECONDS) -> str:
        object_path = quote(f"/object/sign/{bucket}/{path}", safe="/")
        result = supabase_request(
            "POST",
            object_path,
            json.dumps({"expiresIn": expires_in}).encode("utf-8"),
            {"Content-Type": "application/json"},
        )
        signed = result.get("signedURL") or result.get("signedUrl") or ""
        if signed.startswith("http"):
            return signed
        if signed.startswith("/storage/v1/"):
            return f"{SUPABASE_URL}{signed}"
        if signed:
            return f"{SUPABASE_URL}/storage/v1{signed if signed.startswith('/') else '/' + signed}"
        raise FileStorageError("URL temporaire non generee.", HTTPStatus.BAD_GATEWAY)

    def delete(self, bucket: str, path: str) -> None:
        supabase_request(
            "DELETE",
            f"/object/{bucket}",
            json.dumps({"prefixes": [path]}).encode("utf-8"),
            {"Content-Type": "application/json"},
        )


class LocalStorageBackend(StorageBackend):
    def ensure_bucket(self) -> None:
        (LOCAL_UPLOAD_ROOT / STORAGE_BUCKET).mkdir(parents=True, exist_ok=True)

    def upload(self, bucket: str, path: str, content: bytes, content_type: str) -> None:
        self.ensure_bucket()
        target = (LOCAL_UPLOAD_ROOT / bucket / path).resolve()
        if not str(target).startswith(str((LOCAL_UPLOAD_ROOT / bucket).resolve())):
            raise FileStorageError("Chemin local invalide.")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)

    def signed_url(self, bucket: str, path: str, expires_in: int = SIGNED_URL_SECONDS) -> str:
        return f"/api/local-file?bucket={quote(bucket)}&path={quote(path)}"

    def delete(self, bucket: str, path: str) -> None:
        target = (LOCAL_UPLOAD_ROOT / bucket / path).resolve()
        if str(target).startswith(str((LOCAL_UPLOAD_ROOT / bucket).resolve())) and target.exists():
            target.unlink()


def storage_backend() -> StorageBackend:
    if storage_configured():
        return SupabaseStorageBackend()
    if production_mode():
        raise FileStorageError("Configurez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY pour utiliser les fichiers en production.", HTTPStatus.SERVICE_UNAVAILABLE)
    return LocalStorageBackend()


def public_file_metadata(metadata: dict) -> dict:
    clean = dict(metadata)
    clean.pop("dataUrl", None)
    clean.pop("content", None)
    return clean


def find_file_record(state: dict, file_id: str) -> tuple[str, dict] | tuple[None, None]:
    for doc in state.get("clientDocuments", []) if isinstance(state.get("clientDocuments"), list) else []:
        if isinstance(doc, dict) and doc.get("id") == file_id:
            return "clientDocument", doc
    for equipment in state.get("equipment", []) if isinstance(state.get("equipment"), list) else []:
        for file in equipment.get("attachments", []) if isinstance(equipment.get("attachments"), list) else []:
            if isinstance(file, dict) and file.get("id") == file_id:
                return "equipmentAttachment", file
    for intervention in state.get("interventions", []) if isinstance(state.get("interventions"), list) else []:
        for file in intervention.get("attachments", []) if isinstance(intervention.get("attachments"), list) else []:
            if isinstance(file, dict) and file.get("id") == file_id:
                return "interventionAttachment", file
    return None, None


def decode_data_url(data_url: str) -> tuple[bytes, str]:
    match = re.match(r"^data:([^;,]+)?(;base64)?,(.*)$", data_url or "", re.S)
    if not match:
        raise FileStorageError("Ancien fichier dataUrl invalide.")
    mime = match.group(1) or "application/octet-stream"
    payload = match.group(3)
    if match.group(2):
        return base64.b64decode(payload), mime
    return payload.encode("utf-8"), mime


class FileService:
    def __init__(self, state_repository: StateRepository | None = None, backend: StorageBackend | None = None):
        self.state_repository = state_repository or StateRepository()
        self.backend = backend or storage_backend()

    def upload(self, current_user_row: Any, fields: dict[str, str], file_part: dict[str, Any]) -> dict:
        if not current_user_row:
            raise FileStorageError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        filename = safe_filename(file_part.get("filename") or fields.get("fileName") or "fichier")
        content = file_part.get("content") or b""
        content_type = guessed_mime(filename, file_part.get("contentType") or fields.get("fileType") or "")
        kind = fields.get("kind") or "clientDocument"
        max_bytes = DOCUMENT_MAX_BYTES if kind == "clientDocument" else ATTACHMENT_MAX_BYTES
        validate_file(filename, content_type, content, max_bytes)

        with connect() as connection:
            state = self.state_repository.get(connection, lock=True)
            if not state:
                raise FileStorageError("Etat introuvable.", HTTPStatus.NOT_FOUND)
            metadata = self._build_metadata(state, current_user_row, fields, filename, content_type, len(content))
            path = storage_path_for(metadata, filename)
            self.backend.upload(STORAGE_BUCKET, path, content, content_type)
            metadata["storageBucket"] = STORAGE_BUCKET
            metadata["storagePath"] = path
            metadata = public_file_metadata(metadata)
            if kind == "clientDocument":
                self._upsert_client_document(state, metadata)
                self.state_repository.save(connection, state)
                PayloadTableRepository("climaparc_client_documents", [
                    ("client_id", "clientId"),
                    ("building_id", "buildingId"),
                    ("apartment_id", "apartmentId"),
                    ("equipment_id", "equipmentId"),
                    ("name", "name"),
                    ("document_type", "type"),
                    ("file_name", "fileName"),
                    ("file_type", "fileType"),
                    ("file_size", lambda item: item.get("fileSize")),
                    ("storage_bucket", "storageBucket"),
                    ("storage_path", "storagePath"),
                    ("uploaded_at", "uploadedAt"),
                    ("visible_to_client", lambda item: item.get("visibleToClient") is not False),
                ]).upsert(connection, metadata)
            return {"ok": True, "file": metadata, "state": filter_state_for_user(state, current_user_row)}

    def temporary_url(self, current_user_row: Any, file_id: str) -> dict:
        if not current_user_row:
            raise FileStorageError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        with connect() as connection:
            state = self.state_repository.get(connection)
        if not state:
            raise FileStorageError("Etat introuvable.", HTTPStatus.NOT_FOUND)
        visible_state = filter_state_for_user(state, current_user_row)
        _, visible_file = find_file_record(visible_state, file_id)
        if not visible_file:
            raise FileStorageError("Fichier introuvable ou non autorise.", HTTPStatus.FORBIDDEN)
        bucket = visible_file.get("storageBucket") or STORAGE_BUCKET
        path = visible_file.get("storagePath")
        if not path:
            raise FileStorageError("Ce fichier doit etre migre vers le stockage avant consultation.", HTTPStatus.GONE)
        return {"ok": True, "url": self.backend.signed_url(bucket, path), "file": visible_file}

    def delete(self, current_user_row: Any, file_id: str) -> dict:
        if not current_user_row:
            raise FileStorageError("Session expiree.", HTTPStatus.UNAUTHORIZED)
        with connect() as connection:
            state = self.state_repository.get(connection, lock=True)
            if not state:
                raise FileStorageError("Etat introuvable.", HTTPStatus.NOT_FOUND)
            kind, file = find_file_record(state, file_id)
            if not file:
                raise FileStorageError("Fichier introuvable.", HTTPStatus.NOT_FOUND)
            self._authorize_delete(state, current_user_row, kind, file)
            bucket = file.get("storageBucket") or STORAGE_BUCKET
            path = file.get("storagePath")
            if path:
                self.backend.delete(bucket, path)
            self._remove_file(state, file_id)
            self.state_repository.save(connection, state)
        return {"ok": True, "state": filter_state_for_user(state, current_user_row)}

    def _build_metadata(self, state: dict, current_user_row: Any, fields: dict[str, str], filename: str, content_type: str, size: int) -> dict:
        kind = fields.get("kind") or "clientDocument"
        requester = requester_from_state(state, current_user_row)
        metadata = {
            "id": fields.get("id") or f"file-{uuid.uuid4().hex[:12]}",
            "kind": kind,
            "name": fields.get("name") or filename,
            "type": fields.get("type") or ("Document" if kind == "clientDocument" else "Pièce jointe"),
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
        self._hydrate_scope_from_equipment(state, metadata)
        self._authorize_upload(state, current_user_row, requester, metadata)
        return metadata

    @staticmethod
    def _hydrate_scope_from_equipment(state: dict, metadata: dict) -> None:
        equipment = next((item for item in state.get("equipment", []) if isinstance(item, dict) and item.get("id") == metadata.get("equipmentId")), None)
        if equipment:
            metadata["apartmentId"] = metadata.get("apartmentId") or equipment.get("apartmentId", "")
            metadata["sourceApartmentId"] = metadata.get("sourceApartmentId") or equipment.get("apartmentId", "")
        apartment = next((item for item in state.get("apartments", []) if isinstance(item, dict) and item.get("id") == metadata.get("apartmentId")), None)
        if apartment:
            metadata["buildingId"] = metadata.get("buildingId") or apartment.get("buildingId", "")
            metadata["sourceBuildingId"] = metadata.get("sourceBuildingId") or apartment.get("buildingId", "")
        building = next((item for item in state.get("buildings", []) if isinstance(item, dict) and item.get("id") == metadata.get("buildingId")), None)
        if building:
            metadata["clientId"] = metadata.get("clientId") or building.get("clientId", "")

    def _authorize_upload(self, state: dict, current_user_row: Any, requester: dict, metadata: dict) -> None:
        role = requester.get("role")
        kind = metadata.get("kind")
        if role in {"administrateur", "equipe_interne"}:
            return
        if kind == "clientDocument":
            raise FileStorageError("Droits insuffisants.", HTTPStatus.FORBIDDEN)
        try:
            require_can_save_collection(
                state,
                current_user_row,
                "interventions",
                {"id": metadata.get("interventionId") or "new", "workOrderId": metadata.get("workOrderId"), "equipmentId": metadata.get("equipmentId")},
            )
        except AuthorizationError as error:
            raise FileStorageError(str(error), HTTPStatus.FORBIDDEN)

    @staticmethod
    def _authorize_delete(state: dict, current_user_row: Any, kind: str, file: dict) -> None:
        requester = requester_from_state(state, current_user_row)
        if requester.get("role") in {"administrateur", "equipe_interne"}:
            return
        if kind == "clientDocument":
            raise FileStorageError("Droits insuffisants.", HTTPStatus.FORBIDDEN)
        try:
            require_can_save_collection(
                state,
                current_user_row,
                "interventions",
                {"id": file.get("interventionId") or "existing", "workOrderId": file.get("workOrderId"), "equipmentId": file.get("equipmentId")},
            )
        except AuthorizationError as error:
            raise FileStorageError(str(error), HTTPStatus.FORBIDDEN)

    @staticmethod
    def _upsert_client_document(state: dict, metadata: dict) -> None:
        docs = state.setdefault("clientDocuments", [])
        index = next((idx for idx, item in enumerate(docs) if isinstance(item, dict) and item.get("id") == metadata["id"]), -1)
        if index >= 0:
            docs[index] = {**docs[index], **metadata, "dataUrl": None, "serverUpdatedAt": server_timestamp()}
        else:
            docs.insert(0, {**metadata, "serverUpdatedAt": server_timestamp()})

    @staticmethod
    def _remove_file(state: dict, file_id: str) -> None:
        state["clientDocuments"] = [
            item for item in state.get("clientDocuments", [])
            if not (isinstance(item, dict) and item.get("id") == file_id)
        ]
        for equipment in state.get("equipment", []) if isinstance(state.get("equipment"), list) else []:
            if isinstance(equipment, dict) and isinstance(equipment.get("attachments"), list):
                equipment["attachments"] = [item for item in equipment["attachments"] if not (isinstance(item, dict) and item.get("id") == file_id)]
        for intervention in state.get("interventions", []) if isinstance(state.get("interventions"), list) else []:
            if isinstance(intervention, dict) and isinstance(intervention.get("attachments"), list):
                intervention["attachments"] = [item for item in intervention["attachments"] if not (isinstance(item, dict) and item.get("id") == file_id)]


def migrate_legacy_data_urls(state: dict) -> tuple[bool, list[str]]:
    warnings: list[str] = []
    if not isinstance(state, dict):
        return False, warnings
    has_legacy = any(
        isinstance(item, dict) and item.get("dataUrl") and not item.get("storagePath")
        for item in (
            list(state.get("clientDocuments", []) if isinstance(state.get("clientDocuments"), list) else [])
            + [
                file
                for equipment in state.get("equipment", []) if isinstance(state.get("equipment"), list)
                for file in (equipment.get("attachments", []) if isinstance(equipment, dict) and isinstance(equipment.get("attachments"), list) else [])
            ]
            + [
                file
                for intervention in state.get("interventions", []) if isinstance(state.get("interventions"), list)
                for file in (intervention.get("attachments", []) if isinstance(intervention, dict) and isinstance(intervention.get("attachments"), list) else [])
            ]
        )
    )
    if not has_legacy:
        return False, warnings
    try:
        backend = storage_backend()
    except FileStorageError as error:
        warnings.append(f"Migration fichiers ignoree: {error.message}")
        return False, warnings
    changed = False

    def migrate_file(file: dict, fallback_client_id: str = "", fallback_kind: str = "legacy") -> None:
        nonlocal changed
        if not isinstance(file, dict) or not file.get("dataUrl") or file.get("storagePath"):
            return
        try:
            content, mime = decode_data_url(file.get("dataUrl", ""))
            filename = safe_filename(file.get("fileName") or file.get("name") or "fichier")
            metadata = {
                "id": file.get("id") or f"file-{uuid.uuid4().hex[:12]}",
                "clientId": file.get("clientId") or fallback_client_id or "legacy",
                "kind": file.get("kind") or fallback_kind,
            }
            max_bytes = DOCUMENT_MAX_BYTES if fallback_kind == "clientDocument" else ATTACHMENT_MAX_BYTES
            validate_file(filename, mime, content, max_bytes)
            path = storage_path_for(metadata, filename)
            backend.upload(STORAGE_BUCKET, path, content, mime)
            file["storageBucket"] = STORAGE_BUCKET
            file["storagePath"] = path
            file["fileType"] = file.get("fileType") or mime
            file["fileName"] = file.get("fileName") or filename
            file["fileSize"] = file.get("fileSize") or len(content)
            file.pop("dataUrl", None)
            changed = True
        except Exception as error:
            warnings.append(f"Migration fichier {file.get('id') or file.get('name') or 'sans-id'} ignoree: {error}")

    for doc in state.get("clientDocuments", []) if isinstance(state.get("clientDocuments"), list) else []:
        migrate_file(doc, doc.get("clientId", "") if isinstance(doc, dict) else "", "clientDocument")
    for equipment in state.get("equipment", []) if isinstance(state.get("equipment"), list) else []:
        if not isinstance(equipment, dict):
            continue
        for file in equipment.get("attachments", []) if isinstance(equipment.get("attachments"), list) else []:
            migrate_file(file, file.get("clientId", "") if isinstance(file, dict) else "", "equipmentAttachment")
    for intervention in state.get("interventions", []) if isinstance(state.get("interventions"), list) else []:
        if not isinstance(intervention, dict):
            continue
        for file in intervention.get("attachments", []) if isinstance(intervention.get("attachments"), list) else []:
            migrate_file(file, file.get("clientId", "") if isinstance(file, dict) else "", "interventionAttachment")
    return changed, warnings


def local_file_path(bucket: str, path: str) -> Path:
    target = (LOCAL_UPLOAD_ROOT / safe_filename(bucket) / path).resolve()
    root = (LOCAL_UPLOAD_ROOT / safe_filename(bucket)).resolve()
    if not str(target).startswith(str(root)):
        raise FileStorageError("Chemin local invalide.", HTTPStatus.FORBIDDEN)
    return target
