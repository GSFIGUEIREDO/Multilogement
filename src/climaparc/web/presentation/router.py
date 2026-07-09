from __future__ import annotations

import mimetypes
from pathlib import Path
from urllib.parse import unquote

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from backend.database import USE_POSTGRES, connect
from backend.file_storage import FileStorageError, local_file_path
from backend.repositories import StateRepository
from backend.security import filter_state_for_user
from src.climaparc.auth.infrastructure.repositories import DatabaseSessionRepository
from src.climaparc.auth.presentation.router import SESSION_COOKIE


ROOT = Path(__file__).resolve().parents[4]
router = APIRouter()


@router.get("/api/health")
def health() -> dict:
    return {"ok": True, "database": "postgres" if USE_POSTGRES else "sqlite"}


@router.get("/api/local-file")
def local_file(request: Request, bucket: str = "", path: str = ""):
    current_user = _current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session expiree.")
    if not bucket or not path:
        raise HTTPException(status_code=400, detail="Fichier introuvable.")

    with connect() as connection:
        state = StateRepository().get(connection) or {}
    visible = filter_state_for_user(state, current_user)
    storage_path = unquote(path)
    if storage_path not in _allowed_storage_paths(visible, bucket):
        raise HTTPException(status_code=403, detail="Fichier non autorise.")

    try:
        target = local_file_path(bucket, storage_path)
    except FileStorageError as error:
        raise HTTPException(status_code=int(error.status), detail=error.message)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable.")

    return FileResponse(
        target,
        media_type=mimetypes.guess_type(target.name)[0] or "application/octet-stream",
        headers={"Cache-Control": "no-store"},
    )


@router.get("/{path:path}")
def web_app(path: str = ""):
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    requested = (ROOT / (path or "index.html")).resolve()
    if not str(requested).startswith(str(ROOT.resolve())):
        raise HTTPException(status_code=404, detail="Not found")
    if requested.is_file():
        return FileResponse(requested)
    index = ROOT / "index.html"
    if index.exists():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Not found")


def _current_user(request: Request) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    return DatabaseSessionRepository().get_user_by_token(token or "") if token else None


def _allowed_storage_paths(visible_state: dict, bucket: str) -> set[str]:
    allowed_paths: set[str] = set()
    for doc in visible_state.get("clientDocuments", []) if isinstance(visible_state.get("clientDocuments"), list) else []:
        if isinstance(doc, dict) and doc.get("storageBucket") == bucket and doc.get("storagePath"):
            allowed_paths.add(str(doc.get("storagePath")))
    for equipment in visible_state.get("equipment", []) if isinstance(visible_state.get("equipment"), list) else []:
        for file in equipment.get("attachments", []) if isinstance(equipment, dict) and isinstance(equipment.get("attachments"), list) else []:
            if isinstance(file, dict) and file.get("storageBucket") == bucket and file.get("storagePath"):
                allowed_paths.add(str(file.get("storagePath")))
    for intervention in visible_state.get("interventions", []) if isinstance(visible_state.get("interventions"), list) else []:
        for file in intervention.get("attachments", []) if isinstance(intervention, dict) and isinstance(intervention.get("attachments"), list) else []:
            if isinstance(file, dict) and file.get("storageBucket") == bucket and file.get("storagePath"):
                allowed_paths.add(str(file.get("storagePath")))
    return allowed_paths
