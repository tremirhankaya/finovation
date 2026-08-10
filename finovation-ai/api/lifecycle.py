from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.runtime import RuntimeState
from api.settings import ServiceSettings


def lifespan_for(settings: ServiceSettings):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        runtime = RuntimeState(settings)
        runtime.initialize()
        app.state.runtime = runtime
        app.state.settings = settings
        yield

    return lifespan
