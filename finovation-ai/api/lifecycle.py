from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.runtime import RuntimeState
from api.rl_runtime import RlRuntimeState
from api.settings import ServiceSettings


def _warn_when_authentication_is_disabled(settings: ServiceSettings) -> None:
    if settings.api_key:
        return
    logging.getLogger("fund_ml.api").warning(
        "FUND_ML_API_KEY is not set. Forecast, portfolio and RL endpoints are "
        "served without authentication."
    )


def lifespan_for(settings: ServiceSettings):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        _warn_when_authentication_is_disabled(settings)

        runtime = RuntimeState(settings)
        runtime.initialize()
        app.state.runtime = runtime
        app.state.settings = settings

        rl_runtime = RlRuntimeState(settings)
        rl_runtime.initialize()
        app.state.rl_runtime = rl_runtime

        yield

    return lifespan
