from __future__ import annotations

from typing import Protocol


class DocumentStateRepository(Protocol):
    def get(self, lock: bool = False) -> dict | None:
        ...


class DocumentPayloadRepository(Protocol):
    def upsert_client_document(self, document: dict) -> None:
        ...

    def upsert_equipment(self, equipment: dict) -> None:
        ...

    def upsert_intervention(self, intervention: dict) -> None:
        ...

    def delete_file(self, file_id: str) -> None:
        ...


class DocumentStorageGateway(Protocol):
    def upload(self, bucket: str, path: str, content: bytes, content_type: str) -> None:
        ...

    def signed_url(self, bucket: str, path: str, expires_in: int = 900) -> str:
        ...

    def delete(self, bucket: str, path: str) -> None:
        ...
