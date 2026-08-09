from __future__ import annotations

from fastapi import APIRouter, Request

from api.errors import ApiError
from api.openapi_contract import READINESS_ERROR_RESPONSE
from api.schemas.forecast import LiveResponse, ReadyResponse


router = APIRouter(tags=["health"])


@router.get("/health/live", response_model=LiveResponse)
def live(request: Request) -> dict:
    return {"status": "LIVE", "api_version": request.app.state.runtime.settings.api_version}


@router.get(
    "/health/ready",
    response_model=ReadyResponse,
    responses=READINESS_ERROR_RESPONSE,
)
def ready(request: Request) -> dict:
    runtime = request.app.state.runtime
    if not runtime.ready or runtime.bundles is None or runtime.snapshot_id is None:
        raise ApiError(
            503,
            "RUNTIME_NOT_READY",
            "Model runtime is not ready",
            {"startup_error": runtime.startup_error},
        )
    return {
        "status": "READY",
        "api_version": runtime.settings.api_version,
        "snapshot_id": runtime.snapshot_id,
        "model_bundle_id": runtime.bundles.forecast_manifest["schema_version"],
    }
