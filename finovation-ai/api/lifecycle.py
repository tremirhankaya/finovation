from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.runtime import RuntimeState
from api.rl_runtime import RlRuntimeState
from api.settings import ServiceSettings


def lifespan_for(settings: ServiceSettings):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        runtime = RuntimeState(settings)
        runtime.initialize()
        app.state.runtime = runtime
        app.state.settings = settings
        
        rl_runtime = RlRuntimeState(settings)
        rl_runtime.initialize()
        app.state.rl_runtime = rl_runtime
        
        yield

    return lifespan
