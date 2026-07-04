from __future__ import annotations

from fastapi import FastAPI

from src.climaparc.auth.presentation.router import router as auth_router


def create_app() -> FastAPI:
    app = FastAPI(title="ClimaParc API")

    @app.on_event("startup")
    def startup() -> None:
        import server

        server.init_db()

    app.include_router(auth_router)
    return app


app = create_app()
