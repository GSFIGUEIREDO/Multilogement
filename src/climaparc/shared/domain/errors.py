from __future__ import annotations

from http import HTTPStatus


class ApplicationError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status = status


class ConcurrentModificationError(ApplicationError):
    def __init__(self, message: str = "Ces donnees ont ete modifiees par une autre personne."):
        super().__init__(message, HTTPStatus.CONFLICT)
