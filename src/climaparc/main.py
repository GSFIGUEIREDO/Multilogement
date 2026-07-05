from __future__ import annotations

from fastapi import FastAPI

from src.climaparc.auth.presentation.router import router as auth_router
from src.climaparc.equipment.presentation.router import router as equipment_router
from src.climaparc.places.presentation.router import router as places_router
from src.climaparc.users.presentation.router import router as users_router


def create_app() -> FastAPI:
    app = FastAPI(title="ClimaParc API")

    @app.on_event("startup")
    def startup() -> None:
        import server

        server.init_db()

    app.include_router(auth_router)
    app.include_router(equipment_router)
    app.include_router(places_router)
    app.include_router(users_router)
    return app


app = create_app()
