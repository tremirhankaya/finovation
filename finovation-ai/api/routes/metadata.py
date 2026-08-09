from __future__ import annotations

from fastapi import APIRouter, Depends

from api.dependencies import require_runtime
from api.openapi_contract import ERROR_RESPONSES
from api.presenters import version_fields
from api.runtime import RuntimeState
from api.schemas.forecast import MetadataResponse


router = APIRouter(prefix="/api/v1", tags=["metadata"])


@router.get("/metadata", response_model=MetadataResponse, responses=ERROR_RESPONSES)
def metadata(runtime: RuntimeState = Depends(require_runtime)) -> dict:
    bundles = runtime.bundles
    assert bundles is not None
    fields = version_fields(runtime)
    return {
        **fields,
        "supported_horizons": ["3M", "6M", "12M"],
        "universe": bundles.universe,
        "cash_asset_id": "CASH_TPP",
        "policy": bundles.objectives["policy"],
        "create_objectives": bundles.objectives["create_objectives"],
        "optimize_objectives": bundles.objectives["optimize_objectives"],
    }
