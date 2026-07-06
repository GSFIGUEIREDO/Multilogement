from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from backend.legacy_endpoint_bridge import LegacyEndpointMixin
from backend.legacy_http import LegacyHttpMixin
from backend.legacy_routes import dispatch_get, dispatch_post
from backend.legacy_runtime import (
    DB_PATH,
    HOST,
    LEGACY_ENDPOINT_CONTEXT,
    PORT,
    ROOT,
    USE_POSTGRES,
    bootstrap_password_for_user,
    db,
    ensure_bootstrap_state,
    execute,
    get_state,
    init_db,
    public_base_url,
    save_state,
    sync_relational_tables,
    sync_relational_tables_safely,
    sync_users,
)


class Handler(LegacyEndpointMixin, LegacyHttpMixin, BaseHTTPRequestHandler):
    server_version = "ClimaParc/1.0"
    static_root = ROOT
    legacy_context = LEGACY_ENDPOINT_CONTEXT

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        dispatch_get(self, parsed, database_name="postgres" if USE_POSTGRES else "sqlite")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        dispatch_post(self, parsed)


def main() -> None:
    init_db()
    database_name = "Supabase/Postgres" if USE_POSTGRES else f"SQLite ({DB_PATH.name})"
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ClimaParc online sur http://{HOST}:{PORT} avec {database_name}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
