from __future__ import annotations

import json
import mimetypes
import os
from email.parser import BytesParser
from email.policy import default as email_policy
from http import HTTPStatus
from typing import Any
from urllib.parse import unquote

from backend.file_storage import FileStorageError


class LegacyHttpMixin:
    static_root = None

    def serve_static(self, raw_path: str) -> None:
        root = self.static_root
        path = "/index.html" if raw_path in ("", "/") else raw_path
        requested = (root / unquote(path).lstrip("/")).resolve()
        if not str(requested).startswith(str(root)) or not requested.is_file():
            self.json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)
            return
        content_type = mimetypes.guess_type(requested.name)[0] or "application/octet-stream"
        body = requested.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if requested.name in {"app.js", "index.html"} else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(body or "{}")

    def read_multipart(self) -> tuple[dict[str, str], dict[str, dict[str, Any]]]:
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            raise FileStorageError("Requete multipart invalide.", HTTPStatus.BAD_REQUEST)
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        raw = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
        message = BytesParser(policy=email_policy).parsebytes(raw)
        fields: dict[str, str] = {}
        files: dict[str, dict[str, Any]] = {}
        for part in message.iter_parts():
            name = part.get_param("name", header="content-disposition")
            if not name:
                continue
            filename = part.get_filename()
            payload = part.get_payload(decode=True) or b""
            if filename:
                files[name] = {
                    "filename": filename,
                    "contentType": part.get_content_type(),
                    "content": payload,
                }
            else:
                fields[name] = payload.decode(part.get_content_charset() or "utf-8", "ignore")
        return fields, files

    def json_response(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        if os.environ.get("CLIMAPARC_DEBUG"):
            super().log_message(format, *args)
