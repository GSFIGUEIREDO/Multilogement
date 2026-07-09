from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import start


def test_mode_selection() -> None:
    assert start.selected_server_mode({}) == "fastapi"
    assert start.selected_server_mode({"CLIMAPARC_SERVER_MODE": "fastapi"}) == "fastapi"
    assert start.selected_server_mode({"CLIMAPARC_SERVER_MODE": "legacy"}) == "legacy"

    try:
        start.selected_server_mode({"CLIMAPARC_SERVER_MODE": "inconnu"})
    except RuntimeError:
        pass
    else:
        raise AssertionError("Un mode inconnu doit etre refuse.")


def test_fastapi_launcher() -> None:
    environment = {
        "CLIMAPARC_HOST": "127.0.0.1",
        "CLIMAPARC_PORT": "8765",
        "CLIMAPARC_FORWARDED_ALLOW_IPS": "127.0.0.1",
    }
    with patch.dict(os.environ, environment, clear=True):
        with patch("uvicorn.run") as run:
            start.run_fastapi()

    run.assert_called_once_with(
        "src.climaparc.main:app",
        host="127.0.0.1",
        port=8765,
        proxy_headers=True,
        forwarded_allow_ips="127.0.0.1",
    )


def main() -> None:
    test_mode_selection()
    test_fastapi_launcher()
    print("startup smoke: ok")


if __name__ == "__main__":
    main()
