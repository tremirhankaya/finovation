from __future__ import annotations

import logging
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError

from fund_ml.portfolio import PortfolioError

from api.errors import (
    ApiError,
    api_error_handler,
    portfolio_error_handler,
    unexpected_error_handler,
    validation_error_handler,
)
from api.lifecycle import lifespan_for
from api.routes import forecasts, health, metadata, portfolios
from api.responses import Utf8JSONResponse
from api.settings import ServiceSettings


def create_app(settings: ServiceSettings | None = None) -> FastAPI:
    selected = settings or ServiceSettings.from_environment()
    app = FastAPI(
        title="ML Fund Engine Frozen Snapshot API",
        summary="CREATE, OPTIMIZE and forecast access for the frozen V3 bundle",
        version="1.0.0",
        default_response_class=Utf8JSONResponse,
        lifespan=lifespan_for(selected),
    )
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(PortfolioError, portfolio_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unexpected_error_handler)

    @app.middleware("http")
    async def add_contract_headers(request: Request, call_next):
        request.state.request_id = request.headers.get("X-Request-Id")
        request.state.started_at = perf_counter()
        response = await call_next(request)
        runtime = getattr(request.app.state, "runtime", None)
        response.headers["X-API-Version"] = selected.api_version
        if runtime is not None and runtime.snapshot_id is not None:
            response.headers["X-Model-Snapshot"] = runtime.snapshot_id
            if runtime.bundles is not None:
                response.headers["X-Model-Bundle"] = runtime.bundles.forecast_manifest[
                    "schema_version"
                ]
                response.headers["X-Policy-Config"] = runtime.bundles.objectives[
                    "config_id"
                ]
        if request.state.request_id:
            response.headers["X-Request-Id"] = request.state.request_id
        duration_ms = (perf_counter() - request.state.started_at) * 1000.0
        logging.getLogger("fund_ml.api").info(
            "request_completed request_id=%s method=%s path=%s status=%s "
            "duration_ms=%.3f snapshot_id=%s",
            request.state.request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            runtime.snapshot_id if runtime is not None else None,
        )
        return response

    app.include_router(health.router)
    app.include_router(metadata.router)
    app.include_router(forecasts.router)
    app.include_router(portfolios.router)
    return app


app = create_app()
