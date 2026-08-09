from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


Horizon = Literal["3M", "6M", "12M"]
Weight = Annotated[float, Field(ge=0.0, le=1.0)]
PositiveFloat = Annotated[float, Field(gt=0.0)]
RequestId = Annotated[str, Field(min_length=1, max_length=128)]


class StrictApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ErrorBody(StrictApiModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(StrictApiModel):
    request_id: str | None = None
    status: Literal["ERROR"] = "ERROR"
    error: ErrorBody
    snapshot_id: str | None = None


class AlternativeBase(StrictApiModel):
    objective_id: str
    horizon: Horizon
    weights: dict[str, float]
    stock_count: int
    equity_weight: float
    tpp_weight: float
    expected_model_utility_log: float
    horizon_volatility: float
    universe58_beta: float
    sector_exposures: dict[str, float]
    large_position_threshold: float
    large_position_assets: list[str]
    large_position_total_weight: float
    weight_semantics: Literal["CONTINUOUS_DECIMAL_NOT_INTEGER_PERCENT"]
    objective_value: float
    reason_codes: dict[str, list[str]]
    reason_texts: dict[str, list[str]]
    solution_class: Literal[
        "DETERMINISTIC_HEURISTIC_LOCAL_SEARCH_NOT_GLOBAL_OPTIMUM"
    ]


class VersionedResponse(StrictApiModel):
    request_id: str | None = None
    api_version: Literal["v1"]
    snapshot_id: str
    system_date: str
    forecast_origin: str
    model_bundle_id: str
    policy_config_id: str
    processing_time_ms: float = Field(ge=0.0)


def bundled_example(name: str) -> dict:
    root = Path(__file__).resolve().parents[2]
    return json.loads((root / "examples" / name).read_text(encoding="utf-8"))
