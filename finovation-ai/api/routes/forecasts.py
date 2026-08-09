from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from api.dependencies import require_runtime
from api.openapi_contract import ERROR_RESPONSES
from api.runtime import RuntimeState
from api.schemas.common import Horizon
from api.schemas.forecast import ForecastResponse
from fund_ml.portfolio import parse_horizon


router = APIRouter(prefix="/api/v1", tags=["forecasts"])


@router.get("/forecasts", response_model=ForecastResponse, responses=ERROR_RESPONSES)
def forecasts(
    horizon: Annotated[Horizon, Query(description="Forecast horizon")],
    runtime: RuntimeState = Depends(require_runtime),
) -> dict:
    bundles = runtime.bundles
    assert bundles is not None and runtime.snapshot_id is not None
    frame = bundles.horizon_forecasts(parse_horizon(horizon))
    columns = [
        "instrument_id",
        "horizon_months",
        "simple_q10",
        "simple_q50",
        "simple_q90",
        "rank_position",
        "rank_percentile",
        "model_artifact_id",
        "ranker_artifact_id",
    ]
    return {
        "api_version": runtime.settings.api_version,
        "snapshot_id": runtime.snapshot_id,
        "system_date": bundles.project["system_date"],
        "forecast_origin": bundles.project["forecast_origin"],
        "model_bundle_id": bundles.forecast_manifest["schema_version"],
        "target_semantics": "SOURCE_PRICE_RETURN",
        "rows": frame[columns].to_dict(orient="records"),
    }
