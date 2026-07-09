from __future__ import annotations

import os
from collections.abc import Mapping


FASTAPI_MODES = {"fastapi", "new", "uvicorn"}
LEGACY_MODES = {"legacy", "server", "http"}


def selected_server_mode(environment: Mapping[str, str] | None = None) -> str:
    values = environment if environment is not None else os.environ
    mode = values.get("CLIMAPARC_SERVER_MODE", "fastapi").strip().lower()
    if mode in FASTAPI_MODES:
        return "fastapi"
    if mode in LEGACY_MODES:
        return "legacy"
    raise RuntimeError(
        "CLIMAPARC_SERVER_MODE invalide. Utilisez 'fastapi' ou 'legacy'."
    )


def run_fastapi() -> None:
    import uvicorn

    host = os.environ.get("CLIMAPARC_HOST", "0.0.0.0")
    port = int(os.environ.get("PORT") or os.environ.get("CLIMAPARC_PORT", "8000"))
    forwarded_allow_ips = os.environ.get("CLIMAPARC_FORWARDED_ALLOW_IPS", "*")
    print(f"ClimaParc FastAPI sur http://{host}:{port}", flush=True)
    uvicorn.run(
        "src.climaparc.main:app",
        host=host,
        port=port,
        proxy_headers=True,
        forwarded_allow_ips=forwarded_allow_ips,
    )


def run_legacy() -> None:
    from server import main as legacy_main

    print("ClimaParc demarre en mode legacy.", flush=True)
    legacy_main()


def main() -> None:
    if selected_server_mode() == "legacy":
        run_legacy()
        return
    run_fastapi()


if __name__ == "__main__":
    main()
