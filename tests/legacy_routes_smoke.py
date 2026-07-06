from __future__ import annotations

import sys
from http import HTTPStatus
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
from backend.legacy_routes import GET_ROUTES, POST_ROUTES, dispatch_get, dispatch_post  # noqa: E402


class FakeHandler:
    def __init__(self):
        self.called: list[tuple[str, object]] = []

    def json_response(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        self.called.append(("json", payload, status))

    def serve_static(self, path: str) -> None:
        self.called.append(("static", path))

    def __getattr__(self, name: str):
        if name.startswith("handle_"):
            def record(*args):
                self.called.append((name, *args))
            return record
        raise AttributeError(name)


def run() -> None:
    for method_name in set(GET_ROUTES.values()) | set(POST_ROUTES.values()):
        assert hasattr(server.Handler, method_name), f"Handler missing {method_name}"

    get_handler = FakeHandler()
    dispatch_get(get_handler, SimpleNamespace(path="/api/session"), database_name="sqlite")
    assert get_handler.called == [("handle_session",)]

    local_handler = FakeHandler()
    parsed = SimpleNamespace(path="/api/local-file")
    dispatch_get(local_handler, parsed, database_name="sqlite")
    assert local_handler.called == [("handle_local_file", parsed)]

    health_handler = FakeHandler()
    dispatch_get(health_handler, SimpleNamespace(path="/api/health"), database_name="sqlite")
    assert health_handler.called == [("json", {"ok": True, "database": "sqlite"}, HTTPStatus.OK)]

    static_handler = FakeHandler()
    dispatch_get(static_handler, SimpleNamespace(path="/app.js"), database_name="sqlite")
    assert static_handler.called == [("static", "/app.js")]

    post_handler = FakeHandler()
    dispatch_post(post_handler, SimpleNamespace(path="/api/login"))
    assert post_handler.called == [("handle_login",)]

    not_found_handler = FakeHandler()
    dispatch_post(not_found_handler, SimpleNamespace(path="/api/unknown"))
    assert not_found_handler.called == [("json", {"error": "Not found"}, HTTPStatus.NOT_FOUND)]

    print("legacy_routes_smoke: ok")


if __name__ == "__main__":
    run()
