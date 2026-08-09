from __future__ import annotations

from typing import Literal

from pydantic import Field

from api.schemas.common import Horizon, StrictApiModel


class ForecastRow(StrictApiModel):
    instrument_id: str
    horizon_months: int
    simple_q10: float
    simple_q50: float
    simple_q90: float
    rank_position: int
    rank_percentile: float
    model_artifact_id: str
    ranker_artifact_id: str | None = None


class ForecastResponse(StrictApiModel):
    api_version: Literal["v1"]
    snapshot_id: str
    system_date: str
    forecast_origin: str
    model_bundle_id: str
    target_semantics: Literal["SOURCE_PRICE_RETURN"]
    rows: list[ForecastRow] = Field(min_length=58, max_length=58)


class MetadataResponse(StrictApiModel):
    api_version: Literal["v1"]
    snapshot_id: str
    system_date: str
    forecast_origin: str
    model_bundle_id: str
    policy_config_id: str
    supported_horizons: list[Horizon]
    universe: list[str] = Field(min_length=58, max_length=58)
    cash_asset_id: Literal["CASH_TPP"]
    policy: dict[str, float | int]
    create_objectives: list[str]
    optimize_objectives: list[str]


class LiveResponse(StrictApiModel):
    status: Literal["LIVE"]
    api_version: Literal["v1"]


class ReadyResponse(StrictApiModel):
    status: Literal["READY"]
    api_version: Literal["v1"]
    snapshot_id: str
    model_bundle_id: str
