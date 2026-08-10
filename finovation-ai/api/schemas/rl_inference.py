from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from pydantic import Field, model_validator

from api.schemas.common import PositiveFloat, StrictApiModel


RlModelName = Literal[
    "PPO_MARKET_BASELINE",
    "PPO_STRESS_CONTEXT",
    "PPO_ASSET_IMPACT",
    "PPO_ADAPTIVE_RECOVERY",
]
RlScenarioName = Literal[
    "SCENARIO_1_2025_03_17",
    "SCENARIO_2_2025_08_26",
]
WeightValue = Annotated[float, Field(ge=0.0, le=1.0)]

RL_ASSETS = {
    "GARAN.E",
    "AKBNK.E",
    "ASELS.E",
    "BIMAS.E",
    "TUPRS.E",
    "THYAO.E",
    "FROTO.E",
    "KCHOL.E",
    "SAHOL.E",
    "SISE.E",
    "EREGL.E",
    "TCELL.E",
    "TAVHL.E",
    "MGROS.E",
    "TOASO.E",
    "ULKER.E",
    "CASH_TPP",
}

RL_REQUEST_EXAMPLE = {
    "model": "PPO_STRESS_CONTEXT",
    "scenario": "SCENARIO_1_2025_03_17",
    "initial_nav": 10_000_000.0,
    "initial_weights": {
        "GARAN.E": 0.10,
        "AKBNK.E": 0.10,
        "ASELS.E": 0.03,
        "BIMAS.E": 0.05,
        "TUPRS.E": 0.04,
        "THYAO.E": 0.05,
        "FROTO.E": 0.05,
        "KCHOL.E": 0.09,
        "SAHOL.E": 0.10,
        "SISE.E": 0.05,
        "EREGL.E": 0.05,
        "TCELL.E": 0.05,
        "TAVHL.E": 0.05,
        "MGROS.E": 0.05,
        "TOASO.E": 0.04,
        "ULKER.E": 0.05,
        "CASH_TPP": 0.05,
    },
}


class RlInferenceRequest(StrictApiModel):
    model: RlModelName
    scenario: RlScenarioName
    initial_nav: PositiveFloat
    initial_weights: dict[str, WeightValue] = Field(min_length=17, max_length=17)

    @model_validator(mode="after")
    def validate_weight_contract(self) -> "RlInferenceRequest":
        received = set(self.initial_weights)
        if received != RL_ASSETS:
            missing = sorted(RL_ASSETS - received)
            unknown = sorted(received - RL_ASSETS)
            raise ValueError(
                f"initial_weights asset set mismatch; missing={missing}, unknown={unknown}"
            )
        total = sum(self.initial_weights.values())
        if abs(total - 1.0) > 1e-10:
            raise ValueError(f"initial_weights must sum to 1.0; observed {total:.12f}")
        return self


class RlDailyResult(StrictApiModel):
    day_number: int = Field(ge=1)
    date: date
    total_new_nav: float = Field(gt=0.0)
    passive_nav: float = Field(gt=0.0)
    weights: dict[str, float] = Field(min_length=17, max_length=17)


class RlInferenceResponse(StrictApiModel):
    model: RlModelName
    scenario: RlScenarioName
    scenario_start_date: date
    scenario_end_date: date
    trading_day_count: int = Field(gt=0)
    initial_nav: float = Field(gt=0.0)
    days: list[RlDailyResult] = Field(min_length=1)
    final_nav: float = Field(gt=0.0)
    return_pct: float
    passive_final_nav: float = Field(gt=0.0)
    passive_return_pct: float
    outperformance_amount: float
    outperformance_pct: float
    total_commission: float = Field(ge=0.0)
