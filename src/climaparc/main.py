from __future__ import annotations

from fastapi import FastAPI

from src.climaparc.auth.presentation.router import router as auth_router
from src.climaparc.documents.presentation.router import router as documents_router
from src.climaparc.equipment.presentation.router import router as equipment_router
from src.climaparc.interventions.presentation.router import router as interventions_router
from src.climaparc.places.presentation.router import router as places_router
from src.climaparc.recommendations.presentation.router import router as recommendations_router
from src.climaparc.reminders.presentation.router import router as reminders_router
from src.climaparc.reports.presentation.router import router as reports_router
from src.climaparc.settings.presentation.router import router as settings_router
from src.climaparc.state.presentation.router import router as state_router
from src.climaparc.tickets.presentation.router import router as tickets_router
from src.climaparc.users.presentation.router import router as users_router
from src.climaparc.web.presentation.router import router as web_router
from src.climaparc.work_orders.presentation.router import router as work_orders_router


def create_app() -> FastAPI:
    app = FastAPI(title="ClimaParc API")

    @app.on_event("startup")
    def startup() -> None:
        from backend.legacy_runtime import init_db

        init_db()

    app.include_router(auth_router)
    app.include_router(documents_router)
    app.include_router(equipment_router)
    app.include_router(interventions_router)
    app.include_router(places_router)
    app.include_router(recommendations_router)
    app.include_router(reminders_router)
    app.include_router(reports_router)
    app.include_router(settings_router)
    app.include_router(state_router)
    app.include_router(tickets_router)
    app.include_router(users_router)
    app.include_router(work_orders_router)
    app.include_router(web_router)
    return app


app = create_app()
